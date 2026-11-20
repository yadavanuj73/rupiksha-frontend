package com.rupiksha.aeps.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.config.PayoutProperties;
import com.rupiksha.aeps.dto.BusstoPayoutWebhookDto;
import com.rupiksha.aeps.dto.BusstoWebhookResponse;
import com.rupiksha.aeps.dto.PayoutResponse;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.entity.PayoutWebhookEvent;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.aeps.repository.PayoutWebhookEventRepository;
import com.rupiksha.aeps.service.BusstoPayoutWebhookService;
import com.rupiksha.aeps.service.PayoutAuditService;
import com.rupiksha.aeps.service.PayoutService;
import com.rupiksha.aeps.util.BusttoCryptoUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class BusstoPayoutWebhookServiceImpl implements BusstoPayoutWebhookService {

    private final PayoutTransactionRepository payoutTransactionRepository;
    private final PayoutWebhookEventRepository payoutWebhookEventRepository;
    private final PayoutService payoutService;
    private final PayoutAuditService payoutAuditService;
    private final PayoutProperties payoutProperties;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public ResponseEntity<BusstoWebhookResponse> processWebhook(String rawPayload, HttpHeaders headers, String clientIp) {
        String safeIp = clientIp != null ? clientIp : "127.0.0.1";
        log.info("[BUSSTO_WEBHOOK] Received callback from IP: {}", safeIp);

        // 1. Validate empty payload
        if (rawPayload == null || rawPayload.isBlank()) {
            log.warn("[BUSSTO_WEBHOOK_REJECT] Empty callback body received from IP: {}", safeIp);
            saveEvent(null, null, null, "NONE", "NONE", "UNAUTHENTICATED", "REJECTED",
                    "MALFORMED_PAYLOAD", 400, "Empty payload body", rawPayload, safeIp);
            return ResponseEntity.badRequest().body(
                    BusstoWebhookResponse.builder()
                            .success(false)
                            .status("ERROR")
                            .message("Callback request body cannot be empty")
                            .build()
            );
        }

        // 2. Compute SHA-256 fingerprint for deduplication
        String payloadHash = computeSha256(rawPayload);

        // 3. Fast Deduplication Check (Exact duplicate payload already successfully processed)
        Optional<PayoutWebhookEvent> existingProcessedEvent =
                payoutWebhookEventRepository.findFirstByPayloadHashAndProcessingStatus(payloadHash, "PROCESSED");
        if (existingProcessedEvent.isPresent()) {
            PayoutWebhookEvent prior = existingProcessedEvent.get();
            log.info("[BUSSTO_WEBHOOK_IDEMPOTENT] Duplicate callback received (hash match): orderId={}, hash={}",
                    prior.getOrderId(), payloadHash);
            saveEvent(prior.getEventId(), prior.getOrderId(), prior.getProviderTxnId(), payloadHash,
                    prior.getVerificationMethod(), "VERIFIED", "DUPLICATE", "DUPLICATE", 200,
                    "Duplicate callback event acknowledged", rawPayload, safeIp);
            return ResponseEntity.ok(
                    BusstoWebhookResponse.builder()
                            .success(true)
                            .status("DUPLICATE")
                            .message("Callback already processed successfully")
                            .orderId(prior.getOrderId())
                            .providerTxnId(prior.getProviderTxnId())
                            .build()
            );
        }

        // 4. Decrypt / Normalize Payload
        DecryptedPayloadResult decryptResult = normalizeAndDecrypt(rawPayload);
        if (!decryptResult.success) {
            log.warn("[BUSSTO_WEBHOOK_REJECT] Decryption failed for incoming callback: {}", decryptResult.errorMessage);
            saveEvent(null, null, null, payloadHash, "AES_256_GCM", "FAILED", "VERIFICATION_FAILED",
                    "DECRYPTION_ERROR", 400, decryptResult.errorMessage, rawPayload, safeIp);
            return ResponseEntity.badRequest().body(
                    BusstoWebhookResponse.builder()
                            .success(false)
                            .status("ERROR")
                            .message("Could not decrypt callback payload: " + decryptResult.errorMessage)
                            .build()
            );
        }

        String normalizedJson = decryptResult.jsonPayload;
        boolean isCryptographicallyAuthenticated = decryptResult.wasEncrypted;
        String verificationMethod = isCryptographicallyAuthenticated ? "AES_256_GCM" : "NONE";
        String verificationResult = isCryptographicallyAuthenticated ? "VERIFIED" : "UNVERIFIED";

        // 5. Header-based Authentication (if not already authenticated via AES-GCM)
        if (!isCryptographicallyAuthenticated) {
            AuthHeaderResult authResult = verifyAuthenticationHeaders(rawPayload, headers);
            if (authResult.verified) {
                verificationMethod = authResult.method;
                verificationResult = "VERIFIED";
            } else if (authResult.failed) {
                log.warn("[SECURITY_ALERT] Invalid callback signature or authentication header from IP {}: {}", safeIp, authResult.failureReason);
                saveEvent(null, null, null, payloadHash, authResult.method, "FAILED", "INVALID_SIGNATURE",
                        "UNAUTHORIZED", 401, authResult.failureReason, rawPayload, safeIp);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                        BusstoWebhookResponse.builder()
                                .success(false)
                                .status("UNAUTHORIZED")
                                .message(authResult.failureReason)
                                .build()
                );
            }
        }

        // 6. Parse Webhook DTO
        BusstoPayoutWebhookDto dto;
        try {
            dto = parseWebhookDto(normalizedJson);
        } catch (Exception e) {
            log.warn("[BUSSTO_WEBHOOK_REJECT] JSON parsing failed: {}", e.getMessage());
            saveEvent(null, null, null, payloadHash, verificationMethod, verificationResult, "MALFORMED_JSON",
                    "JSON_PARSE_ERROR", 400, "Invalid JSON structure: " + e.getMessage(), rawPayload, safeIp);
            return ResponseEntity.badRequest().body(
                    BusstoWebhookResponse.builder()
                            .success(false)
                            .status("ERROR")
                            .message("Invalid JSON format in callback")
                            .build()
            );
        }

        // 7. Event ID Deduplication
        if (dto.getEventId() != null && !dto.getEventId().isBlank()) {
            Optional<PayoutWebhookEvent> eventIdDuplicate =
                    payoutWebhookEventRepository.findFirstByEventIdAndProcessingStatus(dto.getEventId().trim(), "PROCESSED");
            if (eventIdDuplicate.isPresent()) {
                PayoutWebhookEvent prior = eventIdDuplicate.get();
                log.info("[BUSSTO_WEBHOOK_IDEMPOTENT] Duplicate callback received (event ID match): eventId={}, orderId={}",
                        dto.getEventId(), prior.getOrderId());
                saveEvent(dto.getEventId(), prior.getOrderId(), prior.getProviderTxnId(), payloadHash,
                        verificationMethod, "VERIFIED", "DUPLICATE", "DUPLICATE", 200,
                        "Duplicate callback eventId acknowledged", rawPayload, safeIp);
                return ResponseEntity.ok(
                        BusstoWebhookResponse.builder()
                                .success(true)
                                .status("DUPLICATE")
                                .message("Callback eventId already processed")
                                .orderId(prior.getOrderId())
                                .providerTxnId(prior.getProviderTxnId())
                                .build()
                );
            }
        }

        // 8. Transaction Matching
        String orderId = dto.getOrderId() != null ? dto.getOrderId().trim() : null;
        String providerTxnId = dto.getProviderTxnId() != null ? dto.getProviderTxnId().trim() : null;

        if ((orderId == null || orderId.isBlank()) && (providerTxnId == null || providerTxnId.isBlank())) {
            log.warn("[BUSSTO_WEBHOOK_REJECT] Callback missing both external_order_id and bbTransactionId from IP: {}", safeIp);
            saveEvent(dto.getEventId(), null, null, payloadHash, verificationMethod, verificationResult,
                    "MISSING_IDENTIFIERS", "MISSING_IDENTIFIERS", 400,
                    "Callback lacks transaction orderId and providerTxnId", rawPayload, safeIp);
            return ResponseEntity.badRequest().body(
                    BusstoWebhookResponse.builder()
                            .success(false)
                            .status("ERROR")
                            .message("Missing transaction identifiers (external_order_id or bbTransactionId)")
                            .build()
            );
        }

        Optional<PayoutTransaction> optTxn = Optional.empty();
        if (orderId != null && !orderId.isBlank()) {
            optTxn = payoutTransactionRepository.findWithLockByOrderId(orderId);
        }
        if (optTxn.isEmpty() && providerTxnId != null && !providerTxnId.isBlank()) {
            optTxn = payoutTransactionRepository.findWithLockByProviderTxnId(providerTxnId);
        }

        if (optTxn.isEmpty()) {
            log.warn("[SECURITY_ALERT] UNMATCHED_PAYOUT_CALLBACK: orderId={}, providerTxnId={}, ip={}",
                    orderId, providerTxnId, safeIp);
            saveEvent(dto.getEventId(), orderId, providerTxnId, payloadHash, verificationMethod, verificationResult,
                    "UNMATCHED", "UNMATCHED", 404,
                    "No matching payout transaction found for references", rawPayload, safeIp);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                    BusstoWebhookResponse.builder()
                            .success(false)
                            .status("NOT_FOUND")
                            .message("Transaction could not be matched to any Rupiksha payout request")
                            .orderId(orderId)
                            .providerTxnId(providerTxnId)
                            .build()
            );
        }

        PayoutTransaction txn = optTxn.get();
        String effectiveOrderId = txn.getOrderId();

        // 9. Amount Validation
        if (dto.getAmount() != null) {
            BigDecimal cbAmount = dto.getAmount();
            if (cbAmount.compareTo(txn.getAmount()) != 0) {
                log.warn("[SECURITY_ALERT] PAYOUT_CALLBACK_AMOUNT_MISMATCH: orderId={}, expected={}, got={}, ip={}",
                        effectiveOrderId, txn.getAmount(), cbAmount, safeIp);
                saveEvent(dto.getEventId(), effectiveOrderId, providerTxnId, payloadHash,
                        verificationMethod, verificationResult, "AMOUNT_MISMATCH", "AMOUNT_MISMATCH", 400,
                        "Amount mismatch: expected " + txn.getAmount() + " but received " + cbAmount, rawPayload, safeIp);
                return ResponseEntity.badRequest().body(
                        BusstoWebhookResponse.builder()
                                .success(false)
                                .status("REJECTED")
                                .message("Amount mismatch for payout order " + effectiveOrderId)
                                .orderId(effectiveOrderId)
                                .build()
                );
            }
        }

        // 9b. Currency Validation
        if (dto.getCurrency() != null && !dto.getCurrency().isBlank()) {
            String cbCurrency = dto.getCurrency().trim().toUpperCase();
            if (!"INR".equals(cbCurrency)) {
                log.warn("[SECURITY_ALERT] PAYOUT_CALLBACK_CURRENCY_MISMATCH: orderId={}, expected=INR, got={}, ip={}",
                        effectiveOrderId, cbCurrency, safeIp);
                saveEvent(dto.getEventId(), effectiveOrderId, providerTxnId, payloadHash,
                        verificationMethod, verificationResult, "CURRENCY_MISMATCH", "CURRENCY_MISMATCH", 400,
                        "Currency mismatch: expected INR but received " + cbCurrency, rawPayload, safeIp);
                return ResponseEntity.badRequest().body(
                        BusstoWebhookResponse.builder()
                                .success(false)
                                .status("REJECTED")
                                .message("Currency mismatch: expected INR but received " + cbCurrency)
                                .orderId(effectiveOrderId)
                                .build()
                );
            }
        }

        // 10. Map Provider Status
        String rawStatus = dto.getStatus() != null ? dto.getStatus().trim() : "";
        String mappedStatus = mapProviderStatus(rawStatus);

        // 11. Compensating Control: Authoritative Server-to-Server Verification
        // If the callback arrived as unencrypted plain JSON and header authentication was missing/unverified,
        // we strictly invoke server-to-server status inquiry before applying any status transition.
        if (!"VERIFIED".equals(verificationResult)) {
            log.info("[BUSSTO_WEBHOOK_COMPENSATING] Performing server-to-server status inquiry for order: {}", effectiveOrderId);
            try {
                PayoutResponse s2sResponse = payoutService.checkPayoutStatus(effectiveOrderId, "WEBHOOK:BUSSTO");
                if (s2sResponse != null && (s2sResponse.getStatus().equalsIgnoreCase(mappedStatus)
                        || "SUCCESS".equalsIgnoreCase(s2sResponse.getStatus())
                        || "FAILED".equalsIgnoreCase(s2sResponse.getStatus()))) {
                    verificationMethod = "S2S_INQUIRY";
                    verificationResult = "VERIFIED";
                    mappedStatus = s2sResponse.getStatus();
                    log.info("[BUSSTO_WEBHOOK_COMPENSATING] S2S inquiry verified status {} for order {}", mappedStatus, effectiveOrderId);
                } else {
                    log.warn("[SECURITY_ALERT] S2S inquiry could not verify callback status: orderId={}, cbStatus={}, s2sStatus={}",
                            effectiveOrderId, mappedStatus, s2sResponse != null ? s2sResponse.getStatus() : "null");
                    saveEvent(dto.getEventId(), effectiveOrderId, providerTxnId, payloadHash,
                            "S2S_INQUIRY", "FAILED", "VERIFICATION_FAILED", "S2S_VERIFICATION_MISMATCH", 401,
                            "Provider status enquiry did not confirm callback payload", rawPayload, safeIp);
                    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                            BusstoWebhookResponse.builder()
                                    .success(false)
                                    .status("REJECTED")
                                    .message("Server-to-server inquiry did not verify callback authenticity")
                                    .orderId(effectiveOrderId)
                                    .build()
                    );
                }
            } catch (Exception e) {
                log.error("[SECURITY_ALERT] Failed to run compensating S2S verification for order {}: {}", effectiveOrderId, e.getMessage());
                saveEvent(dto.getEventId(), effectiveOrderId, providerTxnId, payloadHash,
                        "S2S_INQUIRY", "FAILED", "VERIFICATION_FAILED", "S2S_INQUIRY_ERROR", 401,
                        "Failed to verify callback with provider server: " + e.getMessage(), rawPayload, safeIp);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                        BusstoWebhookResponse.builder()
                                .success(false)
                                .status("ERROR")
                                .message("Could not verify callback authenticity with provider")
                                .orderId(effectiveOrderId)
                                .build()
                );
            }
        }

        // 12. Apply Strict Status Transitions & Financial Safeguards
        String currentStatus = txn.getStatus() != null ? txn.getStatus().toUpperCase() : "PENDING";
        log.info("[BUSSTO_WEBHOOK] Processing status transition for order {}: current={}, incomingMapped={}, raw={}",
                effectiveOrderId, currentStatus, mappedStatus, rawStatus);

        boolean statusUpdated = false;

        switch (currentStatus) {
            case "PENDING", "INITIATED", "PROCESSING" -> {
                if ("SUCCESS".equalsIgnoreCase(mappedStatus)) {
                    // PENDING -> SUCCESS
                    txn.setStatus("SUCCESS");
                    if (dto.getStatusCode() != null) txn.setStatusCode(dto.getStatusCode());
                    if (providerTxnId != null && !providerTxnId.isBlank()) txn.setProviderTxnId(providerTxnId);
                    if (dto.getUtr() != null && !dto.getUtr().isBlank()) txn.setUtr(dto.getUtr().trim());
                    String successMsg = dto.getReason() != null && !dto.getReason().isBlank()
                            ? dto.getReason() : "Payout transferred successfully via provider callback";
                    txn.setResponseMessage(successMsg);
                    txn.setResponseData(normalizedJson);
                    payoutTransactionRepository.save(txn);

                    payoutAuditService.recordStatusChange(txn, currentStatus, "SUCCESS", rawStatus,
                            txn.getProviderTxnId(), txn.getUtr(), "WEBHOOK:BUSSTO",
                            "Payout confirmed SUCCESS via Bussto webhook callback");
                    statusUpdated = true;
                    // Wallet debit was performed on initiation; strictly preserve it without double debit.

                } else if ("FAILED".equalsIgnoreCase(mappedStatus)) {
                    // PENDING -> FAILED
                    txn.setStatus("FAILED");
                    if (dto.getStatusCode() != null) txn.setStatusCode(dto.getStatusCode());
                    if (providerTxnId != null && !providerTxnId.isBlank()) txn.setProviderTxnId(providerTxnId);
                    String failMsg = dto.getReason() != null && !dto.getReason().isBlank()
                            ? dto.getReason() : "Payout rejected per provider callback";
                    txn.setResponseMessage(failMsg);
                    txn.setResponseData(normalizedJson);
                    payoutTransactionRepository.save(txn);

                    BigDecimal refundAmt = txn.getTotalDeductedAmount() != null
                            ? txn.getTotalDeductedAmount() : txn.getAmount();
                    payoutService.executeRefund(txn, refundAmt, "Bussto callback confirmed failure: " + failMsg);

                    payoutAuditService.recordStatusChange(txn, currentStatus, "FAILED", rawStatus,
                            txn.getProviderTxnId(), txn.getUtr(), "WEBHOOK:BUSSTO",
                            "Payout marked FAILED via Bussto callback; refunded ₹" + refundAmt);
                    statusUpdated = true;

                } else if ("PENDING".equalsIgnoreCase(mappedStatus)) {
                    // PENDING -> PENDING
                    if (providerTxnId != null && !providerTxnId.isBlank()) txn.setProviderTxnId(providerTxnId);
                    if (dto.getUtr() != null && !dto.getUtr().isBlank()) txn.setUtr(dto.getUtr().trim());
                    payoutTransactionRepository.save(txn);
                    log.info("[BUSSTO_WEBHOOK] Payout order {} remains in PENDING/PROCESSING state", effectiveOrderId);

                } else {
                    log.warn("[BUSSTO_WEBHOOK] Unknown status received for order {}: rawStatus={}", effectiveOrderId, rawStatus);
                }
            }
            case "SUCCESS" -> {
                if ("SUCCESS".equalsIgnoreCase(mappedStatus)) {
                    log.info("[BUSSTO_WEBHOOK_DUPLICATE] Duplicate SUCCESS callback for already finalized order {}", effectiveOrderId);
                } else if ("PENDING".equalsIgnoreCase(mappedStatus)) {
                    log.info("[BUSSTO_WEBHOOK_SAFEGUARD] Delayed PENDING callback received for finalized SUCCESS order {}. Ignored.", effectiveOrderId);
                } else if ("FAILED".equalsIgnoreCase(mappedStatus)) {
                    log.warn("[FINANCIAL_ALERT] Conflicting FAILED callback received for already SUCCESS order {}. Quarantined without refund.", effectiveOrderId);
                    payoutAuditService.recordStatusChange(txn, "SUCCESS", "SUCCESS", rawStatus,
                            providerTxnId, dto.getUtr(), "WEBHOOK:BUSSTO",
                            "SECURITY CONFLICT: Provider sent FAILED callback after SUCCESS was finalized. Preserved SUCCESS.");
                }
            }
            case "FAILED" -> {
                if ("FAILED".equalsIgnoreCase(mappedStatus)) {
                    log.info("[BUSSTO_WEBHOOK_DUPLICATE] Duplicate FAILED callback for already finalized/refunded order {}", effectiveOrderId);
                } else if ("PENDING".equalsIgnoreCase(mappedStatus)) {
                    log.info("[BUSSTO_WEBHOOK_SAFEGUARD] Delayed PENDING callback received for finalized FAILED order {}. Ignored.", effectiveOrderId);
                } else if ("SUCCESS".equalsIgnoreCase(mappedStatus)) {
                    log.warn("[FINANCIAL_ALERT] Conflicting SUCCESS callback received for already FAILED order {}. Quarantined.", effectiveOrderId);
                    payoutAuditService.recordStatusChange(txn, "FAILED", "FAILED", rawStatus,
                            providerTxnId, dto.getUtr(), "WEBHOOK:BUSSTO",
                            "SECURITY CONFLICT: Provider sent SUCCESS callback after FAILED was finalized. Preserved FAILED.");
                }
            }
            default -> log.warn("[BUSSTO_WEBHOOK] Unrecognized existing transaction status: {}", currentStatus);
        }

        // 13. Persist Event Audit Log
        saveEvent(dto.getEventId(), effectiveOrderId, txn.getProviderTxnId(), payloadHash,
                verificationMethod, verificationResult, "PROCESSED", rawStatus, 200,
                statusUpdated ? "Transaction status updated to " + txn.getStatus() : "Event acknowledged without status alteration",
                rawPayload, safeIp);

        return ResponseEntity.ok(
                BusstoWebhookResponse.builder()
                        .success(true)
                        .status(txn.getStatus())
                        .message(statusUpdated
                                ? "Payout transaction updated to " + txn.getStatus()
                                : "Callback acknowledged for transaction " + effectiveOrderId)
                        .orderId(effectiveOrderId)
                        .providerTxnId(txn.getProviderTxnId())
                        .utr(txn.getUtr())
                        .build()
        );
    }

    @Override
    public Page<PayoutWebhookEvent> getRecentWebhookEvents(Pageable pageable) {
        return payoutWebhookEventRepository.findAllByOrderByCreatedAtDesc(pageable);
    }

    private String mapProviderStatus(String status) {
        if (status == null || status.isBlank()) return "UNKNOWN";
        String s = status.trim().toUpperCase();
        return switch (s) {
            case "SUCCESS", "SUCCESSFUL", "COMPLETED" -> "SUCCESS";
            case "FAILED", "FAILURE", "REJECTED", "DECLINED" -> "FAILED";
            case "PENDING", "PROCESSING", "INITIATED", "ACCEPTED", "IN_PROGRESS" -> "PENDING";
            default -> "UNKNOWN";
        };
    }

    private record DecryptedPayloadResult(boolean success, boolean wasEncrypted, String jsonPayload, String errorMessage) {}

    private DecryptedPayloadResult normalizeAndDecrypt(String rawPayload) {
        String trimmed = rawPayload.trim();
        try {
            if (trimmed.startsWith("{")) {
                JsonNode root = objectMapper.readTree(trimmed);
                String cipherCandidate = null;
                if (root.has("response") && !root.get("response").isNull()) {
                    cipherCandidate = root.get("response").asText();
                } else if (root.has("request") && !root.get("request").isNull()) {
                    cipherCandidate = root.get("request").asText();
                } else if (root.has("encrypted_payload") && !root.get("encrypted_payload").isNull()) {
                    cipherCandidate = root.get("encrypted_payload").asText();
                }

                if (cipherCandidate != null && !cipherCandidate.isBlank()) {
                    String decrypted = BusttoCryptoUtil.decrypt(payoutProperties.getAesKey(), cipherCandidate);
                    return new DecryptedPayloadResult(true, true, decrypted, null);
                }

                // Plain JSON payload
                return new DecryptedPayloadResult(true, false, trimmed, null);
            } else {
                // Raw Base64 string payload
                String decrypted = BusttoCryptoUtil.decrypt(payoutProperties.getAesKey(), trimmed);
                return new DecryptedPayloadResult(true, true, decrypted, null);
            }
        } catch (Exception e) {
            return new DecryptedPayloadResult(false, false, null, e.getMessage());
        }
    }

    private record AuthHeaderResult(boolean verified, boolean failed, String method, String failureReason) {}

    private AuthHeaderResult verifyAuthenticationHeaders(String rawPayload, HttpHeaders headers) {
        if (headers == null) return new AuthHeaderResult(false, false, "NONE", null);

        // 1. Shared Webhook Secret Verification
        String configuredWebhookSecret = payoutProperties.getWebhookSecret();
        if (configuredWebhookSecret != null && !configuredWebhookSecret.isBlank()) {
            String incomingSecret = getFirstHeader(headers, "X-Webhook-Secret", "X-Bustto-Secret", "X-Callback-Secret", "X-Callback-Token");
            if (incomingSecret != null) {
                if (constantTimeEquals(configuredWebhookSecret.trim(), incomingSecret.trim())) {
                    return new AuthHeaderResult(true, false, "SHARED_SECRET", null);
                } else {
                    return new AuthHeaderResult(false, true, "SHARED_SECRET", "Invalid webhook secret");
                }
            }

            // HMAC Signature check with webhook secret
            String incomingSig = getFirstHeader(headers, "X-Bustto-Signature", "X-Signature", "X-Hub-Signature-256");
            if (incomingSig != null) {
                if (verifyHmacSha256(rawPayload, configuredWebhookSecret.trim(), incomingSig.trim())) {
                    return new AuthHeaderResult(true, false, "HMAC_SHA256", null);
                } else {
                    return new AuthHeaderResult(false, true, "HMAC_SHA256", "Invalid webhook signature");
                }
            }
        }

        // 2. Api-Key Header Verification
        String configuredApiKey = payoutProperties.getApiKey();
        if (configuredApiKey != null && !configuredApiKey.isBlank()) {
            String incomingApiKey = getFirstHeader(headers, "Api-Key", "X-Api-Key", "api-key", "x-api-key");
            if (incomingApiKey != null) {
                if (constantTimeEquals(configuredApiKey.trim(), incomingApiKey.trim())) {
                    return new AuthHeaderResult(true, false, "API_KEY", null);
                } else {
                    return new AuthHeaderResult(false, true, "API_KEY", "Invalid API key");
                }
            }
        }

        // 3. Bearer Token Verification
        String authHeader = headers.getFirst("Authorization");
        if (authHeader != null && authHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String token = authHeader.substring(7).trim();
            if (configuredWebhookSecret != null) {
                if (constantTimeEquals(configuredWebhookSecret.trim(), token)) {
                    return new AuthHeaderResult(true, false, "BEARER_SECRET", null);
                } else {
                    return new AuthHeaderResult(false, true, "BEARER_SECRET", "Invalid Bearer token");
                }
            }
        }

        return new AuthHeaderResult(false, false, "NONE", null);
    }

    private boolean verifyHmacSha256(String data, String key, String signature) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computedBytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            String computedHex = HexFormat.of().formatHex(computedBytes);
            String cleanProvided = signature.startsWith("sha256=") ? signature.substring(7) : signature;
            return constantTimeEquals(computedHex, cleanProvided.toLowerCase());
        } catch (Exception e) {
            log.warn("HMAC verification failed: {}", e.getMessage());
            return false;
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    private String getFirstHeader(HttpHeaders headers, String... candidateNames) {
        for (String name : candidateNames) {
            String val = headers.getFirst(name);
            if (val != null && !val.isBlank()) {
                return val;
            }
        }
        return null;
    }

    private BusstoPayoutWebhookDto parseWebhookDto(String json) throws Exception {
        JsonNode root = objectMapper.readTree(json);
        JsonNode target = root;

        // Check if data is encapsulated in a sub-object
        if (root.has("TransactionData") && root.get("TransactionData").isObject()) {
            target = root.get("TransactionData");
        } else if (root.has("data") && root.get("data").isObject()) {
            target = root.get("data");
        } else if (root.has("body") && root.get("body").isObject()) {
            target = root.get("body");
        }

        BusstoPayoutWebhookDto dto = objectMapper.treeToValue(target, BusstoPayoutWebhookDto.class);

        // Fallbacks from root if child lacked specific values
        if ((dto.getOrderId() == null || dto.getOrderId().isBlank()) && root != target) {
            for (String key : List.of("external_order_id", "orderId", "order_id", "client_ref_id", "client_order_id")) {
                if (root.has(key) && !root.get(key).isNull()) {
                    dto.setOrderId(root.get(key).asText());
                    break;
                }
            }
        }
        if ((dto.getProviderTxnId() == null || dto.getProviderTxnId().isBlank()) && root != target) {
            for (String key : List.of("bbTransactionId", "bb_transaction_id", "transaction_id", "transactionId")) {
                if (root.has(key) && !root.get(key).isNull()) {
                    dto.setProviderTxnId(root.get(key).asText());
                    break;
                }
            }
        }
        if ((dto.getStatus() == null || dto.getStatus().isBlank()) && root != target) {
            for (String key : List.of("bbTransactionStatus", "bb_transaction_status", "status", "txnStatus")) {
                if (root.has(key) && !root.get(key).isNull()) {
                    dto.setStatus(root.get(key).asText());
                    break;
                }
            }
        }
        if (dto.getAmount() == null && root != target) {
            for (String key : List.of("amount", "txnAmount", "transaction_amount")) {
                if (root.has(key) && !root.get(key).isNull()) {
                    try {
                        dto.setAmount(new BigDecimal(root.get(key).asText()));
                        break;
                    } catch (Exception ignored) {}
                }
            }
        }
        if ((dto.getUtr() == null || dto.getUtr().isBlank()) && root != target) {
            for (String key : List.of("bbUtrNumber", "bb_utr_number", "utr", "utrNumber", "rrn")) {
                if (root.has(key) && !root.get(key).isNull()) {
                    dto.setUtr(root.get(key).asText());
                    break;
                }
            }
        }
        if ((dto.getReason() == null || dto.getReason().isBlank()) && root != target) {
            for (String key : List.of("bbReason", "bb_reason", "reason", "message", "bbStatusMsg", "msg")) {
                if (root.has(key) && !root.get(key).isNull()) {
                    dto.setReason(root.get(key).asText());
                    break;
                }
            }
        }

        return dto;
    }

    private String computeSha256(String data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            return String.valueOf(data.hashCode());
        }
    }

    private void saveEvent(String eventId, String orderId, String providerTxnId, String payloadHash,
                           String verificationMethod, String verificationResult, String processingStatus,
                           String providerStatus, int httpStatusCode, String errorMessage, String rawPayload, String ipAddress) {
        try {
            PayoutWebhookEvent event = PayoutWebhookEvent.builder()
                    .eventId(eventId)
                    .orderId(orderId)
                    .providerTxnId(providerTxnId)
                    .payloadHash(payloadHash)
                    .verificationMethod(verificationMethod)
                    .verificationResult(verificationResult)
                    .processingStatus(processingStatus)
                    .providerStatus(providerStatus)
                    .httpStatusCode(httpStatusCode)
                    .errorMessage(errorMessage)
                    .rawPayload(rawPayload)
                    .ipAddress(ipAddress)
                    .processedAt(LocalDateTime.now())
                    .build();
            payoutWebhookEventRepository.save(event);
        } catch (Exception e) {
            log.error("Failed to record webhook event in DB: {}", e.getMessage(), e);
        }
    }
}
