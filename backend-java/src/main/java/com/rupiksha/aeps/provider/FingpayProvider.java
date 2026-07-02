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

    private final EkycTxnRepo ekycTxnRepo;
    private final AepsKycRepository aepsKycRepo;
    private final FingBankRepository bankRepo;
    private final FingUserRepository fingUserRepository;

    private final AepsProperties aepsProperties;
    private final ObjectMapper objectMapper;
    private final com.rupiksha.backend.repository.UserRepository mainUserRepository;

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

        OnboardRequestDTO dto = new OnboardRequestDTO();
        
        MerchantDTO merchant = new MerchantDTO();
        merchant.setMerchantLoginId(request.getAepsMobile());
        merchant.setMerchantLoginPin("1234"); // default PIN
        merchant.setFirstName(request.getFname());
        merchant.setLastName(request.getLname());
        merchant.setMiddleName(request.getMiddlename() != null ? request.getMiddlename() : "");
        merchant.setMerchantPhoneNumber(request.getAepsMobile());
        merchant.setEmailId(request.getEmail());
        
        MerchantAddressDTO address = new MerchantAddressDTO();
        address.setMerchantAddress1(request.getAddress());
        address.setMerchantAddress2("");
        address.setMerchantCityName(request.getCity());
        address.setMerchantDistrictName(request.getCity());
        address.setMerchantState(1);
        address.setMerchantPinCode(request.getPinCode());
        merchant.setMerchantAddress(address);
        
        merchant.setCompanyLegalName(request.getShopName());
        merchant.setCompanyType(1); // Individual/Proprietorship
        
        KycDTO kyc = new KycDTO();
        kyc.setAadhaarNumber(request.getAadharNumber());
        kyc.setUserPan(request.getPanCard());
        merchant.setKyc(kyc);
        
        SettlementDTO settlement = new SettlementDTO();
        settlement.setCompanyBankAccountNumber("1234567890");
        settlement.setBankIfscCode("UTIB0000001");
        settlement.setCompanyBankName("AXIS BANK");
        settlement.setBankAccountName(request.getFname() + " " + request.getLname());
        merchant.setSettlementV1(settlement);
        
        dto.setMerchant(merchant);
        dto.setLatitude(Double.parseDouble(request.getLatitude()));
        dto.setLongitude(Double.parseDouble(request.getLongitude()));

        try {
            String rawResponse = onboardService.onboard(dto);
            JsonNode node = objectMapper.readTree(rawResponse);
            
            String status = node.path("status").asText("FAILED");
            String message = node.path("message").asText("Onboarding failed");
            Integer statusId = node.path("statusId").asInt(0);
            String merchantId = node.path("merchantId").asText("");
            
            boolean isSuccess = statusId == 1 || status.equalsIgnoreCase("SUCCESS") || message.toLowerCase().contains("already");

            OnboardingResponse response = new OnboardingResponse();
            response.setStatus(isSuccess ? "SUCCESS" : "FAILED");
            response.setStatusId(isSuccess ? 1 : 0);
            response.setMessage(message);
            response.setAgentId(request.getAepsMobile());
            response.setMerchantId(merchantId.isEmpty() ? request.getAepsMobile() : merchantId);
            response.setCorrelationId(node.path("correlationId").asText(""));

            if (isSuccess) {
                // Populate Fingpay mappings locally
                com.rupiksha.backend.domain.User mainUser = mainUserRepository.findByMobile(request.getAepsMobile())
                        .orElseThrow(() -> new ProviderException("Core user profile not found for mobile: " + request.getAepsMobile()));
                
                long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;

                // Create AepsKyc entry
                AepsKyc aepsKyc = aepsKycRepo.findByUid(uidLong).orElse(new AepsKyc());
                aepsKyc.setUid(uidLong);
                aepsKyc.setOutlet(response.getAgentId());
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
            
            String encodeFPTxnId = node.path("encodeFPTxnId").asText();
            Long primaryKeyId = node.path("primaryKeyId").asLong();

            // Save pidXml securely (Base64 encoded) with 5-minute expiry in ekyc_txn
            EkycTxn ekycTxn = ekycTxnRepo.findByMerchantLoginId(request.getAepsAgentId())
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
            throw new ProviderException("Fingpay KYC initialization failed: " + e.getMessage(), e);
        }
    }

    @Override
    public ProviderKycResult verifyOtp(AepsOtpVerifyRequest request) {
        log.info("FingpayProvider verifying OTP and completing biometric eKYC for agent: {}", request.getAepsAgentId());

        EkycTxn ekycTxn = ekycTxnRepo.findByMerchantLoginId(request.getAepsAgentId())
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
            Map<String, String> parsed = parsePidXml(rawPidXml);

            BiometricRequestDTO.CaptureResponse capture = new BiometricRequestDTO.CaptureResponse();
            capture.setErrCode(parsed.get("errCode"));
            capture.setErrInfo(parsed.get("errInfo"));
            capture.setFCount(parsed.get("fCount"));
            capture.setFType(parsed.get("fType"));
            capture.setICount(parsed.getOrDefault("iCount", "0"));
            capture.setIType(parsed.getOrDefault("iType", "0"));
            capture.setPCount(parsed.getOrDefault("pCount", "0"));
            capture.setPType(parsed.getOrDefault("pType", "0"));
            capture.setNmPoints(parsed.getOrDefault("nmPoints", "0"));
            capture.setQScore(parsed.getOrDefault("qScore", "0"));
            capture.setDpID(parsed.get("dpID"));
            capture.setRdsID(parsed.get("rdsID"));
            capture.setRdsVer(parsed.get("rdsVer"));
            capture.setDc(parsed.get("dc"));
            capture.setMi(parsed.get("mi"));
            capture.setMc(parsed.get("mc"));
            capture.setCi(parsed.get("ci"));
            capture.setSessionKey(parsed.get("sessionKey"));
            capture.setHmac(parsed.get("hmac"));
            capture.setPidDatatype(parsed.get("PidDatatype"));
            capture.setPiddata(parsed.get("Piddata"));
            biometricDto.setCaptureResponse(capture);

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
        log.info("FingpayProvider simulating successful Daily 2FA authentication.");
        return ProviderKycResult.builder()
                .workflowState(AepsWorkflowState.READY_FOR_DAILY_2FA)
                .providerTxnId("FGP2FA" + System.currentTimeMillis())
                .providerReference("FGPREF" + System.currentTimeMillis())
                .message("Fingpay Daily 2FA verified (Simulated).")
                .build();
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

            return TransactionResult.builder()
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

            return TransactionResult.builder()
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

            return TransactionResult.builder()
                    .transactionId(context.getRequest().getTransactionId())
                    .referenceNumber(context.getCorrelationId())
                    .providerReference(resp.getFpTxnId())
                    .status(success ? "SUCCESS" : "FAILED")
                    .workflowState(success ? TransactionWorkflowState.SUCCESS : TransactionWorkflowState.FAILED)
                    .responseCode("00")
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

            return TransactionResult.builder()
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
            map.put("fType", resp.getAttribute("fType"));
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
            map.put("PidDatatype", data.getAttribute("type"));
            map.put("Piddata", data.getTextContent().trim());
        }
        
        return map;
    }

    private AepsProperties.ProviderConfig getFingpayConfig() {
        AepsProperties.ProviderConfig config = aepsProperties.getProviders().get("fingpay");
        if (config == null || config.getBaseUrl() == null) {
            throw new AepsException("Fingpay AEPS provider configuration is missing or incomplete.");
        }
        return config;
    }
}
