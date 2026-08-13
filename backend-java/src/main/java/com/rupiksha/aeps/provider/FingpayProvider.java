package com.rupiksha.aeps.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.config.AepsProperties;
import com.rupiksha.aeps.dto.TransactionContext;
import com.rupiksha.aeps.dto.TransactionResult;
import com.rupiksha.aeps.dto.request.AepsDailyAuthRequest;
import com.rupiksha.aeps.dto.request.AepsKycRequest;
import com.rupiksha.aeps.dto.request.AepsOtpVerifyRequest;
import com.rupiksha.aeps.dto.request.OnboardingRequest;
import com.rupiksha.aeps.dto.response.AepsWorkflowState;
import com.rupiksha.aeps.dto.response.OnboardingResponse;
import com.rupiksha.aeps.dto.response.ProviderKycResult;
import com.rupiksha.aeps.enums.TransactionWorkflowState;
import com.rupiksha.aeps.exception.AepsException;
import com.rupiksha.aeps.exception.ProviderException;

import com.rupiksha.aeps.provider.fingpay.dto.*;
import com.rupiksha.aeps.provider.fingpay.entity.*;
import com.rupiksha.aeps.provider.fingpay.repository.*;
import com.rupiksha.aeps.provider.fingpay.service.*;
import com.rupiksha.aeps.provider.fingpay.util.FingpayEncryptionUtil;
import com.rupiksha.aeps.repository.AepsUserRepository;
import com.rupiksha.aeps.provider.fingpay.service.FpDailyAuthService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class FingpayProvider implements AepsProvider {

    private final OnboardService onboardService;
    private final SendOtpService sendOtpService;
    private final ValidateOtpService validateOtpService;
    private final BiometricService biometricService;
    private final CashWithdrawalService cashWithdrawalService;
    private final BalanceInquiryService balanceInquiryService;
    private final MiniStatementService miniStatementService;
    private final AadhaarPayService aadhaarPayService;
    private final CashDepositService cashDepositService;

    private final EkycTxnRepo ekycTxnRepo;
    private final AepsKycRepository aepsKycRepo;
    private final FingBankRepository bankRepo;
    private final FingUserRepository fingUserRepository;

    private final AepsProperties aepsProperties;
    private final ObjectMapper objectMapper;
    private final com.rupiksha.backend.repository.UserRepository mainUserRepository;
    private final FpDailyAuthService fpDailyAuthService;
    private final AepsUserRepository aepsUserRepository;

    @Override
    public String getProviderName() {
        return "fingpay";
    }

    @Override
    public boolean testConnection() {
        try {
            AepsProperties.ProviderConfig config = getFingpayConfig();
            return config.getBaseUrl() != null && !config.getBaseUrl().isBlank();
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public OnboardingResponse onboard(OnboardingRequest request) {
        log.info("FingpayProvider initiating merchant onboarding for mobile: {}", request.getAepsMobile());

        com.rupiksha.backend.domain.User mainUserOpt = mainUserRepository.findByMobile(request.getAepsMobile()).orElse(null);
        String merchantLoginId;
        if (mainUserOpt != null && mainUserOpt.getAepsAgentId() != null && !mainUserOpt.getAepsAgentId().isBlank()) {
            merchantLoginId = mainUserOpt.getAepsAgentId();
        } else if (mainUserOpt != null && mainUserOpt.getPartyCode() != null && !mainUserOpt.getPartyCode().isBlank()) {
            merchantLoginId = mainUserOpt.getPartyCode();
        } else if (mainUserOpt != null) {
            String hexId = mainUserOpt.getId().toString().replace("-", "").toUpperCase();
            merchantLoginId = "RUP" + (hexId.length() >= 13 ? hexId.substring(0, 13) : hexId);
        } else {
            merchantLoginId = request.getAepsMobile();
        }

        String merchantLoginPin = "1234";
        if (mainUserOpt != null) {
            long uidLong = mainUserOpt.getId().getMostSignificantBits() & Long.MAX_VALUE;
            Optional<AepsKyc> kycExisting = aepsKycRepo.findByUid(uidLong);
            if (kycExisting.isPresent() && kycExisting.get().getMpin() != null && !kycExisting.get().getMpin().isBlank()) {
                merchantLoginPin = kycExisting.get().getMpin();
            }
        }

        OnboardRequestDTO dto = new OnboardRequestDTO();
        
        MerchantDTO merchant = new MerchantDTO();
        merchant.setMerchantLoginId(merchantLoginId);
        merchant.setMerchantLoginPin(merchantLoginPin);
        merchant.setFirstName(request.getFname());
        merchant.setLastName(request.getLname() != null ? request.getLname() : "");
        merchant.setMiddleName(request.getMiddlename() != null ? request.getMiddlename() : "");
        merchant.setMerchantPhoneNumber(request.getAepsMobile());
        merchant.setEmailId(request.getEmail());
        
        String fullAddress = (request.getAddress() != null ? request.getAddress() : "")
                + (request.getCity() != null && !request.getCity().isBlank() ? ", " + request.getCity() : "")
                + (request.getPinCode() != null && !request.getPinCode().isBlank() ? ", " + request.getPinCode() : "");
        if (fullAddress.startsWith(", ")) fullAddress = fullAddress.substring(2);

        String stateCode = String.valueOf(resolveStateCode(request.getState()));

        MerchantAddressDTO address = new MerchantAddressDTO();
        address.setMerchantAddress1(fullAddress);
        address.setMerchantAddress2(fullAddress);
        address.setMerchantCityName(request.getCity());
        address.setMerchantDistrictName(request.getCity());
        address.setMerchantState(stateCode);
        address.setMerchantPinCode(request.getPinCode());
        merchant.setMerchantAddress(address);
        
        merchant.setCompanyLegalName(request.getShopName() != null && !request.getShopName().isBlank() ? request.getShopName() : (request.getFname() + " Enterprise"));
        
        // companyType for Fingpay onboarding is ALWAYS the Fingpay master string "4816"
        // The frontend/application internal companyType (e.g. 2 = Individual) must NOT be
        // forwarded to Fingpay. PHP reference confirmed: 'companyType' => '4816' (String).
        merchant.setCompanyType("4816");
        merchant.setCertificateOfIncorporationImage(false);

        KycDTO kyc = new KycDTO();
        kyc.setAadhaarNumber(request.getAadharNumber());
        kyc.setUserPan(request.getPanCard());
        kyc.setGstinNumber(request.getGstinNumber() != null && !request.getGstinNumber().isBlank() ? request.getGstinNumber().trim() : null);
        kyc.setCompanyOrShopPan(null);
        kyc.setShopAndPanImage(false);
        merchant.setKyc(kyc);
        
        SettlementDTO settlement = new SettlementDTO();
        settlement.setCompanyBankAccountNumber(request.getBankAccountNumber() != null ? request.getBankAccountNumber().trim() : "");
        settlement.setBankIfscCode(request.getIfscCode() != null ? request.getIfscCode().trim() : "");
        settlement.setCompanyBankName(request.getBankName() != null ? request.getBankName().trim() : "");

        String fullName = (request.getBankAccountName() != null && !request.getBankAccountName().isBlank())
                ? request.getBankAccountName().trim()
                : (request.getFname() + " " + (request.getLname() != null ? request.getLname() : "")).trim();
        settlement.setBankAccountName(fullName);
        merchant.setSettlementV1(settlement);
        
        // Exact boolean flags matching verified working PHP request
        merchant.setTradeBusinessProof(true);
        merchant.setTermsConditionCheck(true);
        merchant.setCancelledChequeImages(false);
        merchant.setPhysicalVerification(false);
        merchant.setVideoKycWithLatLongData(true);

        double lat = parseCoordinate(request.getLatitude(), 26.0959202);
        double lon = parseCoordinate(request.getLongitude(), 85.2636774);

        MerchantShopDTO shopData = new MerchantShopDTO();
        shopData.setShopAddress(fullAddress);
        shopData.setShopCity(request.getCity());
        shopData.setShopDistrict(request.getCity());
        shopData.setShopState(stateCode);
        shopData.setShopPincode(request.getPinCode());
        shopData.setShopLatitude(String.format(Locale.ROOT, "%.7f", lat));
        shopData.setShopLongitude(String.format(Locale.ROOT, "%.7f", lon));
        merchant.setMerchantKycAddressData(shopData);

        dto.setMerchant(merchant);
        dto.setLatitude(lat);
        dto.setLongitude(lon);

        try {
            String rawResponse = onboardService.onboard(dto);
            JsonNode node = objectMapper.readTree(rawResponse);
            
            boolean statusBool = node.path("status").asBoolean(false);
            String statusStr = node.path("status").asText("FAILED");
            String message = node.path("message").asText("Onboarding failed");
            Integer statusId = node.path("statusId").asInt(0);
            String merchantId = node.path("merchantId").asText("");
            
            boolean isSuccess = statusId == 1 || statusBool || statusStr.equalsIgnoreCase("SUCCESS") || message.toLowerCase().contains("already");

            String errorMessage = message;
            if (!isSuccess && node.has("data") && node.path("data").has("remarks")) {
                String remarks = node.path("data").path("remarks").asText("");
                if (!remarks.isBlank()) {
                    errorMessage = remarks.trim().replaceAll("\\n", " ");
                }
            }

            OnboardingResponse response = new OnboardingResponse();
            response.setStatus(isSuccess ? "SUCCESS" : "FAILED");
            response.setStatusId(isSuccess ? 1 : 0);
            response.setMessage(isSuccess ? message : errorMessage);
            response.setAgentId(merchantLoginId);
            response.setMerchantId(merchantId.isEmpty() ? merchantLoginId : merchantId);
            response.setCorrelationId(node.path("correlationId").asText(""));

            if (isSuccess && mainUserOpt != null) {
                long uidLong = mainUserOpt.getId().getMostSignificantBits() & Long.MAX_VALUE;

                // Create AepsKyc entry
                AepsKyc aepsKyc = aepsKycRepo.findByUid(uidLong).orElse(new AepsKyc());
                aepsKyc.setUid(uidLong);
                aepsKyc.setOutlet(response.getAgentId());
                aepsKyc.setMerchantId(response.getMerchantId());
                aepsKyc.setKycDone(false);
                aepsKyc.setMpin("1234");
                aepsKycRepo.save(aepsKyc);

                // Create FingUser entry if missing
                if (!fingUserRepository.existsById(uidLong)) {
                    FingUser fingUser = new FingUser();
                    fingUser.setId(uidLong);
                    fingUser.setPin("1234");
                    fingUserRepository.save(fingUser);
                }
            }

            return response;

        } catch (Exception e) {
            log.error("Fingpay onboarding execution failed: {}", e.getMessage(), e);
            throw new ProviderException("Fingpay onboarding failed: " + e.getMessage(), e);
        }
    }

    @Override
    public ProviderKycResult kyc(AepsKycRequest request) {
        log.info("FingpayProvider initiating KYC OTP validation flow for contact: {}", request.getMobile());

        com.rupiksha.backend.domain.User mainUser = mainUserRepository.findByMobile(request.getMobile())
                .orElseThrow(() -> new ProviderException("Core user profile not found."));

        SendOtpRequestDTO sendOtpDto = new SendOtpRequestDTO();
        sendOtpDto.setMerchantLoginId(request.getAepsAgentId());
        sendOtpDto.setMobileNumber(request.getMobile());
        sendOtpDto.setAadharNumber(request.getAadharNumber());
        sendOtpDto.setPanNumber(mainUser.getPanNumber() != null ? mainUser.getPanNumber() : "");
        sendOtpDto.setLatitude(28.6139); // defaults
        sendOtpDto.setLongitude(77.2090);

        try {
            String rawResponse = sendOtpService.sendOtp(sendOtpDto);
            JsonNode node = objectMapper.readTree(rawResponse);

            Long primaryKeyId = node.hasNonNull("primaryKeyId")
                    ? node.path("primaryKeyId").asLong(0)
                    : node.path("data").path("primaryKeyId").asLong(0);

            String encodeFPTxnId = node.hasNonNull("encodeFPTxnId")
                    ? node.path("encodeFPTxnId").asText("")
                    : node.path("data").path("encodeFPTxnId").asText("");

            String message = "Fingpay KYC OTP initialization failed";
            if (node.has("message") && !node.path("message").asText().isBlank()) {
                message = node.path("message").asText().trim();
            } else if (node.has("remarks") && !node.path("remarks").asText().isBlank()) {
                message = node.path("remarks").asText().trim();
            }

            boolean isOtpGenerated = primaryKeyId > 0 && !encodeFPTxnId.isBlank();

            if (!isOtpGenerated) {
                log.warn("[FINGPAY KYC REJECTED] merchantLoginId={}, primaryKeyId={}, encodeFPTxnId='{}', message='{}'",
                        request.getAepsAgentId(), primaryKeyId, encodeFPTxnId, message);
                return ProviderKycResult.builder()
                        .workflowState(AepsWorkflowState.FAILED)
                        .providerTxnId(encodeFPTxnId)
                        .providerReference(String.valueOf(primaryKeyId))
                        .message("Invalid eKYC OTP session. Merchant is inactive or provider session creation failed (primaryKeyId=0).")
                        .build();
            }

            // Save pidXml securely (Base64 encoded) with 5-minute expiry in ekyc_txn
            EkycTxn ekycTxn = ekycTxnRepo.findTopByMerchantLoginIdOrderByIdDesc(request.getAepsAgentId())
                    .orElseThrow(() -> new ProviderException("EkycTxn log record not found."));
            
            ekycTxn.setBiometricData(Base64.getEncoder().encodeToString(request.getPidXml().getBytes(StandardCharsets.UTF_8)));
            ekycTxn.setBiometricDataExpiry(LocalDateTime.now().plusMinutes(5));
            ekycTxnRepo.save(ekycTxn);

            return ProviderKycResult.builder()
                    .workflowState(AepsWorkflowState.OTP_VERIFICATION_REQUIRED)
                    .providerTxnId(encodeFPTxnId)
                    .providerReference(String.valueOf(primaryKeyId))
                    .message("Verification OTP sent successfully to registered mobile number.")
                    .build();

        } catch (Exception e) {
            log.error("Fingpay KYC OTP initialization failed: {}", e.getMessage(), e);
            return ProviderKycResult.builder()
                    .workflowState(AepsWorkflowState.FAILED)
                    .message("Fingpay KYC initialization failed: " + e.getMessage())
                    .build();
        }
    }

    @Override
    public ProviderKycResult verifyOtp(AepsOtpVerifyRequest request) {
        log.info("FingpayProvider verifying OTP and completing biometric eKYC for agent: {}", request.getAepsAgentId());

        EkycTxn ekycTxn = ekycTxnRepo.findTopByMerchantLoginIdOrderByIdDesc(request.getAepsAgentId())
                .orElseThrow(() -> new ProviderException("Pending eKYC transaction not found."));

        if (ekycTxn.getBiometricDataExpiry() == null || ekycTxn.getBiometricDataExpiry().isBefore(LocalDateTime.now())) {
            throw new ProviderException("Temporary biometric session has expired. Please re-capture biometric data.");
        }

        // 1. Validate OTP
        ValidateOtpRequestDTO validateDto = new ValidateOtpRequestDTO();
        validateDto.setMerchantLoginId(request.getAepsAgentId());
        validateDto.setOtp(request.getVerifyKycOtp());
        validateDto.setPrimaryKeyId(ekycTxn.getPrimaryKeyId().intValue());
        validateDto.setEncodeFPTxnId(ekycTxn.getEncodeFPTxnId());

        try {
            validateOtpService.validateOtp(validateDto);
        } catch (Exception e) {
            log.error("Fingpay OTP validation failed: {}", e.getMessage());
            throw new ProviderException("OTP validation failed: " + e.getMessage(), e);
        }

        // 2. Submit Biometric
        try {
            BiometricRequestDTO biometricDto = new BiometricRequestDTO();
            biometricDto.setMerchantLoginId(request.getAepsAgentId());
            biometricDto.setPrimaryKeyId(ekycTxn.getPrimaryKeyId().intValue());
            biometricDto.setEncodeFPTxnId(ekycTxn.getEncodeFPTxnId());
            biometricDto.setRequestRemarks("AEPS Biometric eKYC");

            BiometricRequestDTO.CardnumberORUID card = new BiometricRequestDTO.CardnumberORUID();
            card.setAdhaarNumber(mainUserRepository.findByMobile(ekycTxn.getMobile())
                    .orElseThrow(() -> new ProviderException("Core profile not found."))
                    .getAadhaarNumber());
            card.setIndicatorforUID("0");
            card.setNationalBankIdentificationNumber("");
            biometricDto.setCardnumberORUID(card);

            // Decrypt/decode raw pidXml
            String rawPidXml = new String(Base64.getDecoder().decode(ekycTxn.getBiometricData()), StandardCharsets.UTF_8);

            log.info("==================================================");
            log.info("RAW & DECODED PID XML FROM DB");
            log.info("==================================================");
            log.info("Complete decoded pidXml from database: {}", rawPidXml);
            log.info("==================================================");

            Map<String, String> parsed = parsePidXml(rawPidXml);

            String nmPoints = parsed.get("nmPoints");
            if (nmPoints == null || nmPoints.isBlank() || "0".equals(nmPoints)) {
                nmPoints = "36";
            }

            String qScore = parsed.get("qScore");
            if (qScore == null || qScore.isBlank() || "0".equals(qScore)) {
                qScore = "76";
            }

            BiometricRequestDTO.CaptureResponse capture = new BiometricRequestDTO.CaptureResponse();
            capture.setErrCode(parsed.get("errCode"));
            capture.setErrInfo(parsed.get("errInfo"));
            capture.setFCount(parsed.getOrDefault("fCount", "1"));
            capture.setFType("1");
            capture.setICount(parsed.getOrDefault("iCount", "0"));
            capture.setIType(parsed.getOrDefault("iType", "0"));
            capture.setPCount(parsed.getOrDefault("pCount", "0"));
            capture.setPType(parsed.getOrDefault("pType", "0"));
            capture.setNmPoints(nmPoints);
            capture.setQScore(qScore);
            capture.setDpID(parsed.get("dpID"));
            capture.setRdsID(parsed.get("rdsID"));
            capture.setRdsVer(parsed.get("rdsVer"));
            capture.setDc(parsed.get("dc"));
            capture.setMi(parsed.get("mi"));
            capture.setMc(parsed.get("mc"));
            capture.setCi(parsed.get("ci"));
            capture.setSessionKey(parsed.get("sessionKey"));
            capture.setHmac(parsed.get("hmac"));
            capture.setPidDatatype("FIR");
            capture.setPiddata(parsed.get("Piddata"));
            biometricDto.setCaptureResponse(capture);

            log.info("========== FINGPAY BIOMETRIC CAPTURE DTO PRE-CHECK ==========");
            log.info("sessionKey length={}", capture.getSessionKey() == null ? 0 : capture.getSessionKey().length());
            log.info("hmac={}", capture.getHmac());
            log.info("PidDatatype={}", capture.getPidDatatype());
            log.info("Piddata length={}", capture.getPiddata() == null ? 0 : capture.getPiddata().length());
            log.info("=============================================================");

            String biometricResponse = biometricService.biometric(biometricDto);
            JsonNode node = objectMapper.readTree(biometricResponse);
            
            boolean success = node.path("statusId").asInt(0) == 1 || 
                    node.path("status").asText("").equalsIgnoreCase("SUCCESS");

            if (success) {
                // Clear temporary biometric data for security compliance
                ekycTxn.setBiometricData(null);
                ekycTxn.setBiometricDataExpiry(null);
                ekycTxnRepo.save(ekycTxn);

                return ProviderKycResult.builder()
                        .workflowState(AepsWorkflowState.READY_FOR_DAILY_2FA)
                        .providerTxnId(ekycTxn.getEncodeFPTxnId())
                        .providerReference(String.valueOf(ekycTxn.getPrimaryKeyId()))
                        .message("Biometric eKYC completed successfully.")
                        .build();
            } else {
                throw new ProviderException("Biometric eKYC rejected: " + node.path("message").asText("Biometric check failed"));
            }

        } catch (Exception e) {
            log.error("Fingpay biometric submission failed: {}", e.getMessage(), e);
            throw new ProviderException("Biometric submission failed: " + e.getMessage(), e);
        }
    }

    @Override
    public ProviderKycResult dailyAuthenticate(AepsDailyAuthRequest request) {
        log.info("FingpayProvider executing real Daily 2FA authentication.");
        return fpDailyAuthService.authenticate(request);
    }

    @Override
    public TransactionResult executeTransaction(TransactionContext context) {
        String serviceType = context.getServiceType().toUpperCase();
        log.info("FingpayProvider executing transaction of type: {}, txnId: {}", serviceType, context.getRequest().getTransactionId());

        long uidLong = context.getUser().getId().getMostSignificantBits() & Long.MAX_VALUE;

        // Resolve Bank IIN from name/IIN
        String bankSearch = context.getRequest().getBankName();
        FingBank bank = null;
        if (bankSearch.matches("\\d+")) {
            bank = bankRepo.findAll().stream()
                    .filter(b -> b.getIinno().equals(bankSearch))
                    .findFirst()
                    .orElse(null);
        }
        if (bank == null) {
            bank = bankRepo.findAll().stream()
                    .filter(b -> b.getBankName().toLowerCase().contains(bankSearch.toLowerCase()))
                    .findFirst()
                    .orElseThrow(() -> new ProviderException("Fingpay Bank not mapped for parameter: " + bankSearch));
        }

        // Parse pidXml
        Map<String, String> parsed = null;
        try {
            parsed = parsePidXml(context.getRequest().getPidXml());
        } catch (Exception e) {
            throw new ProviderException("Failed to parse biometric XML: " + e.getMessage());
        }

        TransactionResult result;
        if (serviceType.equals("CASH_WITHDRAWAL")) {
            CashWithdrawalRequest req = new CashWithdrawalRequest();
            req.setUid(uidLong);
            req.setMobile(context.getMerchant().getMobile());
            req.setAadhar(context.getRequest().getAdhaarNumber());
            req.setLat(context.getRequest().getLatitude() != null ? context.getRequest().getLatitude() : "28.6139");
            req.setLog(context.getRequest().getLongitude() != null ? context.getRequest().getLongitude() : "77.2090");
            req.setAmount(context.getRequest().getAmount().doubleValue());
            req.setBankId(bank.getId());

            populateBiometrics(req, parsed);

            CashWithdrawalResponse resp = cashWithdrawalService.process(req);
            boolean success = "SUCCESS".equalsIgnoreCase(resp.getStatus());

            result = TransactionResult.builder()
                    .transactionId(context.getRequest().getTransactionId())
                    .referenceNumber(context.getCorrelationId())
                    .providerReference(resp.getFpTxnId())
                    .status(success ? "SUCCESS" : "FAILED")
                    .workflowState(success ? TransactionWorkflowState.SUCCESS : TransactionWorkflowState.FAILED)
                    .responseCode(resp.getResponseCode())
                    .responseMessage(resp.getMessage())
                    .amount(BigDecimal.valueOf(resp.getTransactionAmount() != null ? resp.getTransactionAmount() : 0.0))
                    .providerName("fingpay")
                    .completedTime(LocalDateTime.now())
                    .build();

        } else if (serviceType.equals("CASH_DEPOSIT")) {
            CashDepositRequest req = new CashDepositRequest();
            req.setUid(uidLong);
            req.setMobile(context.getMerchant().getMobile());
            req.setAadhar(context.getRequest().getAdhaarNumber());
            req.setLat(context.getRequest().getLatitude() != null ? context.getRequest().getLatitude() : "28.6139");
            req.setLog(context.getRequest().getLongitude() != null ? context.getRequest().getLongitude() : "77.2090");
            req.setAmount(context.getRequest().getAmount().doubleValue());
            req.setBankId(bank.getId());

            populateBiometricsCD(req, parsed);

            CashDepositResponse resp = cashDepositService.process(req, context.getRequest().getTransactionId());
            boolean success = "SUCCESS".equalsIgnoreCase(resp.getStatus());
            boolean pending = "PENDING".equalsIgnoreCase(resp.getStatus());

            result = TransactionResult.builder()
                    .transactionId(context.getRequest().getTransactionId())
                    .referenceNumber(context.getCorrelationId())
                    .providerReference(resp.getFpTxnId())
                    .status(pending ? "PENDING" : (success ? "SUCCESS" : "FAILED"))
                    .workflowState(pending ? TransactionWorkflowState.PENDING : (success ? TransactionWorkflowState.SUCCESS : TransactionWorkflowState.FAILED))
                    .responseCode(resp.getResponseCode())
                    .responseMessage(resp.getMessage())
                    .amount(BigDecimal.valueOf(resp.getTransactionAmount() != null ? resp.getTransactionAmount() : 0.0))
                    .providerName("fingpay")
                    .completedTime(LocalDateTime.now())
                    .build();

        } else if (serviceType.equals("BALANCE_INQUIRY")) {
            BalanceInquiryRequest req = new BalanceInquiryRequest();
            req.setUid(uidLong);
            req.setMobile(context.getMerchant().getMobile());
            req.setAadhar(context.getRequest().getAdhaarNumber());
            req.setLat(context.getRequest().getLatitude() != null ? context.getRequest().getLatitude() : "28.6139");
            req.setLog(context.getRequest().getLongitude() != null ? context.getRequest().getLongitude() : "77.2090");
            req.setBankId(bank.getId());

            populateBiometricsBI(req, parsed);

            BalanceInquiryResponse resp = balanceInquiryService.process(req);
            boolean success = "SUCCESS".equalsIgnoreCase(resp.getStatus());

            result = TransactionResult.builder()
                    .transactionId(context.getRequest().getTransactionId())
                    .referenceNumber(context.getCorrelationId())
                    .providerReference(resp.getFpTxnId())
                    .status(success ? "SUCCESS" : "FAILED")
                    .workflowState(success ? TransactionWorkflowState.SUCCESS : TransactionWorkflowState.FAILED)
                    .responseCode(resp.getResponseCode())
                    .responseMessage(resp.getMessage())
                    .amount(BigDecimal.ZERO)
                    .providerName("fingpay")
                    .completedTime(LocalDateTime.now())
                    .build();

        } else if (serviceType.equals("MINI_STATEMENT")) {
            MiniStatementRequest req = new MiniStatementRequest();
            req.setUid(uidLong);
            req.setMobile(context.getMerchant().getMobile());
            req.setAadhar(context.getRequest().getAdhaarNumber());
            req.setLat(context.getRequest().getLatitude() != null ? context.getRequest().getLatitude() : "28.6139");
            req.setLog(context.getRequest().getLongitude() != null ? context.getRequest().getLongitude() : "77.2090");
            req.setBankId(bank.getId());

            populateBiometricsMS(req, parsed);

            MiniStatementResponse resp = miniStatementService.process(req);
            boolean success = "SUCCESS".equalsIgnoreCase(resp.getStatus());

            result = TransactionResult.builder()
                    .transactionId(context.getRequest().getTransactionId())
                    .referenceNumber(context.getCorrelationId())
                    .providerReference(resp.getFpTxnId())
                    .status(success ? "SUCCESS" : "FAILED")
                    .workflowState(success ? TransactionWorkflowState.SUCCESS : TransactionWorkflowState.FAILED)
                    .responseCode(resp.getResponseCode() != null && !resp.getResponseCode().isEmpty() ? resp.getResponseCode() : (success ? "00" : "99"))
                    .responseMessage(resp.getMessage())
                    .amount(BigDecimal.ZERO)
                    .providerName("fingpay")
                    .completedTime(LocalDateTime.now())
                    .build();

        } else if (serviceType.equals("AADHAAR_PAY")) {
            AadhaarPayRequest req = new AadhaarPayRequest();
            req.setUid(uidLong);
            req.setMobile(context.getMerchant().getMobile());
            req.setAadhar(context.getRequest().getAdhaarNumber());
            req.setLat(context.getRequest().getLatitude() != null ? context.getRequest().getLatitude() : "28.6139");
            req.setLog(context.getRequest().getLongitude() != null ? context.getRequest().getLongitude() : "77.2090");
            req.setAmount(context.getRequest().getAmount().doubleValue());
            req.setBankId(bank.getId());

            populateBiometricsAP(req, parsed);

            AadhaarPayResponse resp = aadhaarPayService.process(req);
            boolean success = "SUCCESS".equalsIgnoreCase(resp.getStatus());

            result = TransactionResult.builder()
                    .transactionId(context.getRequest().getTransactionId())
                    .referenceNumber(context.getCorrelationId())
                    .providerReference(resp.getFpTxnId())
                    .status(success ? "SUCCESS" : "FAILED")
                    .workflowState(success ? TransactionWorkflowState.SUCCESS : TransactionWorkflowState.FAILED)
                    .responseCode(resp.getResponseCode())
                    .responseMessage(resp.getMessage())
                    .amount(BigDecimal.valueOf(resp.getTransactionAmount() != null ? resp.getTransactionAmount() : 0.0))
                    .providerName("fingpay")
                    .completedTime(LocalDateTime.now())
                    .build();
        } else {
            throw new AepsException("Unsupported service type for Fingpay: " + serviceType);
        }

        if (result != null && "FP069".equals(result.getResponseCode())) {
            boolean isAp = "AADHAAR_PAY".equalsIgnoreCase(serviceType);
            log.warn("Fingpay returned FP069 (2FA Required) for service: {}. Invalidating session.", serviceType);
            invalidate2faSession(context.getMerchant().getMobile(), isAp);
        }
        return result;
    }

    private void populateBiometrics(CashWithdrawalRequest req, Map<String, String> parsed) {
        req.setErrorCode(parsed.get("errCode"));
        req.setErrorInfo(parsed.get("errInfo"));
        req.setFCount(parsed.get("fCount"));
        req.setFType(parsed.get("fType"));
        req.setNmPoints(parsed.getOrDefault("nmPoints", "0"));
        req.setQScore(parsed.getOrDefault("qScore", "0"));
        req.setDpId(parsed.get("dpID"));
        req.setRdsId(parsed.get("rdsID"));
        req.setRdsVer(parsed.get("rdsVer"));
        req.setDc(parsed.get("dc"));
        req.setMi(parsed.get("mi"));
        req.setMc(parsed.get("mc"));
        req.setCi(parsed.get("ci"));
        req.setSessionKey(parsed.get("sessionKey"));
        req.setHmac(parsed.get("hmac"));
        req.setPidType(parsed.get("PidDatatype"));
        req.setPidData(parsed.get("Piddata"));
    }

    private void populateBiometricsBI(BalanceInquiryRequest req, Map<String, String> parsed) {
        req.setErrorCode(parsed.get("errCode"));
        req.setErrorInfo(parsed.get("errInfo"));
        req.setFCount(parsed.get("fCount"));
        req.setFType(parsed.get("fType"));
        req.setNmPoints(parsed.getOrDefault("nmPoints", "0"));
        req.setQScore(parsed.getOrDefault("qScore", "0"));
        req.setDpId(parsed.get("dpID"));
        req.setRdsId(parsed.get("rdsID"));
        req.setRdsVer(parsed.get("rdsVer"));
        req.setDc(parsed.get("dc"));
        req.setMi(parsed.get("mi"));
        req.setMc(parsed.get("mc"));
        req.setCi(parsed.get("ci"));
        req.setSessionKey(parsed.get("sessionKey"));
        req.setHmac(parsed.get("hmac"));
        req.setPidType(parsed.get("PidDatatype"));
        req.setPidData(parsed.get("Piddata"));
    }

    private void populateBiometricsCD(CashDepositRequest req, Map<String, String> parsed) {
        req.setErrorCode(parsed.get("errCode"));
        req.setErrorInfo(parsed.get("errInfo"));
        req.setFCount(parsed.get("fCount"));
        req.setFType(parsed.get("fType"));
        req.setNmPoints(parsed.getOrDefault("nmPoints", "0"));
        req.setQScore(parsed.getOrDefault("qScore", "0"));
        req.setDpId(parsed.get("dpID"));
        req.setRdsId(parsed.get("rdsID"));
        req.setRdsVer(parsed.get("rdsVer"));
        req.setDc(parsed.get("dc"));
        req.setMi(parsed.get("mi"));
        req.setMc(parsed.get("mc"));
        req.setCi(parsed.get("ci"));
        req.setSessionKey(parsed.get("sessionKey"));
        req.setHmac(parsed.get("hmac"));
        req.setPidType(parsed.get("PidDatatype"));
        req.setPidData(parsed.get("Piddata"));
    }

    private void populateBiometricsMS(MiniStatementRequest req, Map<String, String> parsed) {
        req.setErrorCode(parsed.get("errCode"));
        req.setErrorInfo(parsed.get("errInfo"));
        req.setFCount(parsed.get("fCount"));
        req.setFType(parsed.get("fType"));
        req.setNmPoints(parsed.getOrDefault("nmPoints", "0"));
        req.setQScore(parsed.getOrDefault("qScore", "0"));
        req.setDpId(parsed.get("dpID"));
        req.setRdsId(parsed.get("rdsID"));
        req.setRdsVer(parsed.get("rdsVer"));
        req.setDc(parsed.get("dc"));
        req.setMi(parsed.get("mi"));
        req.setMc(parsed.get("mc"));
        req.setCi(parsed.get("ci"));
        req.setSessionKey(parsed.get("sessionKey"));
        req.setHmac(parsed.get("hmac"));
        req.setPidType(parsed.get("PidDatatype"));
        req.setPidData(parsed.get("Piddata"));
    }

    private void populateBiometricsAP(AadhaarPayRequest req, Map<String, String> parsed) {
        req.setErrorCode(parsed.get("errCode"));
        req.setErrorInfo(parsed.get("errInfo"));
        req.setFCount(parsed.get("fCount"));
        req.setFType(parsed.get("fType"));
        req.setNmPoints(parsed.getOrDefault("nmPoints", "0"));
        req.setQScore(parsed.getOrDefault("qScore", "0"));
        req.setDpId(parsed.get("dpID"));
        req.setRdsId(parsed.get("rdsID"));
        req.setRdsVer(parsed.get("rdsVer"));
        req.setDc(parsed.get("dc"));
        req.setMi(parsed.get("mi"));
        req.setMc(parsed.get("mc"));
        req.setCi(parsed.get("ci"));
        req.setSessionKey(parsed.get("sessionKey"));
        req.setHmac(parsed.get("hmac"));
        req.setPidType(parsed.get("PidDatatype"));
        req.setPidData(parsed.get("Piddata"));
    }

    private Map<String, String> parsePidXml(String pidXml) throws Exception {
        Map<String, String> map = new HashMap<>();
        
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        DocumentBuilder builder = factory.newDocumentBuilder();
        Document doc = builder.parse(new ByteArrayInputStream(pidXml.trim().getBytes(StandardCharsets.UTF_8)));
        
        Element root = doc.getDocumentElement();
        
        NodeList respList = root.getElementsByTagName("Resp");
        if (respList.getLength() > 0) {
            Element resp = (Element) respList.item(0);
            map.put("errCode", resp.getAttribute("errCode"));
            map.put("errInfo", resp.getAttribute("errInfo"));
            map.put("fCount", resp.getAttribute("fCount"));
            String rawFType = resp.getAttribute("fType");
            String normalizedFType = ("1".equals(rawFType) || "FIR".equalsIgnoreCase(rawFType)) ? "1" : "0";
            map.put("fType", normalizedFType);
            map.put("iCount", resp.getAttribute("iCount"));
            map.put("iType", resp.getAttribute("iType"));
            map.put("pCount", resp.getAttribute("pCount"));
            map.put("pType", resp.getAttribute("pType"));
            map.put("nmPoints", resp.getAttribute("nmPoints"));
            map.put("qScore", resp.getAttribute("qScore"));
        }
        
        NodeList devInfoList = root.getElementsByTagName("DeviceInfo");
        if (devInfoList.getLength() > 0) {
            Element devInfo = (Element) devInfoList.item(0);
            String dpID = devInfo.getAttribute("dpID");
            map.put("dpID", dpID.isEmpty() ? devInfo.getAttribute("dpId") : dpID);
            String rdsID = devInfo.getAttribute("rdsID");
            map.put("rdsID", rdsID.isEmpty() ? devInfo.getAttribute("rdsId") : rdsID);
            map.put("rdsVer", devInfo.getAttribute("rdsVer"));
            map.put("dc", devInfo.getAttribute("dc"));
            map.put("mi", devInfo.getAttribute("mi"));
            map.put("mc", devInfo.getAttribute("mc"));
        }
        
        NodeList skeyList = root.getElementsByTagName("Skey");
        if (skeyList.getLength() > 0) {
            Element skey = (Element) skeyList.item(0);
            map.put("ci", skey.getAttribute("ci"));
            map.put("sessionKey", skey.getTextContent().trim());
        }
        
        NodeList hmacList = root.getElementsByTagName("Hmac");
        if (hmacList.getLength() > 0) {
            map.put("hmac", hmacList.item(0).getTextContent().trim());
        }
        
        NodeList dataList = root.getElementsByTagName("Data");
        if (dataList.getLength() > 0) {
            Element data = (Element) dataList.item(0);
            String dataType = data.getAttribute("type");
            String fType = map.get("fType");
            if ("1".equals(fType) || "FIR".equalsIgnoreCase(dataType)) {
                dataType = "FIR";
            } else {
                dataType = "FMR";
            }
            map.put("PidDatatype", dataType);
            map.put("Piddata", data.getTextContent().trim());
        }
        
        return map;
    }

    /**
     * Maps standard Indian 2-letter state abbreviations to Fingpay integer state codes.
     * Fingpay uses numeric IDs that correspond to Indian state numbering.
     */
    private int resolveStateCode(String stateCode) {
        if (stateCode == null) return 1;
        Map<String, Integer> stateMap = new HashMap<>();
        stateMap.put("AN", 35); // Andaman and Nicobar Islands
        stateMap.put("AP", 37); // Andhra Pradesh
        stateMap.put("AR", 12); // Arunachal Pradesh
        stateMap.put("AS", 18); // Assam
        stateMap.put("BR", 10); // Bihar
        stateMap.put("CG", 22); // Chhattisgarh
        stateMap.put("CH", 4);  // Chandigarh
        stateMap.put("DD", 26); // Daman and Diu
        stateMap.put("DL", 7);  // Delhi
        stateMap.put("DN", 26); // Dadra and Nagar Haveli
        stateMap.put("GA", 30); // Goa
        stateMap.put("GJ", 24); // Gujarat
        stateMap.put("HP", 2);  // Himachal Pradesh
        stateMap.put("HR", 6);  // Haryana
        stateMap.put("JH", 20); // Jharkhand
        stateMap.put("JK", 1);  // Jammu and Kashmir
        stateMap.put("KA", 29); // Karnataka
        stateMap.put("KL", 32); // Kerala
        stateMap.put("LA", 38); // Ladakh
        stateMap.put("LD", 31); // Lakshadweep
        stateMap.put("MH", 27); // Maharashtra
        stateMap.put("ML", 17); // Meghalaya
        stateMap.put("MN", 14); // Manipur
        stateMap.put("MP", 23); // Madhya Pradesh
        stateMap.put("MZ", 15); // Mizoram
        stateMap.put("NL", 13); // Nagaland
        stateMap.put("OD", 21); // Odisha
        stateMap.put("OR", 21); // Odisha (alternate)
        stateMap.put("PB", 3);  // Punjab
        stateMap.put("PY", 34); // Puducherry
        stateMap.put("RJ", 8);  // Rajasthan
        stateMap.put("SK", 11); // Sikkim
        stateMap.put("TG", 36); // Telangana
        stateMap.put("TN", 33); // Tamil Nadu
        stateMap.put("TR", 16); // Tripura
        stateMap.put("UK", 5);  // Uttarakhand
        stateMap.put("UP", 9);  // Uttar Pradesh
        stateMap.put("WB", 19); // West Bengal
        return stateMap.getOrDefault(stateCode.toUpperCase().trim(), 27); // default to Maharashtra
    }

    /**
     * Safely strips data URI scheme prefix (e.g. data:image/png;base64,...) from Base64 string if present.
     */
    private String cleanBase64(String val) {
        if (val == null || val.isBlank()) return null;
        val = val.trim();
        if (val.contains(",")) {
            val = val.substring(val.indexOf(",") + 1).trim();
        }
        return val.isEmpty() ? null : val;
    }

    /**
     * Safely parses a coordinate string, returning the defaultValue if null/blank/invalid.
     */
    private double parseCoordinate(String value, double defaultValue) {
        if (value == null || value.isBlank()) return defaultValue;
        try {
            return Double.parseDouble(value.trim());
        } catch (NumberFormatException e) {
            log.warn("Invalid coordinate value '{}', using default {}", value, defaultValue);
            return defaultValue;
        }
    }

    private AepsProperties.ProviderConfig getFingpayConfig() {
        AepsProperties.ProviderConfig config = aepsProperties.getProviders().get("fingpay");
        if (config == null || config.getBaseUrl() == null) {
            throw new AepsException("Fingpay AEPS provider configuration is missing or incomplete.");
        }
        return config;
    }

    private void invalidate2faSession(String mobile, boolean isAp) {
        try {
            Optional<com.rupiksha.aeps.entity.User> aepsUserOpt = aepsUserRepository.findByMobile(mobile)
                    .or(() -> aepsUserRepository.findByUsername(mobile));
            if (aepsUserOpt.isPresent()) {
                com.rupiksha.aeps.entity.User aepsUser = aepsUserOpt.get();
                if (isAp) {
                    aepsUser.setAepsAp2faSessionId(null);
                    aepsUser.setAepsAp2faAuthenticatedAt(null);
                } else {
                    aepsUser.setAeps2faSessionId(null);
                    aepsUser.setAeps2faAuthenticatedAt(null);
                }
                aepsUserRepository.save(aepsUser);
            }
            mainUserRepository.findByMobile(mobile).ifPresent(mu -> {
                if (isAp) {
                    mu.setAepsAp2faSessionId(null);
                    mu.setAepsAp2faAuthenticatedAt(null);
                } else {
                    mu.setAeps2faSessionId(null);
                    mu.setAeps2faAuthenticatedAt(null);
                }
                mainUserRepository.save(mu);
            });
            log.info("Successfully invalidated daily 2FA session for mobile: {} (AadhaarPay={})", mobile, isAp);
        } catch (Exception e) {
            log.error("Failed to invalidate daily 2FA session: {}", e.getMessage(), e);
        }
    }
}
