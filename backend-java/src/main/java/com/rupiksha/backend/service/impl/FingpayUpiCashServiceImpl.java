package com.rupiksha.backend.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.provider.fingpay.entity.AepsKyc;
import com.rupiksha.aeps.provider.fingpay.repository.AepsKycRepository;
import com.rupiksha.aeps.repository.AepsUserRepository;
import com.rupiksha.backend.api.dto.FingpayUpiCashDtos.*;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.FingpayUpiCashTransactionRepository;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.UserServiceRepository;
import com.rupiksha.backend.service.FingpayUpiCashService;
import com.rupiksha.backend.service.WalletService;
import com.rupiksha.backend.util.FingpayUpiCashCryptoUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class FingpayUpiCashServiceImpl implements FingpayUpiCashService {

    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal MIN_AMOUNT = new BigDecimal("100.00");
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("5000.00");
    private static final BigDecimal AMOUNT_MULTIPLE = new BigDecimal("100.00");

    private final UserRepository userRepository;
    private final UserServiceRepository userServiceRepository;
    private final AepsKycRepository aepsKycRepository;
    private final AepsUserRepository aepsUserRepository;
    private final TxnRepository txnRepository;
    private final FingpayUpiCashTransactionRepository upiTransactionRepository;
    private final WalletService walletService;
    private final FingpayUpiCashCryptoUtil cryptoUtil;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${fingpay.upicw.initiate-url:https://fingpayap.tapits.in/fpaepsservice/api/upicw/partner/initiate/payment}")
    private String initiateUrl;

    @Value("${fingpay.upicw.initiate-url-uat:https://fpuat.tapits.in/fpaepsservice/api/upicw/partner/initiate/payment}")
    private String initiateUrlUat;

    @Value("${fingpay.upicw.status-url:https://fingpayap.tapits.in/fpaepsservice/api/upicw/partner/check/status}")
    private String statusUrl;

    @Value("${fingpay.upicw.status-url-uat:https://fpuat.tapits.in/fpaepsservice/api/upicw/partner/check/status}")
    private String statusUrlUat;

    @Value("${fingpay.upicw.recon-url:https://fpservices.tapits.in/fpcollectservice/api/threeway/v1/partner/upicw}")
    private String reconUrl;

    @Value("${fingpay.upicw.recon-url-uat:https://fpuat.tapits.in/fpcollectservice/api/threeway/v1/partner/upicw}")
    private String reconUrlUat;

    @Value("${fingpay.upicw.supermerchant-id:1407}")
    private String superMerchantId;

    @Value("${fingpay.upicw.secret-key:1234567890;}")
    private String secretKey;

    @Value("${fingpay.upicw.use-uat:false}")
    private boolean useUat;

    @Value("${fingpay.upicw.merchant-daily-limit:30000}")
    private BigDecimal configuredDailyLimit;

    @Value("${fingpay.upicw.default-merchant-id:}")
    private String defaultMerchantId;

    @Value("${fingpay.upicw.default-merchant-pin:}")
    private String defaultMerchantPin;


    @Override
    @Transactional
    public InitiateResponse initiatePayment(UUID userId, InitiateRequest request, String ipAddress) {
        log.info("Initiating UPI Cash Withdrawal for userId: {}, amount: {}, ip: {}", userId, request.getAmount(), ipAddress);

        // 1. Authenticate & validate user
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User account not found: " + userId));

        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new IllegalStateException("Your account is not active. Status: " + user.getStatus());
        }

        // Verify service enablement
        Optional<UserService> serviceOpt = userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.UPI_CASH_POINT);
        if (serviceOpt.isPresent() && Boolean.FALSE.equals(serviceOpt.get().getIsEnabled())) {
            throw new IllegalStateException("UPI Cash Point service is disabled for your account. Please contact administrator.");
        }

        // 2. Amount and business rules validation per Fingpay NPCI specification
        BigDecimal amount = request.getAmount().setScale(2, RoundingMode.HALF_UP);
        validateAmount(amount);
        validateOperatingWindow();
        validateCoordinates(request.getLatitude(), request.getLongitude());
        validateDailyLimit(user, amount);

        // 3. Resolve existing Fingpay merchant mapping & PIN
        String bcLoginId = resolveMerchantId(user);
        String rawPin = resolveMerchantPin(user);
        String md5Pin = (rawPin != null && rawPin.matches("^[a-fA-F0-9]{32}$"))
                ? rawPin.toLowerCase()
                : cryptoUtil.md5(rawPin);

        log.info("Initiating UPI Cash Withdrawal: user={}, username={}, bcLoginId={}, hasMpin={}, pinLength={}",
                user.getId(), user.getUsername(), maskString(bcLoginId), rawPin != null && !rawPin.isBlank(), rawPin != null ? rawPin.length() : 0);

        // 4. Generate unique partnerRequestId
        String partnerRequestId = "RXUPI" + System.currentTimeMillis() + (int)(Math.random() * 9000 + 1000);

        // 5. Construct plain JSON request payload matching provider contract
        Map<String, Object> payloadMap = new LinkedHashMap<>();
        payloadMap.put("bcLoginId", bcLoginId);
        payloadMap.put("bcLoginPin", md5Pin);
        payloadMap.put("amount", amount.toPlainString());
        payloadMap.put("bcLatitude", request.getLatitude());
        payloadMap.put("bcLongitude", request.getLongitude());
        payloadMap.put("partnerRequestId", partnerRequestId);
        payloadMap.put("transactionType", "UPICW");
        if (request.getRemarks() != null && !request.getRemarks().isBlank()) {
            payloadMap.put("remarks", request.getRemarks().trim());
        }

        String plainJson;
        try {
            plainJson = objectMapper.writeValueAsString(payloadMap);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize initiate request: " + e.getMessage(), e);
        }

        // 6. Persist initial transaction record in DB for durability
        FingpayUpiCashTransaction txn = new FingpayUpiCashTransaction();
        txn.setUser(user);
        txn.setPartnerRequestId(partnerRequestId);
        txn.setBcLoginId(bcLoginId);
        txn.setAmount(amount);
        txn.setTransactionType("UPICW");
        txn.setInternalStatus("INITIATED");
        txn.setProviderStatus("PENDING");
        txn.setBcLatitude(BigDecimal.valueOf(request.getLatitude()));
        txn.setBcLongitude(BigDecimal.valueOf(request.getLongitude()));
        txn.setRemarks(request.getRemarks());
        txn.setCreatedAt(Instant.now());
        txn.setUpdatedAt(Instant.now());
        upiTransactionRepository.save(txn);

        // 7. Cryptographic preparation
        String targetUrl = useUat ? initiateUrlUat : initiateUrl;
        log.info("Sending initiate payment to Fingpay endpoint: {} with partnerRequestId: {}", targetUrl, partnerRequestId);

        String rawResponse = null;
        try {
            String timestamp = cryptoUtil.currentTimestamp();
            String hash = cryptoUtil.generateHash(plainJson, secretKey);
            byte[] sessionKey = cryptoUtil.generateSessionKey();
            String eskey = cryptoUtil.encryptSessionKey(sessionKey);
            String encryptedBody = cryptoUtil.encryptPayload(sessionKey, plainJson.getBytes(StandardCharsets.UTF_8));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);
            headers.set("trnTimestamp", timestamp);
            headers.set("hash", hash);
            headers.set("eskey", eskey);
            headers.set("superMerchantId", superMerchantId);

            HttpEntity<String> entity = new HttpEntity<>(encryptedBody, headers);
            ResponseEntity<String> responseEntity = restTemplate.exchange(targetUrl, HttpMethod.POST, entity, String.class);
            rawResponse = responseEntity.getBody();
            log.info("Fingpay initiation raw response: {}", rawResponse);

        } catch (Exception ex) {
            log.error("Fingpay initiation request call failed for {}: {}", partnerRequestId, ex.getMessage(), ex);
            txn.setInternalStatus("FAILED");
            txn.setProviderStatus("FAILED");
            txn.setErrorMessage("Provider communication failed: " + ex.getMessage());
            txn.setUpdatedAt(Instant.now());
            upiTransactionRepository.save(txn);

            return InitiateResponse.builder()
                    .success(false)
                    .message("Payment initiation failed: " + ex.getMessage())
                    .partnerRequestId(partnerRequestId)
                    .amount(amount)
                    .build();
        }

        // 8. Parse provider response
        txn.setRawInitiateResponse(rawResponse);
        try {
            JsonNode root = objectMapper.readTree(rawResponse);
            boolean statusSuccess = root.path("status").asBoolean(false)
                    || "SUCCESS".equalsIgnoreCase(root.path("status").asText(""));
            String message = root.path("message").asText("Request Completed");
            JsonNode data = root.path("data");

            if (statusSuccess && data != null && !data.isMissingNode() && !data.isNull()) {
                String intentLink = data.path("intentLink").asText(null);
                String fpTxnId = data.path("fpTxnId").asText(data.path("fpayTxnId").asText(null));
                String vpa = data.path("vpa").asText(null);
                String expiryDateStr = data.path("expiryDate").asText(null);
                String qrExpiryNote = data.path("qrExpiryNote").asText(null);
                int qrExpiryIn = data.path("qrExpiryIn").asInt(60);
                int statusCheckAttempts = data.path("statusCheckAttempts").asInt(3);
                int statusCheckGap = data.path("statusCheckGap").asInt(30);
                int statusCheckStartIn = data.path("statusCheckStartIn").asInt(60);
                String responseCode = data.path("responseCode").asText("00");
                String responseMessage = data.path("responseMessage").asText("SUCCESS");

                // Update transaction entity
                txn.setInternalStatus("QR_GENERATED");
                txn.setProviderStatus("PENDING");
                txn.setFpTransactionId(fpTxnId);
                txn.setIntentLink(intentLink);
                txn.setVpa(vpa);
                txn.setQrExpiryIn(qrExpiryIn);
                txn.setQrExpiryNote(qrExpiryNote);
                txn.setStatusCheckAttempts(statusCheckAttempts);
                txn.setStatusCheckGap(statusCheckGap);
                txn.setStatusCheckStartIn(statusCheckStartIn);
                txn.setResponseCode(responseCode);
                txn.setResponseMessage(responseMessage);
                if (expiryDateStr != null && !expiryDateStr.isBlank()) {
                    txn.setQrExpiryDate(parseIsoInstant(expiryDateStr, qrExpiryIn));
                } else {
                    txn.setQrExpiryDate(Instant.now().plusSeconds(qrExpiryIn));
                }
                txn.setUpdatedAt(Instant.now());

                // Create core ledger record
                Txn coreTxn = new Txn();
                coreTxn.setUser(user);
                coreTxn.setServiceType("UPI_CASH_WITHDRAWAL");
                coreTxn.setAmount(amount);
                coreTxn.setStatus(TransactionStatus.INITIATED);
                coreTxn.setProviderRef(fpTxnId != null ? fpTxnId : partnerRequestId);
                coreTxn.setIdempotencyKey(partnerRequestId);
                txnRepository.save(coreTxn);
                txn.setTxn(coreTxn);

                upiTransactionRepository.save(txn);

                return InitiateResponse.builder()
                        .success(true)
                        .status("QR_GENERATED")
                        .message(message)
                        .partnerRequestId(partnerRequestId)
                        .fpTxnId(fpTxnId)
                        .intentLink(intentLink)
                        .vpa(vpa)
                        .amount(amount)
                        .expiryDate(expiryDateStr)
                        .qrExpiryNote(qrExpiryNote)
                        .qrExpiryIn(qrExpiryIn)
                        .statusCheckAttempts(statusCheckAttempts)
                        .statusCheckGap(statusCheckGap)
                        .statusCheckStartIn(statusCheckStartIn)
                        .responseCode(responseCode)
                        .responseMessage(responseMessage)
                        .build();

            } else {
                String errorMsg = root.path("message").asText("Provider rejected initiation");
                if (data != null && !data.isMissingNode() && data.path("responseMessage").asText("").length() > 0) {
                    errorMsg = data.path("responseMessage").asText();
                }

                boolean isAccountValidating = errorMsg.toLowerCase().contains("being validated") 
                        || errorMsg.toLowerCase().contains("account is being validated");

                if (isAccountValidating) {
                    log.warn("Fingpay BC Merchant ID [{}] is currently undergoing compliance validation: {}",
                            maskString(bcLoginId), errorMsg);
                }

                String respCode = root.path("statusCode").asText("10001");
                txn.setInternalStatus("FAILED");
                txn.setProviderStatus("FAILED");
                txn.setErrorMessage(errorMsg);
                txn.setResponseCode(respCode);
                txn.setResponseMessage(errorMsg);
                txn.setUpdatedAt(Instant.now());
                upiTransactionRepository.save(txn);

                return InitiateResponse.builder()
                        .success(false)
                        .message(errorMsg)
                        .partnerRequestId(partnerRequestId)
                        .amount(amount)
                        .responseCode(respCode)
                        .responseMessage(errorMsg)
                        .build();
            }

        } catch (Exception e) {
            log.error("Failed to parse initiation response for {}: {}", partnerRequestId, e.getMessage(), e);
            txn.setInternalStatus("FAILED");
            txn.setProviderStatus("FAILED");
            txn.setErrorMessage("Error parsing provider response: " + e.getMessage());
            txn.setUpdatedAt(Instant.now());
            upiTransactionRepository.save(txn);

            return InitiateResponse.builder()
                    .success(false)
                    .message("Failed to parse provider response: " + e.getMessage())
                    .partnerRequestId(partnerRequestId)
                    .amount(amount)
                    .build();
        }
    }

    @Override
    @Transactional
    public StatusCheckResponse checkStatus(UUID userId, StatusCheckRequest request, String ipAddress) {
        log.info("Checking UPI Cash Withdrawal status for userId: {}, partnerReqId: {}, fpTxnId: {}",
                userId, request.getPartnerRequestId(), request.getFingpayTxnId());

        if ((request.getPartnerRequestId() == null || request.getPartnerRequestId().isBlank())
                && (request.getFingpayTxnId() == null || request.getFingpayTxnId().isBlank())) {
            throw new IllegalArgumentException("Either partnerRequestId or fingpayTxnId is required");
        }

        FingpayUpiCashTransaction txn = null;
        if (request.getPartnerRequestId() != null && !request.getPartnerRequestId().isBlank()) {
            txn = upiTransactionRepository.findByPartnerRequestId(request.getPartnerRequestId().trim()).orElse(null);
        }
        if (txn == null && request.getFingpayTxnId() != null && !request.getFingpayTxnId().isBlank()) {
            txn = upiTransactionRepository.findByFpTransactionId(request.getFingpayTxnId().trim()).orElse(null);
        }

        if (txn == null) {
            throw new IllegalArgumentException("Transaction record not found in system");
        }

        // Verify authorization: retailer can only check their own transaction
        if (userId != null && !txn.getUser().getId().equals(userId)) {
            throw new SecurityException("Unauthorized: You do not own this transaction");
        }

        // If already in final SUCCESS status, return immediately without duplicate wallet mutation
        if ("SUCCESS".equalsIgnoreCase(txn.getInternalStatus())) {
            return buildStatusResponse(txn, true, false, "Transaction already successful");
        }

        // Build plain JSON status check payload per official document
        Map<String, Object> reqMap = new LinkedHashMap<>();
        reqMap.put("fingpayTxnId", txn.getFpTransactionId() != null ? txn.getFpTransactionId() : request.getFingpayTxnId());
        reqMap.put("partnerRequestId", txn.getPartnerRequestId());

        String plainJson;
        try {
            plainJson = objectMapper.writeValueAsString(reqMap);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize status check request", e);
        }

        String targetUrl = useUat ? statusUrlUat : statusUrl;
        String rawResponse = null;
        try {
            String timestamp = cryptoUtil.currentTimestamp();
            String hash = cryptoUtil.generateHash(plainJson, secretKey);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("trnTimestamp", timestamp);
            headers.set("hash", hash);
            headers.set("superMerchantId", superMerchantId);

            HttpEntity<String> entity = new HttpEntity<>(plainJson, headers);
            ResponseEntity<String> responseEntity = restTemplate.exchange(targetUrl, HttpMethod.POST, entity, String.class);
            rawResponse = responseEntity.getBody();
            log.info("Fingpay status check raw response for {}: {}", txn.getPartnerRequestId(), rawResponse);

        } catch (Exception ex) {
            log.error("Failed to query Fingpay status check API for {}: {}", txn.getPartnerRequestId(), ex.getMessage());
            return buildStatusResponse(txn, false, false, "Status check request failed: " + ex.getMessage());
        }

        try {
            JsonNode root = objectMapper.readTree(rawResponse);
            boolean topStatus = root.path("status").asBoolean(false)
                    || "SUCCESS".equalsIgnoreCase(root.path("status").asText(""));
            JsonNode data = root.path("data");

            if (data != null && !data.isMissingNode() && !data.isNull()) {
                String txnStatus = data.path("txnStatus").asText("PENDING").toUpperCase();
                String bankRrn = data.path("bankRrn").asText(null);
                String payerName = data.path("payerName").asText(null);
                String payerVpa = data.path("payerVpa").asText(null);
                String responseCode = data.path("responseCode").asText(null);
                String responseMessage = data.path("responseMessage").asText(null);
                String payerAmountStr = data.path("payerAmount").asText(null);

                txn.setBankRrn(bankRrn);
                txn.setPayerName(payerName);
                txn.setPayerVpa(payerVpa);
                txn.setResponseCode(responseCode);
                txn.setResponseMessage(responseMessage);
                if (payerAmountStr != null && !payerAmountStr.isBlank()) {
                    try {
                        txn.setPayerAmount(new BigDecimal(payerAmountStr));
                    } catch (Exception ignored) {}
                }

                if ("SUCCESS".equals(txnStatus) || ("00".equals(responseCode) && bankRrn != null && !bankRrn.isBlank())) {
                    return handleTransitionToSuccess(txn, ipAddress);
                } else if ("FAILED".equals(txnStatus) || "FAILURE".equals(txnStatus)) {
                    txn.setInternalStatus("FAILED");
                    txn.setProviderStatus("FAILED");
                    txn.setErrorMessage(responseMessage != null ? responseMessage : "Payment failed at customer bank");
                    txn.setUpdatedAt(Instant.now());
                    upiTransactionRepository.save(txn);

                    if (txn.getTxn() != null) {
                        Txn coreTxn = txn.getTxn();
                        coreTxn.setStatus(TransactionStatus.FAILED);
                        txnRepository.save(coreTxn);
                    }
                    return buildStatusResponse(txn, true, false, "Payment failed");
                } else {
                    txn.setInternalStatus("PENDING");
                    txn.setProviderStatus("PENDING");
                    txn.setUpdatedAt(Instant.now());
                    upiTransactionRepository.save(txn);
                    return buildStatusResponse(txn, true, false, "Payment pending customer approval");
                }
            } else {
                String msg = root.path("message").asText("Status check returned empty data");
                return buildStatusResponse(txn, false, false, msg);
            }

        } catch (Exception e) {
            log.error("Failed to parse status check response: {}", e.getMessage(), e);
            return buildStatusResponse(txn, false, false, "Error parsing status response: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public CallbackResponse processCallback(String rawBody, String hashHeader, String ipAddress) {
        log.info("Processing Fingpay UPI Cash Withdrawal callback from IP: {}", ipAddress);

        CallbackRequest request;
        try {
            request = objectMapper.readValue(rawBody, CallbackRequest.class);
        } catch (Exception e) {
            log.error("Malformed callback JSON: {}", e.getMessage());
            return CallbackResponse.builder()
                    .status(false)
                    .message("Malformed JSON payload")
                    .statusCode(10001)
                    .build();
        }

        String partnerRequestId = request.getPartnerRequestId() != null ? request.getPartnerRequestId().trim() : null;
        String fpTxnId = request.getFingpayTransactionId() != null ? request.getFingpayTransactionId().trim() : null;

        if (partnerRequestId == null && fpTxnId == null) {
            log.warn("Callback missing both partnerRequestId and fingpayTransactionId");
            return CallbackResponse.builder()
                    .status(false)
                    .message("Missing transaction identifiers")
                    .statusCode(10001)
                    .build();
        }

        // Find existing transaction in database
        FingpayUpiCashTransaction txn = null;
        if (partnerRequestId != null) {
            txn = upiTransactionRepository.findByPartnerRequestId(partnerRequestId).orElse(null);
        }
        if (txn == null && fpTxnId != null) {
            txn = upiTransactionRepository.findByFpTransactionId(fpTxnId).orElse(null);
        }

        if (txn == null) {
            log.warn("Transaction not found for incoming callback: partnerReqId: {}, fpTxnId: {}", partnerRequestId, fpTxnId);
            return CallbackResponse.builder()
                    .status(false)
                    .message("Transaction reference not recognized")
                    .statusCode(10001)
                    .build();
        }

        // Store raw callback payload for full audit trail
        txn.setRawCallbackPayload(rawBody);

        String incomingStatus = request.getTxnStatus() != null ? request.getTxnStatus().trim().toUpperCase() : "PENDING";
        log.info("Callback status: {} for txn: {}, current internalStatus: {}",
                incomingStatus, txn.getPartnerRequestId(), txn.getInternalStatus());

        // Update provider metadata
        if (request.getBankRrn() != null && !request.getBankRrn().isBlank()) {
            txn.setBankRrn(request.getBankRrn().trim());
        }
        if (request.getPayerName() != null && !request.getPayerName().isBlank()) {
            txn.setPayerName(request.getPayerName().trim());
        }
        if (request.getPayerVpa() != null && !request.getPayerVpa().isBlank()) {
            txn.setPayerVpa(request.getPayerVpa().trim());
        }
        if (request.getResponseMessage() != null && !request.getResponseMessage().isBlank()) {
            txn.setResponseMessage(request.getResponseMessage().trim());
        }
        if (request.getResponseCode() != null && !request.getResponseCode().isBlank()) {
            txn.setResponseCode(request.getResponseCode().trim());
        }

        // Idempotency: If already in SUCCESS, do not mutate wallet again
        if ("SUCCESS".equalsIgnoreCase(txn.getInternalStatus())) {
            log.info("Transaction {} already confirmed SUCCESS. Acknowledging repeated callback.", txn.getPartnerRequestId());
            return CallbackResponse.builder()
                    .status(true)
                    .message("Success")
                    .statusCode(10000)
                    .build();
        }

        if ("SUCCESS".equals(incomingStatus)) {
            handleTransitionToSuccess(txn, ipAddress);
            return CallbackResponse.builder()
                    .status(true)
                    .message("Success")
                    .statusCode(10000)
                    .build();
        } else if ("FAILED".equals(incomingStatus)) {
            txn.setInternalStatus("FAILED");
            txn.setProviderStatus("FAILED");
            txn.setErrorMessage(request.getResponseMessage() != null ? request.getResponseMessage() : "Payment failed");
            txn.setUpdatedAt(Instant.now());
            upiTransactionRepository.save(txn);

            if (txn.getTxn() != null) {
                Txn coreTxn = txn.getTxn();
                coreTxn.setStatus(TransactionStatus.FAILED);
                txnRepository.save(coreTxn);
            }

            return CallbackResponse.builder()
                    .status(true)
                    .message("Success")
                    .statusCode(10000)
                    .build();
        } else {
            // PENDING status update
            txn.setInternalStatus("PENDING");
            txn.setProviderStatus("PENDING");
            txn.setUpdatedAt(Instant.now());
            upiTransactionRepository.save(txn);

            return CallbackResponse.builder()
                    .status(true)
                    .message("Success")
                    .statusCode(10000)
                    .build();
        }
    }

    @Override
    @Transactional
    public ThreeWayReconResponse reconcile(UUID userId, UUID transactionId, String ipAddress) {
        log.info("Reconciling UPI Cash Withdrawal transaction: {} for user: {}", transactionId, userId);

        FingpayUpiCashTransaction txn = upiTransactionRepository.findById(transactionId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + transactionId));

        if (userId != null && !txn.getUser().getId().equals(userId)) {
            throw new SecurityException("Unauthorized: You do not own this transaction");
        }

        String targetUrl = useUat ? reconUrlUat : reconUrl;
        String dateFormatted = DateTimeFormatter.ofPattern("dd-MM-yyyy").format(LocalDateTime.now(IST_ZONE));

        Map<String, Object> reqMap = new LinkedHashMap<>();
        reqMap.put("fingpayTxnId", txn.getFpTransactionId() != null ? txn.getFpTransactionId() : "");
        reqMap.put("partnerRequestId", txn.getPartnerRequestId());
        reqMap.put("transactionRrn", txn.getBankRrn() != null ? txn.getBankRrn() : "");
        reqMap.put("responseCode", txn.getResponseCode() != null ? txn.getResponseCode() : "00");
        reqMap.put("transactionDate", dateFormatted);
        reqMap.put("serviceType", "UPICW");

        try {
            String plainJson = objectMapper.writeValueAsString(reqMap);
            String timestamp = cryptoUtil.currentTimestamp();
            String hash = cryptoUtil.generateHash(plainJson, secretKey);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("txnDate", timestamp);
            headers.set("hash", hash);
            headers.set("superMerchantId", superMerchantId);

            HttpEntity<String> entity = new HttpEntity<>(plainJson, headers);
            ResponseEntity<String> response = restTemplate.exchange(targetUrl, HttpMethod.POST, entity, String.class);
            log.info("Fingpay Recon Response for {}: {}", txn.getPartnerRequestId(), response.getBody());

            JsonNode root = objectMapper.readTree(response.getBody());
            boolean status = root.path("status").asBoolean(false);
            JsonNode data = root.path("Data");

            txn.setReconciled(true);
            if (data != null && !data.isMissingNode()) {
                txn.setReconReferenceId(data.path("referenceId").asText(null));
                txn.setReconResponseCode(data.path("responseCode").asText(null));
                txn.setReconMessage(data.path("responseMessage").asText(null));
            }
            txn.setUpdatedAt(Instant.now());
            upiTransactionRepository.save(txn);

            return ThreeWayReconResponse.builder()
                    .status(status)
                    .message(root.path("message").asText("Reconciliation completed"))
                    .referenceId(txn.getReconReferenceId())
                    .responseCode(txn.getReconResponseCode())
                    .responseMessage(txn.getReconMessage())
                    .statusCode(root.path("statusCode").asInt(10000))
                    .build();

        } catch (Exception e) {
            log.error("Three-way reconciliation failed for {}: {}", txn.getPartnerRequestId(), e.getMessage());
            return ThreeWayReconResponse.builder()
                    .status(false)
                    .message("Reconciliation failed: " + e.getMessage())
                    .statusCode(10001)
                    .build();
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<TransactionDetailResponse> getHistory(UUID userId, String status, String search, String startDate, String endDate, Pageable pageable) {
        Instant start = parseDateTime(startDate, false);
        Instant end = parseDateTime(endDate, true);
        String cleanStatus = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) ? status.trim().toUpperCase() : null;
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;

        Page<FingpayUpiCashTransaction> page = upiTransactionRepository.findWithFilters(userId, cleanStatus, start, end, cleanSearch, pageable);
        return page.map(this::mapToDetailDto);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TransactionDetailResponse> getHistoryForExport(UUID userId, String status, String search, String startDate, String endDate, Sort sort) {
        Instant start = parseDateTime(startDate, false);
        Instant end = parseDateTime(endDate, true);
        String cleanStatus = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) ? status.trim().toUpperCase() : null;
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;

        List<FingpayUpiCashTransaction> list = upiTransactionRepository.findAllWithFilters(userId, cleanStatus, start, end, cleanSearch, sort);
        return list.stream().map(this::mapToDetailDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public HistorySummaryResponse getHistorySummary(UUID userId) {
        long total = upiTransactionRepository.countAllByUserId(userId);
        long success = upiTransactionRepository.countByUserIdAndStatus(userId, "SUCCESS");
        long failed = upiTransactionRepository.countByUserIdAndStatus(userId, "FAILED");
        long pending = total - success - failed;
        BigDecimal volume = upiTransactionRepository.sumSuccessfulVolume(userId);

        return HistorySummaryResponse.builder()
                .totalTransactions(total)
                .totalVolume(volume != null ? volume : BigDecimal.ZERO)
                .successCount(success)
                .failedCount(failed)
                .pendingCount(Math.max(0, pending))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public TransactionDetailResponse getTransactionDetail(UUID userId, UUID transactionId) {
        FingpayUpiCashTransaction txn = upiTransactionRepository.findById(transactionId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + transactionId));

        if (userId != null && !txn.getUser().getId().equals(userId)) {
            throw new SecurityException("Unauthorized access to transaction details");
        }

        return mapToDetailDto(txn);
    }

    /**
     * Atomically transitions the transaction to SUCCESS and performs idempotent wallet credit.
     */
    private StatusCheckResponse handleTransitionToSuccess(FingpayUpiCashTransaction txn, String ipAddress) {
        boolean creditedNow = false;
        BigDecimal newBalance = BigDecimal.ZERO;

        if (!"SUCCESS".equalsIgnoreCase(txn.getInternalStatus())) {
            txn.setInternalStatus("SUCCESS");
            txn.setProviderStatus("SUCCESS");
            txn.setUpdatedAt(Instant.now());

            // Idempotent wallet credit: The merchant dispensed physical cash, so digital wallet is credited
            String idempotencyKey = "UPICW-CREDIT-" + txn.getPartnerRequestId();
            try {
                WalletDtos.WalletBalanceResponse creditRes = walletService.creditForService(
                        txn.getUser().getId(),
                        txn.getAmount(),
                        "UPI Cash Withdrawal Credit - " + txn.getPartnerRequestId() + " (RRN: " + txn.getBankRrn() + ")",
                        WalletTransactionContext.UPI_CASH_WITHDRAWAL,
                        "UPI_CASH_WITHDRAWAL",
                        ipAddress,
                        idempotencyKey
                );
                creditedNow = true;
                newBalance = creditRes.balance();
                log.info("Authoritative wallet credit successful for UPI Cash Withdrawal: {}, new balance: {}",
                        txn.getPartnerRequestId(), newBalance);
            } catch (Exception ex) {
                log.error("Wallet credit execution error for {}: {}", txn.getPartnerRequestId(), ex.getMessage(), ex);
            }

            // Update core ledger Txn record
            if (txn.getTxn() != null) {
                Txn coreTxn = txn.getTxn();
                coreTxn.setStatus(TransactionStatus.SUCCESS);
                if (txn.getBankRrn() != null) {
                    coreTxn.setProviderRef(txn.getBankRrn());
                }
                txnRepository.save(coreTxn);
            }

            upiTransactionRepository.save(txn);
        }

        return StatusCheckResponse.builder()
                .success(true)
                .status("SUCCESS")
                .message("Payment successful. Amount credited to wallet.")
                .partnerRequestId(txn.getPartnerRequestId())
                .fingpayTxnId(txn.getFpTransactionId())
                .bankRrn(txn.getBankRrn())
                .payerAmount(txn.getAmount())
                .payerVpa(txn.getPayerVpa())
                .payerName(txn.getPayerName())
                .responseCode("00")
                .responseMessage("Payment Successful")
                .walletCredited(creditedNow)
                .walletBalance(newBalance)
                .build();
    }

    private StatusCheckResponse buildStatusResponse(FingpayUpiCashTransaction txn, boolean success, boolean credited, String msg) {
        return StatusCheckResponse.builder()
                .success(success)
                .status(txn.getInternalStatus())
                .message(msg)
                .partnerRequestId(txn.getPartnerRequestId())
                .fingpayTxnId(txn.getFpTransactionId())
                .bankRrn(txn.getBankRrn())
                .payerAmount(txn.getAmount())
                .payerVpa(txn.getPayerVpa())
                .payerName(txn.getPayerName())
                .responseCode(txn.getResponseCode())
                .responseMessage(txn.getResponseMessage())
                .walletCredited(credited)
                .build();
    }

    private TransactionDetailResponse mapToDetailDto(FingpayUpiCashTransaction t) {
        return TransactionDetailResponse.builder()
                .id(t.getId())
                .partnerRequestId(t.getPartnerRequestId())
                .fpTransactionId(t.getFpTransactionId())
                .bcLoginId(t.getBcLoginId())
                .amount(t.getAmount())
                .transactionType(t.getTransactionType())
                .providerStatus(t.getProviderStatus())
                .internalStatus(t.getInternalStatus())
                .bankRrn(t.getBankRrn())
                .payerName(t.getPayerName())
                .payerVpa(t.getPayerVpa())
                .payerAmount(t.getPayerAmount() != null ? t.getPayerAmount() : t.getAmount())
                .responseCode(t.getResponseCode())
                .responseMessage(t.getResponseMessage())
                .errorMessage(t.getErrorMessage())
                .remarks(t.getRemarks())
                .qrExpiryIn(t.getQrExpiryIn())
                .qrExpiryNote(t.getQrExpiryNote())
                .reconciled(t.getReconciled())
                .reconReferenceId(t.getReconReferenceId())
                .reconResponseCode(t.getReconResponseCode())
                .reconMessage(t.getReconMessage())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }

    public Optional<AepsKyc> findFingKyc(User mainUser) {
        if (mainUser == null) return Optional.empty();
        long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
        return aepsKycRepository.findByUid(uidLong)
                .or(() -> (mainUser.getPartyCode() != null && !mainUser.getPartyCode().isBlank()) ? aepsKycRepository.findByOutlet(mainUser.getPartyCode().trim()) : Optional.empty())
                .or(() -> (mainUser.getAepsAgentId() != null && !mainUser.getAepsAgentId().isBlank()) ? aepsKycRepository.findByOutlet(mainUser.getAepsAgentId().trim()) : Optional.empty())
                .or(() -> (mainUser.getAepsMerchantId() != null && !mainUser.getAepsMerchantId().isBlank()) ? aepsKycRepository.findByMerchantId(mainUser.getAepsMerchantId().trim()) : Optional.empty())
                .or(() -> (mainUser.getUsername() != null && !mainUser.getUsername().isBlank()) ? aepsKycRepository.findByOutlet(mainUser.getUsername().trim()) : Optional.empty())
                .or(() -> (mainUser.getUsername() != null && !mainUser.getUsername().isBlank()) ? aepsKycRepository.findByMerchantId(mainUser.getUsername().trim()) : Optional.empty())
                .or(() -> (mainUser.getMobile() != null && !mainUser.getMobile().isBlank()) ? aepsKycRepository.findByOutlet(mainUser.getMobile().trim()) : Optional.empty())
                .or(() -> (mainUser.getMobile() != null && !mainUser.getMobile().isBlank()) ? aepsKycRepository.findByMerchantId(mainUser.getMobile().trim()) : Optional.empty());
    }

    public String resolveMerchantId(User user) {
        // 1. Explicit UPI Cash Point override on User entity
        if (user.getUpicwMerchantId() != null && !user.getUpicwMerchantId().isBlank()) {
            return user.getUpicwMerchantId().trim();
        }

        // 2. Direct user AepsAgentId if already set
        if (user.getAepsAgentId() != null && !user.getAepsAgentId().isBlank()) {
            return user.getAepsAgentId().trim();
        }

        // 3. User partyCode
        if (user.getPartyCode() != null && !user.getPartyCode().isBlank()) {
            return user.getPartyCode().trim();
        }

        // 4. Authoritative Fingpay KYC mapping (outlet or merchantId from aepskyc table)
        Optional<AepsKyc> fingKycOpt = findFingKyc(user);
        if (fingKycOpt.isPresent()) {
            AepsKyc kyc = fingKycOpt.get();
            if (kyc.getOutlet() != null && !kyc.getOutlet().isBlank()) {
                return kyc.getOutlet().trim();
            }
            if (kyc.getMerchantId() != null && !kyc.getMerchantId().isBlank()) {
                return kyc.getMerchantId().trim();
            }
        }

        // 5. AEPS User profile (aeps_users table)
        if (aepsUserRepository != null) {
            Optional<com.rupiksha.aeps.entity.User> aepsUserOpt = Optional.empty();
            if (user.getMobile() != null && !user.getMobile().isBlank()) {
                aepsUserOpt = aepsUserRepository.findByMobile(user.getMobile().trim());
            }
            if (aepsUserOpt.isEmpty() && user.getUsername() != null && !user.getUsername().isBlank()) {
                aepsUserOpt = aepsUserRepository.findByUsername(user.getUsername().trim());
            }
            if (aepsUserOpt.isPresent()) {
                com.rupiksha.aeps.entity.User aepsUser = aepsUserOpt.get();
                if (aepsUser.getAepsAgentId() != null && !aepsUser.getAepsAgentId().isBlank()) {
                    return aepsUser.getAepsAgentId().trim();
                }
                if (aepsUser.getAepsMerchantId() != null && !aepsUser.getAepsMerchantId().isBlank()) {
                    return aepsUser.getAepsMerchantId().trim();
                }
            }
        }

        // 6. AEPS Merchant ID / CMS Merchant ID
        if (user.getAepsMerchantId() != null && !user.getAepsMerchantId().isBlank()) {
            return user.getAepsMerchantId().trim();
        }
        if (user.getCmsMerchantId() != null && !user.getCmsMerchantId().isBlank()) {
            return user.getCmsMerchantId().trim();
        }

        // 7. Configured aggregator default BC ID
        if (defaultMerchantId != null && !defaultMerchantId.isBlank()) {
            return defaultMerchantId.trim();
        }

        // 8. Fallback to username or mobile
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername().trim();
        }
        return user.getMobile() != null ? user.getMobile().trim() : "MERCHANT";
    }

    public String resolveMerchantPin(User user) {
        if (user.getUpicwMerchantPin() != null && !user.getUpicwMerchantPin().isBlank()) {
            return user.getUpicwMerchantPin().trim();
        }
        Optional<AepsKyc> kycExisting = findFingKyc(user);
        if (kycExisting.isPresent() && kycExisting.get().getMpin() != null && !kycExisting.get().getMpin().isBlank()) {
            return kycExisting.get().getMpin().trim();
        }
        if (user.getCmsMerchantPin() != null && !user.getCmsMerchantPin().isBlank()) {
            return user.getCmsMerchantPin().trim();
        }
        if (defaultMerchantPin != null && !defaultMerchantPin.isBlank()) {
            return defaultMerchantPin.trim();
        }
        return "1234";
    }

    @Override
    @Transactional(readOnly = true)
    public MerchantInfoResponse getMerchantInfo(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        String bcLoginId = resolveMerchantId(user);
        Optional<AepsKyc> fingKycOpt = findFingKyc(user);

        boolean kycDone = false;
        boolean bankEkycDone = false;
        boolean onboarded = false;
        String source = "FALLBACK";

        if (user.getUpicwMerchantId() != null && !user.getUpicwMerchantId().isBlank()) {
            source = "UPICW_CUSTOM";
            onboarded = true;
        } else if (user.getAepsAgentId() != null && !user.getAepsAgentId().isBlank()) {
            source = "CORE_USER_AEPS_AGENT";
            onboarded = true;
        } else if (user.getPartyCode() != null && !user.getPartyCode().isBlank()) {
            source = "PARTY_CODE";
            onboarded = true;
        } else if (fingKycOpt.isPresent()) {
            AepsKyc kyc = fingKycOpt.get();
            source = "AEPS_KYC";
            onboarded = (kyc.getOutlet() != null && !kyc.getOutlet().isBlank()) || (kyc.getMerchantId() != null && !kyc.getMerchantId().isBlank());
            kycDone = Boolean.TRUE.equals(kyc.getKycDone());
            bankEkycDone = Boolean.TRUE.equals(kyc.getBankEkycDone());
        } else if (defaultMerchantId != null && !defaultMerchantId.isBlank()) {
            source = "DEFAULT_CONFIG";
            onboarded = true;
        }

        if (fingKycOpt.isPresent()) {
            AepsKyc kyc = fingKycOpt.get();
            if (Boolean.TRUE.equals(kyc.getKycDone())) kycDone = true;
            if (Boolean.TRUE.equals(kyc.getBankEkycDone())) bankEkycDone = true;
        }

        return MerchantInfoResponse.builder()
                .bcLoginId(bcLoginId)
                .onboarded(onboarded)
                .kycDone(kycDone)
                .bankEkycDone(bankEkycDone)
                .source(source)
                .build();
    }

    private String maskString(String val) {
        if (val == null || val.isBlank()) return "N/A";
        String trimmed = val.trim();
        if (trimmed.length() <= 4) return "****";
        return trimmed.substring(0, 2) + "****" + trimmed.substring(trimmed.length() - 2);
    }


    private void validateAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("FP003: The amount must be greater than 0.");
        }
        if (amount.compareTo(MIN_AMOUNT) < 0) {
            throw new IllegalArgumentException("FP029: Amount is less than the minimum limit (Minimum Limit: ₹100).");
        }
        if (amount.compareTo(MAX_AMOUNT) > 0) {
            throw new IllegalArgumentException("FP002: Amount exceeded transaction limit (₹5,000).");
        }
        // Check for paise
        if (amount.remainder(BigDecimal.ONE).compareTo(BigDecimal.ZERO) != 0) {
            throw new IllegalArgumentException("FP027: Paise not allowed.");
        }
        // Multiples of 100
        if (amount.remainder(AMOUNT_MULTIPLE).compareTo(BigDecimal.ZERO) != 0) {
            throw new IllegalArgumentException("FP079: Amount should be in multiples of ₹100.");
        }
    }

    private void validateOperatingWindow() {
        LocalTime now = LocalTime.now(IST_ZONE);
        // Restricted from 23:30 to 00:05 IST
        if (now.isAfter(LocalTime.of(23, 29, 59)) || now.isBefore(LocalTime.of(0, 5, 1))) {
            throw new IllegalStateException("FP023: Transaction is restricted from 23:30 to 00:05. Please try later.");
        }
    }

    private void validateCoordinates(Double latitude, Double longitude) {
        if (latitude == null || longitude == null) {
            throw new IllegalArgumentException("FP018: Invalid location coordinates.");
        }
        if (latitude < -90.0 || latitude > 90.0 || longitude < -180.0 || longitude > 180.0) {
            throw new IllegalArgumentException("FP076: Invalid latitude/longitude.");
        }
        if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) {
            throw new IllegalArgumentException("FP094: Geo-fencing is invalid. Please update Latitude and Longitude details.");
        }
    }

    private void validateDailyLimit(User user, BigDecimal amount) {
        LocalDate today = LocalDate.now(IST_ZONE);
        Instant startOfDay = today.atStartOfDay(IST_ZONE).toInstant();
        BigDecimal todayVol = upiTransactionRepository.sumTodaySuccessfulVolume(user.getId(), startOfDay);
        if (todayVol == null) todayVol = BigDecimal.ZERO;

        if (todayVol.add(amount).compareTo(configuredDailyLimit) > 0) {
            throw new IllegalStateException("FP007: Merchant's daily transaction limit exceeded (₹" + configuredDailyLimit + "). Current today volume: ₹" + todayVol);
        }
    }

    private Instant parseIsoInstant(String isoStr, int fallbackSeconds) {
        try {
            return Instant.parse(isoStr);
        } catch (DateTimeParseException e1) {
            try {
                LocalDateTime ldt = LocalDateTime.parse(isoStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
                return ldt.atZone(IST_ZONE).toInstant();
            } catch (Exception e2) {
                return Instant.now().plusSeconds(fallbackSeconds);
            }
        }
    }

    private Instant parseDateTime(String dateStr, boolean endOfDay) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            LocalDate ld = LocalDate.parse(dateStr.trim());
            return endOfDay
                    ? ld.atTime(23, 59, 59, 999999999).atZone(ZoneId.systemDefault()).toInstant()
                    : ld.atStartOfDay(ZoneId.systemDefault()).toInstant();
        } catch (Exception e) {
            return null;
        }
    }
}
