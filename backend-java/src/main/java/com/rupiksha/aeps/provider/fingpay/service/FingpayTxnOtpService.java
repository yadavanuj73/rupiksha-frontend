package com.rupiksha.aeps.provider.fingpay.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.provider.fingpay.dto.FingpayTxnOtpRequestDTO;
import com.rupiksha.aeps.provider.fingpay.dto.FingpayTxnOtpResponseDTO;
import com.rupiksha.aeps.provider.fingpay.entity.AepsKyc;
import com.rupiksha.aeps.provider.fingpay.entity.FingBank;
import com.rupiksha.aeps.provider.fingpay.entity.FingUser;
import com.rupiksha.aeps.provider.fingpay.repository.AepsKycRepository;
import com.rupiksha.aeps.provider.fingpay.repository.FingBankRepository;
import com.rupiksha.aeps.provider.fingpay.repository.FingUserRepository;
import com.rupiksha.aeps.provider.fingpay.util.FingpayEncryptionUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class FingpayTxnOtpService {

    private final FingpayEncryptionUtil encryptionUtil;
    private final FingBankRepository bankRepo;
    private final AepsKycRepository aepsKycRepo;
    private final FingUserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${fingpay.otp.url:https://fingpayap.tapits.in/fpaepsservice/api/auth/merchant/send/otp}")
    private String otpUrl;

    @Value("${fingpay.device.imei:10068311}")
    private String defaultDeviceImei;

    @Value("${fingpay.supermerchant.id:1407}")
    private Integer superMerchantId;

    public FingpayTxnOtpResponseDTO sendOtp(FingpayTxnOtpRequestDTO req) {
        String txnId = "OTP" + System.currentTimeMillis();

        try {
            // 1. Resolve Bank IIN
            String bankSearch = req.getBankId();
            FingBank bank = null;
            if (bankSearch != null && !bankSearch.isBlank()) {
                String trimmed = bankSearch.trim();
                if (trimmed.matches("\\d+")) {
                    try {
                        long bankIdLong = Long.parseLong(trimmed);
                        bank = bankRepo.findById(bankIdLong).orElse(null);
                    } catch (Exception ignored) {}
                    if (bank == null) {
                        bank = bankRepo.findAll().stream()
                                .filter(b -> b.getIinno() != null && b.getIinno().equals(trimmed))
                                .findFirst()
                                .orElse(null);
                    }
                }
                if (bank == null) {
                    String searchLower = trimmed.toLowerCase();
                    bank = bankRepo.findAll().stream()
                            .filter(b -> b.getBankName() != null && (
                                    b.getBankName().toLowerCase().equals(searchLower) ||
                                    b.getBankName().toLowerCase().contains(searchLower) ||
                                    searchLower.contains(b.getBankName().toLowerCase())
                            ))
                            .findFirst()
                            .orElse(null);
                }
            }
            if (bank == null) {
                log.warn("Bank not found for '{}', fallback to first or default IIN", bankSearch);
                bank = bankRepo.findAll().stream().findFirst().orElse(null);
            }
            String iin = (bank != null && bank.getIinno() != null && !bank.getIinno().isBlank())
                    ? bank.getIinno()
                    : "607152";

            // 2. Resolve merchant credentials
            AepsKyc kyc = req.getUid() != null ? aepsKycRepo.findByUid(req.getUid()).orElse(null) : null;
            String merchantUserName = null;
            String rawPin = null;

            if (kyc != null && kyc.getOutlet() != null && !kyc.getOutlet().isBlank()) {
                merchantUserName = kyc.getOutlet();
                rawPin = kyc.getMpin();
            }

            if (rawPin == null || rawPin.isBlank()) {
                if (req.getUid() != null) {
                    FingUser fu = userRepo.findById(req.getUid()).orElse(null);
                    if (fu != null) {
                        rawPin = fu.getPin();
                    }
                }
            }

            if (merchantUserName == null || merchantUserName.isBlank()) {
                merchantUserName = req.getMerchantUserName() != null ? req.getMerchantUserName() : String.valueOf(req.getUid());
            }
            if (rawPin == null || rawPin.isBlank()) {
                rawPin = req.getMerchantPin() != null ? req.getMerchantPin() : "1234";
            }

            // 3. Setup transactionType & serviceType mapping per Fingpay documentation:
            // For Cash Withdrawal: transactionType = "CO", serviceType = "CW"
            // For Aadhaar Pay: transactionType = "MO", serviceType = "AP"
            boolean isAadhaarPay = "AADHAAR_PAY".equalsIgnoreCase(req.getServiceType()) ||
                    "AP".equalsIgnoreCase(req.getServiceType()) ||
                    "MO".equalsIgnoreCase(req.getTransactionType());

            String transactionType = isAadhaarPay ? "MO" : "CO";
            String serviceType = isAadhaarPay ? "AP" : "CW";
            String defaultRemarks = isAadhaarPay ? "AadhaarPay OTP request" : "Cash withdrawal OTP request";

            // 4. Setup cardnumberORUID
            Map<String, Object> cardOrUID = new LinkedHashMap<>();
            cardOrUID.put("nationalBankIdentificationNumber", iin);

            boolean isVirtualId = (req.getAdhaarNumber() != null && req.getAdhaarNumber().length() == 16) ||
                    (req.getVirtualId() != null && !req.getVirtualId().isBlank());

            if (isVirtualId) {
                String vid = (req.getVirtualId() != null && !req.getVirtualId().isBlank())
                        ? req.getVirtualId()
                        : req.getAdhaarNumber();
                cardOrUID.put("indicatorforUID", 2);
                cardOrUID.put("adhaarNumber", "999999999999");
                cardOrUID.put("virtualId", vid);
            } else {
                cardOrUID.put("indicatorforUID", "0");
                cardOrUID.put("adhaarNumber", req.getAdhaarNumber());
                cardOrUID.put("virtualId", req.getVirtualId() != null ? req.getVirtualId() : "");
            }

            // 5. Build Plain JSON Payload
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("transactionType", transactionType);
            payload.put("serviceType", serviceType);
            payload.put("mobileNumber", req.getMobileNumber());
            payload.put("latitude", req.getLatitude() != null ? req.getLatitude() : 28.6139);
            payload.put("longitude", req.getLongitude() != null ? req.getLongitude() : 77.2090);
            payload.put("requestRemarks", req.getRequestRemarks() != null && !req.getRequestRemarks().isBlank() ? req.getRequestRemarks() : defaultRemarks);
            payload.put("paymentType", "AEPS");
            payload.put("merchantTransactionId", txnId);
            payload.put("superMerchantId", superMerchantId != null ? superMerchantId : 1407);
            payload.put("merchantUserName", merchantUserName);
            payload.put("merchantPin", md5(rawPin));
            payload.put("transactionAmount", req.getTransactionAmount());
            payload.put("cardnumberORUID", cardOrUID);

            String plainJson = objectMapper.writeValueAsString(payload);
            log.info("Fingpay OTP Plain Request (for Amount > 5000): txnId={}, mobile={}, amount={}, bankIIN={}, txnType={}, srvType={}",
                    txnId, req.getMobileNumber(), req.getTransactionAmount(), iin, transactionType, serviceType);

            // 6. Encrypt with Session Key, generate SHA-256 hash and RSA eskey
            SecretKey sessionKey = encryptionUtil.generateSessionKey();
            String eskey = encryptionUtil.encryptSessionKey(sessionKey);
            String encryptedBody = encryptionUtil.encryptBody(plainJson, sessionKey);
            String hash = encryptionUtil.generateHash(plainJson);

            // Device IMEI / Serial
            String activeImei = defaultDeviceImei;
            if (req.getDeviceId() != null && !req.getDeviceId().isBlank() &&
                    !req.getDeviceId().equalsIgnoreCase("unknown") &&
                    !req.getDeviceId().equalsIgnoreCase("WEB-SCANNER-001")) {
                activeImei = req.getDeviceId().trim();
            }

            // 7. Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);
            headers.set("trnTimestamp", encryptionUtil.timestamp());
            headers.set("hash", hash);
            headers.set("deviceIMEI", activeImei);
            headers.set("eskey", eskey);

            // 8. API call to Fingpay OTP Endpoint
            HttpEntity<String> entity = new HttpEntity<>(encryptedBody, headers);
            log.info("Sending Fingpay OTP request to: {}", otpUrl);
            ResponseEntity<String> httpResp = restTemplate.exchange(otpUrl, HttpMethod.POST, entity, String.class);

            log.info("Fingpay OTP Raw Response for txnId {}: {}", txnId, httpResp.getBody());

            // 9. Parse Response
            JsonNode root = objectMapper.readTree(httpResp.getBody());
            boolean status = root.path("status").asBoolean(false) ||
                    "true".equalsIgnoreCase(root.path("status").asText("")) ||
                    "SUCCESS".equalsIgnoreCase(root.path("status").asText(""));
            String message = root.path("message").asText("Unable to process request");
            long statusCode = root.path("statusCode").asLong(status ? 10000L : 10001L);

            JsonNode data = root.path("data");
            String fpTransactionId = null;
            String merchantTxnId = txnId;
            String bankRRN = null;
            String responseCode = null;
            String bankResponseMessage = null;
            String transactionTimestamp = null;
            Double transactionAmount = req.getTransactionAmount();
            String transactionStatus = null;

            if (data != null && !data.isMissingNode() && !data.isNull()) {
                fpTransactionId = data.path("fpTransactionId").asText(data.path("fingpayTransactionId").asText(null));
                merchantTxnId = data.path("merchantTxnId").asText(data.path("merchantTransactionId").asText(txnId));
                bankRRN = data.path("bankRRN").asText(null);
                responseCode = data.path("responseCode").asText(null);
                bankResponseMessage = data.path("bankResponseMessage").asText(null);
                transactionTimestamp = data.path("transactionTimestamp").asText(null);
                if (data.has("transactionAmount")) {
                    transactionAmount = data.path("transactionAmount").asDouble(req.getTransactionAmount());
                }
                transactionStatus = data.path("transactionStatus").asText(null);
            }

            if (status && fpTransactionId != null && !fpTransactionId.isBlank()) {
                log.info("Fingpay OTP generated successfully! fpTransactionId: {}, merchantTxnId: {}", fpTransactionId, merchantTxnId);
                return FingpayTxnOtpResponseDTO.builder()
                        .status(true)
                        .message(message != null && !message.isBlank() ? message : "OTP sent successfully to Aadhaar linked mobile.")
                        .statusCode(statusCode)
                        .fpTransactionId(fpTransactionId)
                        .merchantTxnId(merchantTxnId)
                        .bankRRN(bankRRN)
                        .responseCode(responseCode)
                        .bankResponseMessage(bankResponseMessage)
                        .transactionTimestamp(transactionTimestamp)
                        .transactionAmount(transactionAmount)
                        .transactionStatus(transactionStatus)
                        .transactionType(serviceType)
                        .build();
            } else {
                log.warn("Fingpay OTP generation failed: message='{}', statusCode={}", message, statusCode);
                return FingpayTxnOtpResponseDTO.builder()
                        .status(false)
                        .message(message != null && !message.isBlank() ? message : "Failed to generate Aadhaar OTP for transaction.")
                        .statusCode(statusCode)
                        .fpTransactionId(fpTransactionId)
                        .merchantTxnId(merchantTxnId)
                        .build();
            }

        } catch (Exception e) {
            log.error("Fingpay OTP generation exception: {}", e.getMessage(), e);
            return FingpayTxnOtpResponseDTO.builder()
                    .status(false)
                    .message("Fingpay OTP generation error: " + e.getMessage())
                    .statusCode(10001L)
                    .merchantTxnId(txnId)
                    .build();
        }
    }

    private String md5(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
