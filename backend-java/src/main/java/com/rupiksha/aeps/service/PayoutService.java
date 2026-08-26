package com.rupiksha.aeps.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.config.PayoutProperties;
import com.rupiksha.aeps.dto.BankVerificationRequest;
import com.rupiksha.aeps.dto.BankVerificationResponse;
import com.rupiksha.aeps.dto.PayoutRequest;
import com.rupiksha.aeps.dto.PayoutResponse;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.aeps.util.BusttoCryptoUtil;
import com.rupiksha.aeps.util.BusttoJwtUtil;
import com.rupiksha.backend.domain.WalletTransactionContext;
import com.rupiksha.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final PayoutProperties payoutProperties;
    private final PayoutTransactionRepository payoutTransactionRepository;
    private final WalletService walletService;

    private String cleanUserIdString(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("User ID is required");
        }
        String s = raw.trim();
        if (s.contains("userId=")) {
            int start = s.indexOf("userId=") + 7;
            int end = s.indexOf(",", start);
            if (end == -1) end = s.indexOf("]", start);
            if (end != -1) {
                return s.substring(start, end).trim();
            }
        }
        return s;
    }

    private UUID parseUserUuid(String raw) {
        String clean = cleanUserIdString(raw);
        return UUID.fromString(clean);
    }

    /**
     * Initiates an instant payout transfer to beneficiary bank account.
     * Enforces atomic wallet balance check and deduction, encrypted API communication,
     * duplicate submission prevention, and instant auto-refund on failure.
     */
    public PayoutResponse initiatePayout(PayoutRequest request, String rawUserId) {
        String cleanUserId = cleanUserIdString(rawUserId);
        UUID userUuid = parseUserUuid(cleanUserId);

        String orderId = request.getOrderId();
        if (orderId == null || orderId.isBlank()) {
            orderId = generateOrderId(cleanUserId);
        }

        // 1. Guard against duplicate orderId
        if (payoutTransactionRepository.existsByOrderId(orderId)) {
            throw new IllegalArgumentException("Duplicate transaction orderId: " + orderId);
        }

        BigDecimal amount = request.getAmount();
        if (amount == null || amount.compareTo(BigDecimal.ONE) < 0) {
            throw new IllegalArgumentException("Payout amount must be at least ₹1.00");
        }

        // 2. Persist initial PENDING transaction record
        PayoutTransaction transaction = PayoutTransaction.builder()
                .orderId(orderId)
                .userId(cleanUserId)
                .amount(amount)
                .beneficiaryName(request.getBeneficiaryName())
                .accountNumber(request.getAccountNumber())
                .ifsc(request.getIfsc().toUpperCase().trim())
                .bankName(request.getBankName())
                .transferMode(request.getTransferMode() != null ? request.getTransferMode() : "IMPS")
                .remarks(request.getRemarks())
                .mobileNumber(request.getMobileNumber())
                .status("PENDING")
                .build();

        payoutTransactionRepository.save(transaction);

        // 3. Atomically debit user's wallet
        try {
            walletService.debitForService(
                    userUuid,
                    amount,
                    "Payout to " + request.getBeneficiaryName() + " (" + request.getAccountNumber() + ")",
                    WalletTransactionContext.PAYOUT,
                    "PAYOUT",
                    "127.0.0.1",
                    orderId
            );
        } catch (Exception e) {
            log.error("Wallet debit failed for payout order {}: {}", orderId, e.getMessage());
            transaction.setStatus("FAILED");
            transaction.setResponseMessage(e.getMessage());
            payoutTransactionRepository.save(transaction);
            return PayoutResponse.builder()
                    .success(false)
                    .statusCode("WALLET_DEBIT_FAILED")
                    .status("FAILED")
                    .message(e.getMessage() != null && e.getMessage().contains("Insufficient")
                            ? "Insufficient wallet balance for payout"
                            : "Could not process wallet deduction: " + e.getMessage())
                    .orderId(orderId)
                    .amount(amount)
                    .build();
        }

        // 4. Call Provider Payout API with encryption and JWT auth
        try {
            Map<String, Object> rawPayload = new HashMap<>();
            rawPayload.put("amount", amount);
            rawPayload.put("external_order_id", orderId);
            rawPayload.put("bene_name", request.getBeneficiaryName().trim());
            rawPayload.put("bene_account_number", request.getAccountNumber().trim());
            rawPayload.put("bene_mobile", request.getMobileNumber() != null && !request.getMobileNumber().isBlank()
                    ? request.getMobileNumber() : "9876543210");
            rawPayload.put("bene_ifsc", request.getIfsc().toUpperCase().trim());
            rawPayload.put("bank_name", request.getBankName() != null && !request.getBankName().isBlank()
                    ? request.getBankName() : "Bank");
            rawPayload.put("branch_name", request.getBranchName() != null && !request.getBranchName().isBlank()
                    ? request.getBranchName() : "Branch");
            rawPayload.put("payment_mode", request.getTransferMode() != null ? request.getTransferMode() : "IMPS");
            rawPayload.put("bene_address", request.getAddress() != null && !request.getAddress().isBlank()
                    ? request.getAddress() : "India");
            rawPayload.put("trn_rmks", request.getRemarks() != null && !request.getRemarks().isBlank()
                    ? request.getRemarks() : "Payout transfer");

            String rawJson = objectMapper.writeValueAsString(rawPayload);
            String encryptedBody = BusttoCryptoUtil.encrypt(payoutProperties.getAesKey(), rawJson);

            Map<String, String> requestBody = Map.of("request", encryptedBody);

            HttpHeaders headers = createAuthHeaders();
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(requestBody, headers);

            String payoutUrl = payoutProperties.getFullPayoutUrl();
            log.info("Sending encrypted payout request to {} for orderId {}", payoutUrl, orderId);

            ResponseEntity<String> response = restTemplate.exchange(payoutUrl, HttpMethod.POST, entity, String.class);
            String decryptedResponse = decryptResponseBody(response.getBody());

            log.info("Payout decrypted response for orderId {}: {}", orderId, decryptedResponse);

            JsonNode root = objectMapper.readTree(decryptedResponse);
            int statusCode = root.path("bbStatusCode").asInt(-1);
            String statusMsg = root.path("bbStatusMsg").asText("UNKNOWN");
            JsonNode txnData = root.path("TransactionData");

            String bbTxnId = txnData.path("bbTransactionId").asText("");
            String bbTxnStatus = txnData.path("bbTransactionStatus").asText("");
            String bbReason = txnData.path("bbReason").asText(statusMsg);
            String utr = txnData.path("bbUtrNumber").asText(txnData.path("utr").asText(""));

            transaction.setStatusCode(String.valueOf(statusCode));
            transaction.setResponseData(decryptedResponse);
            transaction.setUtr(utr);

            boolean isSuccess = statusCode == 0 || "INITIATED".equalsIgnoreCase(bbTxnStatus) || "SUCCESS".equalsIgnoreCase(bbTxnStatus) || "Successful".equalsIgnoreCase(bbTxnStatus);

            if (isSuccess) {
                transaction.setStatus("SUCCESS");
                transaction.setResponseMessage(bbReason != null && !bbReason.isBlank() ? bbReason : "Transfer initiated successfully");
                payoutTransactionRepository.save(transaction);

                return PayoutResponse.builder()
                        .success(true)
                        .statusCode(String.valueOf(statusCode))
                        .status("SUCCESS")
                        .message("Payout transferred successfully")
                        .orderId(orderId)
                        .transactionId(bbTxnId)
                        .utr(utr)
                        .amount(amount)
                        .beneficiaryName(request.getBeneficiaryName())
                        .accountNumber(request.getAccountNumber())
                        .ifsc(request.getIfsc())
                        .bankName(request.getBankName())
                        .transferMode(request.getTransferMode())
                        .timestamp(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")))
                        .build();
            } else {
                // Provider rejected transaction -> trigger immediate refund
                String errorDetail = extractErrorMessage(root);
                log.warn("Payout rejected by provider for orderId {}: {}", orderId, errorDetail);

                transaction.setStatus("FAILED");
                transaction.setResponseMessage(errorDetail);
                payoutTransactionRepository.save(transaction);

                executeRefund(cleanUserId, amount, orderId, "Payout rejected: " + errorDetail);

                return PayoutResponse.builder()
                        .success(false)
                        .statusCode(String.valueOf(statusCode))
                        .status("FAILED")
                        .message(errorDetail)
                        .orderId(orderId)
                        .amount(amount)
                        .build();
            }

        } catch (HttpClientErrorException | HttpServerErrorException e) {
            String errorBody = e.getResponseBodyAsString();
            String decryptedError = decryptResponseBody(errorBody);
            log.error("Payout HTTP error {} for orderId {}: {}", e.getStatusCode(), orderId, decryptedError);

            String errorMsg = "Transfer failed with banking rail";
            try {
                JsonNode errRoot = objectMapper.readTree(decryptedError);
                errorMsg = extractErrorMessage(errRoot);
            } catch (Exception ignored) {}

            transaction.setStatus("FAILED");
            transaction.setStatusCode(String.valueOf(e.getStatusCode().value()));
            transaction.setResponseMessage(errorMsg);
            payoutTransactionRepository.save(transaction);

            executeRefund(cleanUserId, amount, orderId, "Payout failed: " + errorMsg);

            return PayoutResponse.builder()
                    .success(false)
                    .statusCode(String.valueOf(e.getStatusCode().value()))
                    .status("FAILED")
                    .message(errorMsg)
                    .orderId(orderId)
                    .amount(amount)
                    .build();

        } catch (Exception e) {
            log.error("Payout unexpected exception for orderId {}: {}", orderId, e.getMessage(), e);

            transaction.setStatus("FAILED");
            transaction.setStatusCode("500");
            transaction.setResponseMessage(e.getMessage());
            payoutTransactionRepository.save(transaction);

            executeRefund(cleanUserId, amount, orderId, "Payout error: " + e.getMessage());

            return PayoutResponse.builder()
                    .success(false)
                    .statusCode("500")
                    .status("FAILED")
                    .message("Payout request encountered an error: " + e.getMessage())
                    .orderId(orderId)
                    .amount(amount)
                    .build();
        }
    }

    /**
     * Bank Account Verification (Penny-less).
     * Validates if the bank account exists and returns the legal Name At Bank.
     */
    public BankVerificationResponse verifyBankAccount(BankVerificationRequest request, String rawUserId) {
        try {
            Map<String, Object> rawPayload = new HashMap<>();
            rawPayload.put("account_number", request.getAccountNumber().trim());
            rawPayload.put("ifsc_code", request.getIfsc().toUpperCase().trim());

            String rawJson = objectMapper.writeValueAsString(rawPayload);
            String encryptedBody = BusttoCryptoUtil.encrypt(payoutProperties.getAesKey(), rawJson);

            Map<String, String> requestBody = Map.of("request", encryptedBody);
            HttpHeaders headers = createAuthHeaders();
            HttpEntity<Map<String, String>> entity = new HttpEntity<>(requestBody, headers);

            String url = "penny-drop".equalsIgnoreCase(request.getMethod())
                    ? payoutProperties.getFullPennyDropUrl()
                    : payoutProperties.getFullPennyLessUrl();

            log.info("Verifying bank account with {} for ifsc {}", url, request.getIfsc());
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            String decryptedResponse = decryptResponseBody(response.getBody());

            log.info("Bank verification response: {}", decryptedResponse);

            JsonNode root = objectMapper.readTree(decryptedResponse);
            int statusCode = root.path("bbStatusCode").asInt(-1);
            String statusMsg = root.path("bbStatusMsg").asText("");
            JsonNode txnData = root.path("TransactionData");

            String nameAtBank = txnData.path("nameAtBank").asText("");
            String acValidationStatus = txnData.path("acValidationStatus").asText("");
            String verificationId = txnData.path("verification_id").asText("");
            String utr = txnData.path("utr").asText("");

            boolean isSuccess = statusCode == 0
                    || "SUCCESS".equalsIgnoreCase(statusMsg)
                    || "ACCEPTED".equalsIgnoreCase(txnData.path("status").asText())
                    || (!nameAtBank.isBlank() && !"null".equalsIgnoreCase(nameAtBank));

            if (isSuccess) {
                return BankVerificationResponse.builder()
                        .success(true)
                        .statusCode(statusCode >= 0 ? String.valueOf(statusCode) : "0")
                        .status("SUCCESS")
                        .message("Bank account verified successfully")
                        .nameAtBank(nameAtBank)
                        .acValidationStatus(acValidationStatus.isBlank() ? "ACCOUNT_VALID" : acValidationStatus)
                        .verificationId(verificationId)
                        .custAcctNo(request.getAccountNumber())
                        .custIfsc(request.getIfsc())
                        .utr(utr)
                        .build();
            } else {
                String errorMsg = extractErrorMessage(root);
                return BankVerificationResponse.builder()
                        .success(false)
                        .statusCode(String.valueOf(statusCode))
                        .status("FAILED")
                        .message(errorMsg != null && !errorMsg.isBlank() ? errorMsg : "Account verification failed")
                        .build();
            }

        } catch (HttpClientErrorException | HttpServerErrorException e) {
            String decryptedError = decryptResponseBody(e.getResponseBodyAsString());
            log.error("Bank verification error (HTTP {}): {}", e.getStatusCode(), decryptedError);
            String errorMsg = "Account verification failed";
            try {
                JsonNode errRoot = objectMapper.readTree(decryptedError);
                errorMsg = extractErrorMessage(errRoot);
            } catch (Exception ignored) {}

            return BankVerificationResponse.builder()
                    .success(false)
                    .statusCode(String.valueOf(e.getStatusCode().value()))
                    .status("FAILED")
                    .message(errorMsg)
                    .build();
        } catch (Exception e) {
            log.error("Bank verification unexpected error: {}", e.getMessage(), e);
            return BankVerificationResponse.builder()
                    .success(false)
                    .statusCode("500")
                    .status("FAILED")
                    .message("Failed to verify bank account: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Checks real-time status of payout transaction.
     */
    public PayoutResponse checkPayoutStatus(String orderId, String rawUserId) {
        String cleanUserId = cleanUserIdString(rawUserId);
        PayoutTransaction txn = payoutTransactionRepository.findByOrderId(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + orderId));

        if (!cleanUserIdString(txn.getUserId()).equals(cleanUserId)) {
            throw new IllegalArgumentException("Unauthorized transaction access");
        }

        try {
            HttpHeaders headers = createAuthHeaders();
            HttpEntity<String> entity = new HttpEntity<>("{}", headers);

            String statusUrl = payoutProperties.getFullStatusUrl(txn.getOrderId());
            ResponseEntity<String> response = restTemplate.exchange(statusUrl, HttpMethod.GET, entity, String.class);
            String decryptedResponse = decryptResponseBody(response.getBody());

            JsonNode root = objectMapper.readTree(decryptedResponse);
            int statusCode = root.path("bbStatusCode").asInt(-1);
            JsonNode txnData = root.path("TransactionData");

            String bbStatus = txnData.path("bbTransactionStatus").asText("");
            String utr = txnData.path("bbUtrNumber").asText(txnData.path("utr").asText(""));

            if (statusCode == 0 && ("Successful".equalsIgnoreCase(bbStatus) || "SUCCESS".equalsIgnoreCase(bbStatus))) {
                txn.setStatus("SUCCESS");
                if (utr != null && !utr.isBlank()) txn.setUtr(utr);
                payoutTransactionRepository.save(txn);
            } else if ("Failed".equalsIgnoreCase(bbStatus) || "FAILED".equalsIgnoreCase(bbStatus)) {
                if (!"FAILED".equalsIgnoreCase(txn.getStatus())) {
                    txn.setStatus("FAILED");
                    payoutTransactionRepository.save(txn);
                    executeRefund(cleanUserId, txn.getAmount(), orderId, "Status check returned failed");
                }
            }

            return PayoutResponse.builder()
                    .success("SUCCESS".equalsIgnoreCase(txn.getStatus()))
                    .statusCode(String.valueOf(statusCode))
                    .status(txn.getStatus())
                    .message("Status: " + txn.getStatus())
                    .orderId(txn.getOrderId())
                    .utr(txn.getUtr())
                    .amount(txn.getAmount())
                    .beneficiaryName(txn.getBeneficiaryName())
                    .accountNumber(txn.getAccountNumber())
                    .ifsc(txn.getIfsc())
                    .build();

        } catch (Exception e) {
            log.error("Failed to query status for payout {}: {}", orderId, e.getMessage());
            return PayoutResponse.builder()
                    .success("SUCCESS".equalsIgnoreCase(txn.getStatus()))
                    .status(txn.getStatus())
                    .message("Current stored status: " + txn.getStatus())
                    .orderId(txn.getOrderId())
                    .utr(txn.getUtr())
                    .amount(txn.getAmount())
                    .build();
        }
    }

    public List<PayoutTransaction> getUserTransactions(String rawUserId) {
        String cleanUserId = cleanUserIdString(rawUserId);
        return payoutTransactionRepository.findByUserId(cleanUserId);
    }

    public PayoutTransaction getTransactionByOrderId(String orderId) {
        return payoutTransactionRepository.findByOrderId(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + orderId));
    }

    public String generateOrderId(String rawUserId) {
        String cleanUserId = cleanUserIdString(rawUserId);
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String randStr = UUID.randomUUID().toString().replace("-", "").substring(0, 4).toUpperCase();
        return "PO_" + dateStr + "_" + randStr;
    }

    private HttpHeaders createAuthHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.set("Api-Key", payoutProperties.getApiKey());

        String jwtToken = BusttoJwtUtil.generateOrGetToken(
                payoutProperties.getJwtSecret(),
                payoutProperties.getMerchantId(),
                payoutProperties.getMerchantName(),
                payoutProperties.getMerchantEmail()
        );
        headers.set("Authorization", "Bearer " + jwtToken);
        return headers;
    }

    private String decryptResponseBody(String body) {
        if (body == null || body.isBlank()) return "{}";
        try {
            if (body.trim().startsWith("{")) {
                JsonNode node = objectMapper.readTree(body);
                if (node.has("encrypted_payload")) {
                    return BusttoCryptoUtil.decrypt(payoutProperties.getAesKey(), node.get("encrypted_payload").asText());
                }
                if (node.has("request")) {
                    return BusttoCryptoUtil.decrypt(payoutProperties.getAesKey(), node.get("request").asText());
                }
                if (node.has("bbStatusCode") || node.has("status") || node.has("statusCode") || node.has("error") || node.has("detail")) {
                    return body;
                }
            }
            return BusttoCryptoUtil.decrypt(payoutProperties.getAesKey(), body);
        } catch (Exception e) {
            log.debug("Payload is not encrypted or decryption skipped: {}", e.getMessage());
            return body;
        }
    }

    private String extractErrorMessage(JsonNode root) {
        if (root == null || root.isNull() || root.isMissingNode()) return "Transaction could not be processed";
        
        JsonNode errNode = root.path("bbErrorMsg");
        if (errNode.isTextual() && !errNode.asText().isBlank()) {
            return errNode.asText();
        }
        if (errNode.isObject()) {
            List<String> errors = new ArrayList<>();
            errNode.fieldNames().forEachRemaining(field -> {
                JsonNode val = errNode.get(field);
                if (val.isArray() && val.size() > 0) {
                    errors.add(val.get(0).asText());
                } else if (val.isTextual()) {
                    errors.add(val.asText());
                } else {
                    errors.add(field + ": " + val.toString());
                }
            });
            if (!errors.isEmpty()) {
                return String.join(", ", errors);
            }
        }
        if (errNode.isArray() && errNode.size() > 0) {
            return errNode.get(0).asText();
        }

        for (String key : List.of("message", "error", "detail", "bbReason", "bbStatusMsg", "status", "non_field_errors")) {
            JsonNode node = root.path(key);
            if (node.isTextual() && !node.asText().isBlank() && !"SUCCESS".equalsIgnoreCase(node.asText())) {
                return node.asText();
            }
            if (node.isArray() && node.size() > 0) {
                return node.get(0).asText();
            }
        }

        return root.toString();
    }

    private void executeRefund(String rawUserId, BigDecimal amount, String orderId, String reason) {
        try {
            UUID userUuid = parseUserUuid(rawUserId);
            walletService.refundForService(
                    userUuid,
                    amount,
                    reason,
                    orderId,
                    WalletTransactionContext.PAYOUT_REFUND,
                    "PAYOUT",
                    "127.0.0.1",
                    orderId + "_REFUND"
            );
            log.info("Successfully refunded ₹{} for payout order {}", amount, orderId);
        } catch (Exception e) {
            log.error("Automatic refund failed for order {}: {}", orderId, e.getMessage(), e);
        }
    }
}
