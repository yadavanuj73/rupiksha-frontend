package com.rupiksha.backend.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.backend.api.dto.FingpayCmsDtos;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.service.FingpayCmsService;
import com.rupiksha.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class FingpayCmsServiceImpl implements FingpayCmsService {

    private final UserRepository userRepository;
    private final UserServiceRepository userServiceRepository;
    private final WalletService walletService;
    private final WalletRepository walletRepository;
    private final TxnRepository txnRepository;
    private final FingpayCmsTransactionRepository cmsTransactionRepository;
    private final ObjectMapper objectMapper;

    @Value("${fingpay.cms.launch-url:https://fpcorp.tapits.in/UberCMSBC/#/login}")
    private String launchUrl;

    @Value("${fingpay.cms.supermerchant-id:1407}")
    private String supermerchantId;

    @Value("${fingpay.cms.supermerchant-skey:1234567891011121}")
    private String supermerchantSkey;

    @Value("${fingpay.cms.skey:1b271b5bb9d119e6004d588f80737bf5fbb9bb3bbe40834839e26bb93d2e6a}")
    private String skey;

    @Value("${fingpay.cms.security-key:1234567890;}")
    private String securityKey;

    @Value("${fingpay.cms.funding-mode:RUPIKSHA_WALLET}")
    private String fundingMode;

    @Value("${fingpay.cms.login-type:2}")
    private String loginType;

    @Override
    @Transactional(readOnly = true)
    public FingpayCmsDtos.LaunchResponse generateLaunchUrl(UUID userId, FingpayCmsDtos.LaunchRequest request, String ipAddress) {
        log.info("Generating Fingpay CMS launch URL for userId: {}, ip: {}", userId, ipAddress);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id: " + userId));

        // Check if CMS service is enabled for user
        Optional<UserService> serviceOpt = userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.CMS);
        if (serviceOpt.isPresent() && Boolean.FALSE.equals(serviceOpt.get().getIsEnabled())) {
            throw new IllegalStateException("CMS service is disabled for this account. Please contact administrator.");
        }

        // Resolve merchant credentials
        String merchantId = resolveMerchantId(user);
        String merchantPin = resolveMerchantPin(user, merchantId);
        String mobileNumber = user.getMobile() != null ? user.getMobile().replaceAll("[^0-9]", "") : "";
        if (mobileNumber.length() > 10) {
            mobileNumber = mobileNumber.substring(mobileNumber.length() - 10);
        }

        String latitude = (request != null && request.getLatitude() != null && !request.getLatitude().isBlank())
                ? request.getLatitude().trim() : "19.0760";
        String longitude = (request != null && request.getLongitude() != null && !request.getLongitude().isBlank())
                ? request.getLongitude().trim() : "72.8777";

        try {
            // Build request model matching Fingpay Uber CMS specification
            Map<String, Object> payloadMap = new LinkedHashMap<>();
            payloadMap.put("additionalParams", null);
            payloadMap.put("latitude", latitude);
            payloadMap.put("loginType", loginType);
            payloadMap.put("longitude", longitude);
            payloadMap.put("supermerchantId", supermerchantId);
            payloadMap.put("merchantId", merchantId);
            payloadMap.put("merchantPin", merchantPin);
            String payloadSkey = resolvePayloadSkey(supermerchantSkey);
            payloadMap.put("superMerchantSkey", payloadSkey);

            String jsonPayload = objectMapper.writeValueAsString(payloadMap);
            log.info("Fingpay CMS auth payload generated for merchantId: {}, supermerchantId: {}", merchantId, supermerchantId);

            // Encrypt using AES/ECB/PKCS5Padding & double-base64 encode per Fingpay Uber CMS doc
            String encryptedData = encryptPayload(jsonPayload, supermerchantSkey);

            // Construct approved Fingpay CMS URL
            String urlSkey = resolveUrlSkey(skey);
            String fullLaunchUrl = launchUrl + "?data=" + encryptedData + "&skey=" + urlSkey;

            return FingpayCmsDtos.LaunchResponse.builder()
                    .success(true)
                    .message("Fingpay CMS launch URL generated successfully")
                    .launchUrl(fullLaunchUrl)
                    .merchantId(merchantId)
                    .mobileNumber(mobileNumber)
                    .supermerchantId(supermerchantId)
                    .build();

        } catch (Exception e) {
            log.error("Failed to generate Fingpay CMS launch URL: {}", e.getMessage(), e);
            throw new RuntimeException("Could not encrypt CMS launch authentication payload: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public FingpayCmsDtos.DebitCallbackResponse processDebitCallback(String rawBody, String hashHeader, String ipAddress) {
        log.info("Processing Fingpay CMS debit callback from IP: {}, hash: {}", ipAddress, hashHeader);

        // 1. Cryptographic authentication
        if (!verifyHash(rawBody, securityKey, hashHeader)) {
            log.warn("Fingpay CMS debit callback signature verification failed for IP: {}", ipAddress);
            return FingpayCmsDtos.DebitCallbackResponse.builder()
                    .merchantTransactionId("N/A")
                    .status(false)
                    .errorMessage("Invalid authentication signature")
                    .build();
        }

        // 2. Parse request body
        FingpayCmsDtos.DebitCallbackRequest request;
        try {
            request = objectMapper.readValue(rawBody, FingpayCmsDtos.DebitCallbackRequest.class);
        } catch (Exception e) {
            log.error("Failed to parse Fingpay CMS debit callback JSON: {}", e.getMessage());
            return FingpayCmsDtos.DebitCallbackResponse.builder()
                    .merchantTransactionId("N/A")
                    .status(false)
                    .errorMessage("Malformed JSON payload: " + e.getMessage())
                    .build();
        }

        if (request.getFpTransactionId() == null || request.getFpTransactionId().isBlank()) {
            return FingpayCmsDtos.DebitCallbackResponse.builder()
                    .merchantTransactionId("N/A")
                    .status(false)
                    .errorMessage("Missing mandatory field: fpTransactionId")
                    .build();
        }

        String fpTxnId = request.getFpTransactionId().trim();
        String txnStatus = request.getTransactionStatus() != null ? request.getTransactionStatus().trim().toUpperCase() : "I";
        BigDecimal amount = request.getAmount() != null ? BigDecimal.valueOf(request.getAmount()) : BigDecimal.ZERO;

        // 3. Idempotency & existing record check
        Optional<FingpayCmsTransaction> existingOpt = cmsTransactionRepository.findByFpTransactionId(fpTxnId);

        if (existingOpt.isPresent()) {
            FingpayCmsTransaction existing = existingOpt.get();
            log.info("Fingpay CMS existing transaction found: {}, internalStatus: {}, incomingStatus: {}",
                    fpTxnId, existing.getInternalStatus(), txnStatus);

            if ("I".equals(txnStatus) || "P".equals(txnStatus) || "PENDING".equals(txnStatus) || "INITIATED".equals(txnStatus)) {
                // Repeated initiation or pending callback: respond with existing acceptance
                return FingpayCmsDtos.DebitCallbackResponse.builder()
                        .merchantTransactionId(existing.getMerchantTransactionId())
                        .status("SUCCESS".equals(existing.getInternalStatus()) || "INITIATED".equals(existing.getInternalStatus()))
                        .errorMessage(existing.getErrorMessage() != null ? existing.getErrorMessage() : "Transaction already processed")
                        .build();
            } else if ("S".equals(txnStatus) || "SUCCESS".equals(txnStatus)) {
                // Final Success status callback
                if (!"SUCCESS".equals(existing.getInternalStatus())) {
                    existing.setInternalStatus("SUCCESS");
                    existing.setProviderStatus("S");
                    existing.setUpdatedAt(Instant.now());
                    if (request.getErrorMessage() != null) {
                        existing.setErrorMessage(request.getErrorMessage());
                    }
                    cmsTransactionRepository.save(existing);

                    // Update corresponding Txn if exists
                    if (existing.getTxn() != null) {
                        Txn txn = existing.getTxn();
                        txn.setStatus(TransactionStatus.SUCCESS);
                        txnRepository.save(txn);
                    }
                }
                return FingpayCmsDtos.DebitCallbackResponse.builder()
                        .merchantTransactionId(existing.getMerchantTransactionId())
                        .status(true)
                        .errorMessage("received")
                        .build();

            } else if ("F".equals(txnStatus) || "FAILED".equals(txnStatus) || "FAILURE".equals(txnStatus)) {
                // Final Failure status callback
                if (!"FAILED".equals(existing.getInternalStatus())) {
                    // Check if wallet was debited and refund if applicable
                    if ("RUPIKSHA_WALLET".equalsIgnoreCase(fundingMode)
                            && existing.getWalletEntryId() != null
                            && existing.getRefundWalletEntryId() == null) {
                        try {
                            String refundIdemKey = "CMS-REF-" + fpTxnId;
                            WalletDtos.WalletBalanceResponse refundRes = walletService.refundForService(
                                    existing.getUser().getId(),
                                    existing.getAmount(),
                                    "Fingpay CMS Reversal for Failed Txn: " + fpTxnId,
                                    fpTxnId,
                                    WalletTransactionContext.CMS_REFUND,
                                    "CMS",
                                    ipAddress,
                                    refundIdemKey
                            );
                            log.info("Idempotent wallet refund executed for failed CMS txn: {}", fpTxnId);
                        } catch (Exception ex) {
                            log.error("Failed to process wallet refund for CMS txn {}: {}", fpTxnId, ex.getMessage(), ex);
                        }
                    }

                    existing.setInternalStatus("FAILED");
                    existing.setProviderStatus("F");
                    existing.setErrorMessage(request.getErrorMessage() != null ? request.getErrorMessage() : "Provider reported failure");
                    existing.setUpdatedAt(Instant.now());
                    cmsTransactionRepository.save(existing);

                    if (existing.getTxn() != null) {
                        Txn txn = existing.getTxn();
                        txn.setStatus(TransactionStatus.FAILED);
                        txnRepository.save(txn);
                    }
                }
                return FingpayCmsDtos.DebitCallbackResponse.builder()
                        .merchantTransactionId(existing.getMerchantTransactionId())
                        .status(true)
                        .errorMessage("received")
                        .build();
            }
        }

        // 4. Handle initial Initiation callback ("I")
        User user = resolveUserByBcLoginId(request.getBcLoginId());
        if (user == null) {
            log.warn("Fingpay CMS BC login ID not found in system: {}", request.getBcLoginId());
            return FingpayCmsDtos.DebitCallbackResponse.builder()
                    .merchantTransactionId("UNKNOWN")
                    .status(false)
                    .errorMessage("BC account mapping not found for bcLoginId: " + request.getBcLoginId())
                    .build();
        }

        String merchantTxnId = "RXCMS" + System.currentTimeMillis() + (int)(Math.random() * 900 + 100);
        UUID walletEntryId = null;

        // Perform financial wallet debit if Rupiksha wallet funding model applies
        if ("RUPIKSHA_WALLET".equalsIgnoreCase(fundingMode)) {
            WalletDtos.WalletBalanceResponse bal = walletService.getBalance(user.getId().toString());
            BigDecimal avail = bal.availableBalance() != null ? bal.availableBalance() : BigDecimal.ZERO;

            if (avail.compareTo(amount) < 0) {
                log.warn("Insufficient BC wallet balance for user {}. Required: {}, Available: {}",
                        user.getUsername(), amount, avail);

                persistCmsTransaction(user, null, request, merchantTxnId, "FAILED", txnStatus,
                        "Insufficient wallet balance. Available: ₹" + avail, rawBody, hashHeader, null);

                return FingpayCmsDtos.DebitCallbackResponse.builder()
                        .merchantTransactionId(merchantTxnId)
                        .status(false)
                        .errorMessage("Insufficient BC wallet balance")
                        .build();
            }

            try {
                WalletDtos.WalletBalanceResponse debitRes = walletService.debitForService(
                        user.getId(),
                        amount,
                        "Fingpay CMS Debit for " + request.getTypeOfTransaction() + " (FP Txn: " + fpTxnId + ")",
                        WalletTransactionContext.CMS_DEBIT,
                        "CMS",
                        ipAddress,
                        fpTxnId
                );
                log.info("BC wallet debited successfully for CMS txn: {}, newBalance: {}", fpTxnId, debitRes.balance());
            } catch (Exception ex) {
                log.error("Failed to debit BC wallet for CMS txn {}: {}", fpTxnId, ex.getMessage(), ex);
                return FingpayCmsDtos.DebitCallbackResponse.builder()
                        .merchantTransactionId(merchantTxnId)
                        .status(false)
                        .errorMessage("Wallet debit operation failed: " + ex.getMessage())
                        .build();
            }
        }

        // 5. Persist core Txn record for ledger & history
        Txn txn = new Txn();
        txn.setUser(user);
        txn.setServiceType("CMS");
        txn.setAmount(amount);
        txn.setStatus("S".equals(txnStatus) ? TransactionStatus.SUCCESS : TransactionStatus.INITIATED);
        txn.setProviderRef(fpTxnId);
        txn.setIdempotencyKey(fpTxnId);
        txnRepository.save(txn);

        // 6. Persist FingpayCmsTransaction
        persistCmsTransaction(user, txn, request, merchantTxnId,
                "S".equals(txnStatus) ? "SUCCESS" : "INITIATED", txnStatus,
                request.getErrorMessage(), rawBody, hashHeader, walletEntryId);

        log.info("Fingpay CMS debit callback acknowledged successfully with merchantTxnId: {}", merchantTxnId);
        return FingpayCmsDtos.DebitCallbackResponse.builder()
                .merchantTransactionId(merchantTxnId)
                .status(true)
                .errorMessage("Transaction accepted")
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public FingpayCmsDtos.BalanceCheckResponse processBalanceCheck(String rawBody, String hashHeader, String ipAddress) {
        log.info("Processing Fingpay CMS balance-check request from IP: {}, hash: {}", ipAddress, hashHeader);

        if (!verifyHash(rawBody, securityKey, hashHeader)) {
            log.warn("Fingpay CMS balance-check signature verification failed for IP: {}", ipAddress);
            return FingpayCmsDtos.BalanceCheckResponse.builder()
                    .status(false)
                    .errorMessage("Invalid authentication signature")
                    .bcBalances(Collections.emptyList())
                    .build();
        }

        FingpayCmsDtos.BalanceCheckRequest request;
        try {
            request = objectMapper.readValue(rawBody, FingpayCmsDtos.BalanceCheckRequest.class);
        } catch (Exception e) {
            log.error("Failed to parse Fingpay CMS balance-check JSON: {}", e.getMessage());
            return FingpayCmsDtos.BalanceCheckResponse.builder()
                    .status(false)
                    .errorMessage("Malformed JSON payload: " + e.getMessage())
                    .bcBalances(Collections.emptyList())
                    .build();
        }

        List<FingpayCmsDtos.BcBalanceItem> balances = new ArrayList<>();
        if (request.getBcLoginIds() != null) {
            for (String bcLoginId : request.getBcLoginIds()) {
                if (bcLoginId == null || bcLoginId.isBlank()) continue;
                String cleanId = bcLoginId.trim();
                User user = resolveUserByBcLoginId(cleanId);
                Double balanceVal = 0.00;
                if (user != null) {
                    Optional<Wallet> walletOpt = walletRepository.findByUserId(user.getId());
                    if (walletOpt.isPresent() && walletOpt.get().getBalance() != null) {
                        balanceVal = walletOpt.get().getBalance().doubleValue();
                    }
                }
                balances.add(new FingpayCmsDtos.BcBalanceItem(cleanId, balanceVal));
            }
        }

        return FingpayCmsDtos.BalanceCheckResponse.builder()
                .status(true)
                .errorMessage("Success")
                .bcBalances(balances)
                .build();
    }

    private void persistCmsTransaction(User user, Txn txn, FingpayCmsDtos.DebitCallbackRequest request,
                                       String merchantTxnId, String internalStatus, String providerStatus,
                                       String errorMsg, String rawBody, String hash, UUID walletEntryId) {
        FingpayCmsTransaction cmsTxn = new FingpayCmsTransaction();
        cmsTxn.setUser(user);
        cmsTxn.setTxn(txn);
        cmsTxn.setFpTransactionId(request.getFpTransactionId().trim());
        cmsTxn.setMerchantTransactionId(merchantTxnId);
        cmsTxn.setBcLoginId(request.getBcLoginId() != null ? request.getBcLoginId().trim() : user.getUsername());
        cmsTxn.setTypeOfTransaction(request.getTypeOfTransaction() != null ? request.getTypeOfTransaction() : "CDC");
        cmsTxn.setAmount(request.getAmount() != null ? BigDecimal.valueOf(request.getAmount()) : BigDecimal.ZERO);
        cmsTxn.setProviderStatus(providerStatus);
        cmsTxn.setInternalStatus(internalStatus);
        cmsTxn.setErrorMessage(errorMsg);
        cmsTxn.setRemarks(request.getRemarks());
        cmsTxn.setWalletEntryId(walletEntryId);
        cmsTxn.setCallbackHash(hash);
        cmsTxn.setRawCallbackPayload(rawBody);
        cmsTxn.setProviderTimestamp(request.getTransactionTimestamp());
        cmsTransactionRepository.save(cmsTxn);
    }

    public User resolveUserByBcLoginId(String bcLoginId) {
        if (bcLoginId == null || bcLoginId.isBlank()) return null;
        String id = bcLoginId.trim();

        return userRepository.findByCmsMerchantId(id)
                .or(() -> userRepository.findByPartyCode(id))
                .or(() -> userRepository.findByAepsMerchantId(id))
                .or(() -> userRepository.findByAepsAgentId(id))
                .or(() -> userRepository.findByUsername(id))
                .or(() -> userRepository.findByMobile(id))
                .or(() -> {
                    if (id.length() > 10) {
                        return userRepository.findByMobile(id.substring(id.length() - 10));
                    }
                    return Optional.empty();
                })
                .orElse(null);
    }

    private String resolveMerchantId(User user) {
        if (user.getCmsMerchantId() != null && !user.getCmsMerchantId().isBlank()) {
            return user.getCmsMerchantId().trim();
        }
        if (user.getPartyCode() != null && !user.getPartyCode().isBlank()) {
            return user.getPartyCode().trim();
        }
        if (user.getAepsMerchantId() != null && !user.getAepsMerchantId().isBlank()) {
            return user.getAepsMerchantId().trim();
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername().trim();
        }
        return user.getMobile() != null ? user.getMobile().trim() : "MERCHANT";
    }

    private String resolveMerchantPin(User user, String fallbackMerchantId) {
        if (user.getCmsMerchantPin() != null && !user.getCmsMerchantPin().isBlank()) {
            return user.getCmsMerchantPin().trim();
        }
        return fallbackMerchantId;
    }

    public String encryptPayload(String jsonPayload, String superMerchantSkey) throws Exception {
        byte[] keyBytes = resolveKeyBytes(superMerchantSkey);

        SecretKeySpec secretKeySpec = new SecretKeySpec(keyBytes, "AES");
        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKeySpec);

        byte[] encrypted = cipher.doFinal(jsonPayload.getBytes(StandardCharsets.UTF_8));
        String base64Encrypted = Base64.getEncoder().encodeToString(encrypted);

        // Double Base64 encode to match Fingpay Uber CMS specification: window.btoa(CryptoJS.AES.encrypt(...))
        return Base64.getEncoder().encodeToString(base64Encrypted.getBytes(StandardCharsets.UTF_8));
    }

    public byte[] resolveKeyBytes(String keyStr) {
        if (keyStr == null || keyStr.isBlank()) {
            return new byte[16];
        }
        String trimmed = keyStr.trim();
        // If it's a 32-character hex key (like raw API secret substr: openssl_encrypt aes-256-ecb with 32 bytes)
        if (trimmed.length() == 32 && trimmed.matches("^[a-fA-F0-9]{32}$")) {
            return trimmed.getBytes(StandardCharsets.UTF_8);
        }
        // If it's a Base64 string
        try {
            byte[] decoded = Base64.getDecoder().decode(trimmed);
            if (decoded.length == 16 || decoded.length == 24 || decoded.length == 32) {
                return decoded;
            }
        } catch (IllegalArgumentException ignored) {
        }
        return normalizeKeyBytes(trimmed);
    }

    public String resolveUrlSkey(String skey) {
        if (skey == null || skey.isBlank()) return "";
        String trimmed = skey.trim();
        // If 32-character hex key (e.g. substr(api_secret, 0, 32)), PHP does: $parsed64key = base64_encode($key);
        if (trimmed.length() == 32 && trimmed.matches("^[a-fA-F0-9]{32}$")) {
            return Base64.getEncoder().encodeToString(trimmed.getBytes(StandardCharsets.UTF_8));
        }
        return trimmed;
    }

    public String resolvePayloadSkey(String superMerchantSkey) {
        if (superMerchantSkey == null || superMerchantSkey.isBlank()) return "";
        String trimmed = superMerchantSkey.trim();
        // If 32-character hex key, Base64 encode it so Fingpay's CryptoJS.enc.Base64.parse() recovers the 32 bytes
        if (trimmed.length() == 32 && trimmed.matches("^[a-fA-F0-9]{32}$")) {
            return Base64.getEncoder().encodeToString(trimmed.getBytes(StandardCharsets.UTF_8));
        }
        return trimmed;
    }

    private byte[] normalizeKeyBytes(String keyStr) {
        byte[] raw = keyStr.getBytes(StandardCharsets.UTF_8);
        if (raw.length >= 32) {
            byte[] key32 = new byte[32];
            System.arraycopy(raw, 0, key32, 0, 32);
            return key32;
        }
        byte[] key16 = new byte[16];
        System.arraycopy(raw, 0, key16, 0, Math.min(raw.length, 16));
        return key16;
    }

    public boolean verifyHash(String rawBody, String secretKey, String receivedHash) {
        if (receivedHash == null || receivedHash.isBlank()) {
            return false;
        }
        String cleanReceived = receivedHash.trim();
        String candidate1 = computeHash(rawBody + secretKey);
        if (constantTimeEquals(candidate1, cleanReceived)) {
            return true;
        }

        // Handle variations with or without trailing semicolon
        if (!secretKey.endsWith(";")) {
            String candidate2 = computeHash(rawBody + secretKey + ";");
            if (constantTimeEquals(candidate2, cleanReceived)) {
                return true;
            }
        } else {
            String candidate3 = computeHash(rawBody + secretKey.substring(0, secretKey.length() - 1));
            if (constantTimeEquals(candidate3, cleanReceived)) {
                return true;
            }
        }
        return false;
    }

    public String computeHash(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 digest computation failed", e);
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
