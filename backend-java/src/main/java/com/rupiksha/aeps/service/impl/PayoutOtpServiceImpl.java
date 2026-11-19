package com.rupiksha.aeps.service.impl;

import com.rupiksha.aeps.dto.*;
import com.rupiksha.aeps.entity.PayoutBeneficiary;
import com.rupiksha.aeps.entity.PayoutChargeSlab;
import com.rupiksha.aeps.entity.PayoutOtpAuditLog;
import com.rupiksha.aeps.entity.PayoutOtpChallenge;
import com.rupiksha.aeps.entity.PayoutOtpStatus;
import com.rupiksha.aeps.repository.PayoutBeneficiaryRepository;
import com.rupiksha.aeps.repository.PayoutChargeSlabRepository;
import com.rupiksha.aeps.repository.PayoutOtpAuditLogRepository;
import com.rupiksha.aeps.repository.PayoutOtpChallengeRepository;
import com.rupiksha.aeps.service.PayoutOtpService;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.Role;
import com.rupiksha.backend.domain.RoleName;
import com.rupiksha.backend.domain.ServiceType;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.UserStatus;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.UserServiceRepository;
import com.rupiksha.backend.service.WalletService;
import com.rupiksha.backend.service.impl.OtpProviderRouter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutOtpServiceImpl implements PayoutOtpService {

    public static final int RESEND_COOLDOWN_SECONDS = 60;
    public static final long DEFAULT_TTL_SECONDS = 300L; // 5 minutes
    public static final int MAX_VERIFICATION_ATTEMPTS = 5;
    public static final int IP_RATE_LIMIT_MAX = 15;
    public static final int IP_RATE_LIMIT_WINDOW_MINUTES = 10;
    public static final int USER_RATE_LIMIT_MAX = 5;
    public static final int USER_RATE_LIMIT_WINDOW_MINUTES = 15;

    private final PayoutOtpChallengeRepository challengeRepository;
    private final PayoutOtpAuditLogRepository auditLogRepository;
    private final PayoutBeneficiaryRepository payoutBeneficiaryRepository;
    private final PayoutChargeSlabRepository payoutChargeSlabRepository;
    private final UserRepository userRepository;
    private final UserServiceRepository userServiceRepository;
    private final WalletService walletService;
    private final OtpProviderRouter otpProviderRouter;
    private final AppProperties appProperties;

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    private final SecureRandom secureRandom = new SecureRandom();

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
        return UUID.fromString(cleanUserIdString(raw));
    }

    private String maskMobile(String mobile) {
        if (mobile == null || mobile.isBlank()) return "******0000";
        String clean = mobile.replaceAll("[^0-9]", "");
        if (clean.length() < 10) return "******" + clean;
        return "******" + clean.substring(clean.length() - 4);
    }

    private String resolveHmacSecret() {
        if (appProperties != null && appProperties.jwt() != null && appProperties.jwt().secret() != null
                && !appProperties.jwt().secret().isBlank()) {
            return appProperties.jwt().secret();
        }
        String envSecret = System.getenv("PAYOUT_OTP_HMAC_SECRET");
        if (envSecret != null && !envSecret.isBlank()) {
            return envSecret.trim();
        }
        String fallback = System.getenv("JWT_SECRET");
        if (fallback != null && !fallback.isBlank()) {
            return fallback.trim();
        }
        return "RupikshaPayoutSecureHmacKey2026!#@DefaultFallback";
    }

    private String calculateHmac(String data, String key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : rawHmac) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            log.error("Failed to compute HMAC: {}", e.getMessage());
            return "HMAC_ERROR";
        }
    }

    @Override
    public String computePayloadFingerprint(String userId, String accountNumber, String ifsc, BigDecimal amount, String transferMode) {
        String cleanUserId = userId != null ? userId.trim() : "";
        String cleanAcc = accountNumber != null ? accountNumber.replaceAll("[^0-9]", "") : "";
        String cleanIfsc = ifsc != null ? ifsc.trim().toUpperCase() : "";
        String normAmount = amount != null ? amount.setScale(2, RoundingMode.HALF_UP).toPlainString() : "0.00";
        String normMode = transferMode != null ? transferMode.trim().toUpperCase() : "IMPS";

        String raw = cleanUserId + "|" + cleanAcc + "|" + cleanIfsc + "|" + normAmount + "|" + normMode;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            return raw;
        }
    }

    private void recordAudit(
            UUID userId,
            String role,
            String eventType,
            String challengeId,
            String intentId,
            String authRef,
            String maskedMobile,
            String sourceIp,
            String userAgent,
            String outcome,
            String failureReason,
            String metadata
    ) {
        try {
            PayoutOtpAuditLog audit = PayoutOtpAuditLog.builder()
                    .eventId("EVT_" + UUID.randomUUID().toString().replace("-", ""))
                    .userId(userId)
                    .userRole(role)
                    .eventType(eventType)
                    .eventTimestamp(Instant.now())
                    .challengeId(challengeId)
                    .payoutIntentId(intentId)
                    .authorizationReference(authRef)
                    .maskedMobile(maskedMobile)
                    .sourceIp(sourceIp)
                    .userAgent(userAgent != null && userAgent.length() > 500 ? userAgent.substring(0, 500) : userAgent)
                    .correlationId(challengeId != null ? challengeId : UUID.randomUUID().toString())
                    .outcome(outcome)
                    .failureReason(failureReason)
                    .metadata(metadata)
                    .build();
            auditLogRepository.save(audit);
        } catch (Exception e) {
            log.warn("Failed to persist payout OTP audit log: {}", e.getMessage());
        }
    }

    private PayoutChargeSlabDto calculateCharges(BigDecimal amount) {
        List<PayoutChargeSlab> slabs = payoutChargeSlabRepository.findAllByIsActiveTrueOrderByMinAmountAsc();
        if (slabs != null && !slabs.isEmpty()) {
            for (PayoutChargeSlab slab : slabs) {
                if (amount.compareTo(slab.getMinAmount()) >= 0 && amount.compareTo(slab.getMaxAmount()) <= 0) {
                    return PayoutChargeSlabDto.builder()
                            .id(slab.getId())
                            .minAmount(slab.getMinAmount())
                            .maxAmount(slab.getMaxAmount())
                            .baseCharge(slab.getBaseCharge())
                            .gstRate(slab.getGstRate())
                            .gstAmount(slab.getGstAmount())
                            .totalCharge(slab.getTotalCharge())
                            .isActive(slab.getIsActive())
                            .build();
                }
            }
        }
        // Fallback default calculation
        if (amount.compareTo(new BigDecimal("25000.00")) >= 0) {
            return PayoutChargeSlabDto.builder()
                    .minAmount(new BigDecimal("25000.00"))
                    .maxAmount(new BigDecimal("100000.00"))
                    .baseCharge(new BigDecimal("10.50"))
                    .gstRate(new BigDecimal("18.00"))
                    .gstAmount(new BigDecimal("1.89"))
                    .totalCharge(new BigDecimal("12.39"))
                    .isActive(true)
                    .build();
        }
        return PayoutChargeSlabDto.builder()
                .minAmount(new BigDecimal("100.00"))
                .maxAmount(new BigDecimal("24999.00"))
                .baseCharge(new BigDecimal("5.50"))
                .gstRate(new BigDecimal("18.00"))
                .gstAmount(new BigDecimal("0.99"))
                .totalCharge(new BigDecimal("6.49"))
                .isActive(true)
                .build();
    }

    private void enforceRateLimits(String clientIp, UUID userId) {
        // Redis rate limit if available
        if (redisTemplate != null) {
            try {
                if (clientIp != null && !clientIp.isBlank() && !"127.0.0.1".equals(clientIp)) {
                    String ipKey = "rl:payout_otp:ip:" + clientIp.trim();
                    Long ipCount = redisTemplate.opsForValue().increment(ipKey);
                    if (ipCount != null && ipCount == 1) {
                        redisTemplate.expire(ipKey, Duration.ofMinutes(IP_RATE_LIMIT_WINDOW_MINUTES));
                    }
                    if (ipCount != null && ipCount > IP_RATE_LIMIT_MAX) {
                        throw new IllegalArgumentException("Too many OTP requests from this network. Please wait before retrying.");
                    }
                }

                if (userId != null) {
                    String userKey = "rl:payout_otp:user:" + userId;
                    Long userCount = redisTemplate.opsForValue().increment(userKey);
                    if (userCount != null && userCount == 1) {
                        redisTemplate.expire(userKey, Duration.ofMinutes(USER_RATE_LIMIT_WINDOW_MINUTES));
                    }
                    if (userCount != null && userCount > USER_RATE_LIMIT_MAX) {
                        throw new IllegalArgumentException("Too many OTP requests for this account. Please wait 15 minutes before retrying.");
                    }
                }
                return;
            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Exception e) {
                log.warn("Redis rate-limiting check failed, falling back to database check: {}", e.getMessage());
            }
        }

        // Database fallback check
        if (userId != null) {
            long recentUserCount = challengeRepository.countByUserIdAndCreatedAtAfter(
                    userId, Instant.now().minus(Duration.ofMinutes(USER_RATE_LIMIT_WINDOW_MINUTES))
            );
            if (recentUserCount >= USER_RATE_LIMIT_MAX) {
                throw new IllegalArgumentException("Too many OTP requests for this account. Please wait before retrying.");
            }
        }
        if (clientIp != null && !clientIp.isBlank() && !"127.0.0.1".equals(clientIp)) {
            long recentIpCount = challengeRepository.countByIpAddressAndCreatedAtAfter(
                    clientIp, Instant.now().minus(Duration.ofMinutes(IP_RATE_LIMIT_WINDOW_MINUTES))
            );
            if (recentIpCount >= IP_RATE_LIMIT_MAX) {
                throw new IllegalArgumentException("Too many OTP requests from this network. Please wait before retrying.");
            }
        }
    }

    @Override
    @Transactional
    public PayoutOtpSendResponse sendOtp(PayoutOtpSendRequest request, String rawUserId, String clientIp, String userAgent) {
        String cleanUserId = cleanUserIdString(rawUserId);
        UUID userUuid = parseUserUuid(cleanUserId);

        // 1. Authenticate user & check active status
        User user = userRepository.findById(userUuid)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + cleanUserId));

        if (user.getStatus() != UserStatus.ACTIVE && user.getStatus() != UserStatus.APPROVED) {
            log.warn("[SECURITY_ALERT] Payout OTP requested for inactive user: id={}, status={}, ip={}",
                    cleanUserId, user.getStatus(), clientIp);
            recordAudit(userUuid, "UNKNOWN", "OTP_REQUEST_REJECTED", null, null, null, null,
                    clientIp, userAgent, "FAILED", "Account not active or approved", null);
            throw new AccessDeniedException("User account is not active or approved: " + user.getStatus());
        }

        // 2. Validate User Role (Retailer, Distributor, Super Distributor, Admin)
        boolean hasAllowedRole = user.getRoles().stream().anyMatch(r ->
                r.getName() == RoleName.RETAILER ||
                r.getName() == RoleName.DISTRIBUTOR ||
                r.getName() == RoleName.SUPER_DISTRIBUTOR ||
                r.getName() == RoleName.ADMIN
        );
        if (!hasAllowedRole) {
            log.warn("[SECURITY_ALERT] Unauthorized role for payout OTP: id={}, roles={}, ip={}",
                    cleanUserId, user.getRoles(), clientIp);
            recordAudit(userUuid, "UNAUTHORIZED", "OTP_REQUEST_REJECTED", null, null, null, null,
                    clientIp, userAgent, "FAILED", "Role unauthorized for payout", null);
            throw new AccessDeniedException("Your role is not authorized for payout operations.");
        }

        String primaryRole = user.getRoles().stream()
                .map(Role::getName)
                .map(Enum::name)
                .findFirst()
                .orElse("RETAILER");

        // 3. Service Level Permission Check
        boolean isPayoutEnabled = userServiceRepository != null && userServiceRepository
                .findByUserIdAndServiceType(userUuid, ServiceType.PAYOUT)
                .map(com.rupiksha.backend.domain.UserService::getIsEnabled)
                .orElse(false);

        if (!isPayoutEnabled) {
            log.warn("[SECURITY_ALERT] Payout service disabled for user {}: ip={}", cleanUserId, clientIp);
            recordAudit(userUuid, primaryRole, "OTP_REQUEST_REJECTED", null, null, null, null,
                    clientIp, userAgent, "FAILED", "Payout service disabled", null);
            throw new AccessDeniedException("Payout service is disabled for your account. Please contact administrator.");
        }

        // 4. Resolve Registered Mobile from Database Principal (Never trust frontend)
        String rawMobile = user.getMobile();
        if (rawMobile == null || rawMobile.isBlank()) {
            throw new IllegalArgumentException("No registered mobile number found for this account. Please update your profile.");
        }
        String cleanMobile = rawMobile.replaceAll("[^0-9]", "");
        if (cleanMobile.length() > 10) {
            cleanMobile = cleanMobile.substring(cleanMobile.length() - 10);
        }
        if (cleanMobile.length() != 10 || !cleanMobile.matches("^[6-9]\\d{9}$")) {
            throw new IllegalArgumentException("Registered mobile number on file is invalid. Please contact support.");
        }
        String maskedMobile = maskMobile(cleanMobile);

        // 5. Validate Amount and Transfer Mode
        BigDecimal amount = request.getAmount();
        if (amount == null || amount.compareTo(new BigDecimal("100.00")) < 0) {
            throw new IllegalArgumentException("Payout amount must be at least ₹100.00");
        }
        if (amount.compareTo(new BigDecimal("500000.00")) > 0) {
            throw new IllegalArgumentException("Payout amount cannot exceed ₹5,00,000.00");
        }

        String transferMode = request.getTransferMode() != null && !request.getTransferMode().isBlank()
                ? request.getTransferMode().trim().toUpperCase() : "IMPS";
        if (!Set.of("IMPS", "NEFT", "RTGS", "IFT").contains(transferMode)) {
            throw new IllegalArgumentException("Invalid payment rail: " + transferMode);
        }

        // 6. Validate Selected Beneficiary and Approval Status
        String cleanAcc = request.getAccountNumber() != null ? request.getAccountNumber().replaceAll("[^0-9]", "") : "";
        if (cleanAcc.length() < 9 || cleanAcc.length() > 18) {
            throw new IllegalArgumentException("Invalid bank account number (must be 9 to 18 digits).");
        }
        String cleanIfsc = request.getIfsc() != null ? request.getIfsc().trim().toUpperCase() : "";
        if (!cleanIfsc.matches("^[A-Z]{4}0[A-Z0-9]{6}$")) {
            throw new IllegalArgumentException("Invalid IFSC code format (e.g. SBIN0001234).");
        }

        Optional<PayoutBeneficiary> beneOpt = payoutBeneficiaryRepository
                .findFirstByUserIdAndAccountNumberAndIfsc(cleanUserId, cleanAcc, cleanIfsc);
        if (beneOpt.isEmpty() || !"APPROVED".equalsIgnoreCase(beneOpt.get().getStatus())) {
            throw new IllegalArgumentException("Payout transfer is only allowed to an Admin-Approved bank beneficiary. Please submit and wait for Admin approval.");
        }
        PayoutBeneficiary approvedBene = beneOpt.get();

        // 7. Calculate Authoritative Charges and GST
        PayoutChargeSlabDto chargeSlab = calculateCharges(amount);
        BigDecimal baseCharge = chargeSlab.getBaseCharge() != null ? chargeSlab.getBaseCharge() : BigDecimal.ZERO;
        BigDecimal gstAmount = chargeSlab.getGstAmount() != null ? chargeSlab.getGstAmount() : BigDecimal.ZERO;
        BigDecimal totalCharge = chargeSlab.getTotalCharge() != null ? chargeSlab.getTotalCharge() : BigDecimal.ZERO;
        BigDecimal totalDeduction = amount.add(totalCharge);

        // 8. Pre-validate Wallet Balance
        try {
            WalletDtos.WalletBalanceResponse balanceResp = walletService.getBalance(cleanUserId);
            BigDecimal available = balanceResp != null && balanceResp.availableBalance() != null
                    ? balanceResp.availableBalance() : BigDecimal.ZERO;
            if (available.compareTo(totalDeduction) < 0) {
                String errMsg = "Insufficient wallet balance. Required ₹" + totalDeduction.setScale(2, RoundingMode.HALF_UP)
                        + " (Transfer ₹" + amount + " + Charges ₹" + totalCharge + "). Available: ₹" + available.setScale(2, RoundingMode.HALF_UP);
                recordAudit(userUuid, primaryRole, "OTP_REQUEST_INSUFFICIENT_BALANCE", null, null, null,
                        maskedMobile, clientIp, userAgent, "FAILED", errMsg, null);
                throw new IllegalArgumentException(errMsg);
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Could not pre-check wallet balance: {}", e.getMessage());
        }

        // 9. Enforce Rate Limits & Resend Cooldown
        enforceRateLimits(clientIp, userUuid);

        List<PayoutOtpChallenge> existingPending = challengeRepository.findByUserIdAndStatus(userUuid, PayoutOtpStatus.PENDING);
        boolean isResend = false;
        for (PayoutOtpChallenge pending : existingPending) {
            if (Instant.now().isBefore(pending.getResendAvailableAt())) {
                long waitSeconds = pending.getResendAvailableAt().getEpochSecond() - Instant.now().getEpochSecond();
                throw new IllegalArgumentException("Please wait " + (waitSeconds > 0 ? waitSeconds : 1) + " seconds before requesting another OTP.");
            }
            // Invalidate/supersede previous pending challenge
            pending.setStatus(PayoutOtpStatus.SUPERSEDED);
            challengeRepository.save(pending);
            isResend = true;
        }

        // 10. Generate Payout Intent ID and Challenge ID
        String payoutIntentId = (request.getPayoutIntentId() != null && !request.getPayoutIntentId().isBlank())
                ? request.getPayoutIntentId().trim()
                : "POI_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        String challengeId = "POC_" + UUID.randomUUID().toString().replace("-", "");
        String payloadFingerprint = computePayloadFingerprint(cleanUserId, cleanAcc, cleanIfsc, amount, transferMode);

        recordAudit(userUuid, primaryRole, isResend ? "OTP_RESENT" : "OTP_REQUESTED", challengeId, payoutIntentId, null,
                maskedMobile, clientIp, userAgent, "SUCCESS", null, "Amount: " + amount + ", Rail: " + transferMode);

        // 11. Send OTP through existing DoveSoft provider
        String providerReference;
        try {
            var provider = otpProviderRouter.current();
            log.info("Dispatching payout OTP to registered mobile {} for user {} via provider {}",
                    maskedMobile, cleanUserId, provider.providerName());
            providerReference = provider.sendOtp(cleanMobile);
        } catch (Exception e) {
            log.error("DoveSoft OTP dispatch failed for mobile {}: {}", maskedMobile, e.getMessage(), e);
            recordAudit(userUuid, primaryRole, "DOVESOFT_DELIVERY_FAILURE", challengeId, payoutIntentId, null,
                    maskedMobile, clientIp, userAgent, "FAILED", e.getMessage(), null);
            throw new IllegalArgumentException("Unable to send OTP via SMS provider. Please try again later.");
        }

        // 12. Secure OTP Representation using Keyed HMAC-SHA256
        String hmacSecret = resolveHmacSecret();
        String secureOtpHash = calculateHmac(providerReference != null ? providerReference : "DOVESOFT_SESSION", hmacSecret);

        long ttlSeconds = appProperties.otp() != null && appProperties.otp().ttlSeconds() > 0
                ? appProperties.otp().ttlSeconds() : DEFAULT_TTL_SECONDS;

        // 13. Persist Active Payout OTP Challenge
        PayoutOtpChallenge challenge = PayoutOtpChallenge.builder()
                .challengeId(challengeId)
                .payoutIntentId(payoutIntentId)
                .userId(userUuid)
                .userRole(primaryRole)
                .mobileNumber(cleanMobile)
                .maskedMobile(maskedMobile)
                .beneficiaryId(approvedBene.getId())
                .beneficiaryName(approvedBene.getBeneficiaryName())
                .accountNumber(cleanAcc)
                .ifsc(cleanIfsc)
                .bankName(approvedBene.getBankName())
                .transferMode(transferMode)
                .amount(amount)
                .baseCharge(baseCharge)
                .gstAmount(gstAmount)
                .totalCharge(totalCharge)
                .totalDeductedAmount(totalDeduction)
                .payloadHash(payloadFingerprint)
                .otpHash(secureOtpHash)
                .providerReference(providerReference)
                .expiryAt(Instant.now().plusSeconds(ttlSeconds))
                .attemptCount(0)
                .maxAttempts(MAX_VERIFICATION_ATTEMPTS)
                .resendCount(isResend ? 1 : 0)
                .resendAvailableAt(Instant.now().plusSeconds(RESEND_COOLDOWN_SECONDS))
                .status(PayoutOtpStatus.PENDING)
                .ipAddress(clientIp)
                .userAgent(userAgent != null && userAgent.length() > 500 ? userAgent.substring(0, 500) : userAgent)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        challengeRepository.save(challenge);

        recordAudit(userUuid, primaryRole, "OTP_SENT", challengeId, payoutIntentId, null,
                maskedMobile, clientIp, userAgent, "SUCCESS", null, "Provider: dovesoft");

        return PayoutOtpSendResponse.builder()
                .success(true)
                .message("OTP has been sent to your registered mobile number.")
                .challengeId(challengeId)
                .payoutIntentId(payoutIntentId)
                .maskedMobile(maskedMobile)
                .resendCooldownSeconds(RESEND_COOLDOWN_SECONDS)
                .expiresInSeconds(ttlSeconds)
                .amount(amount)
                .baseCharge(baseCharge)
                .gstAmount(gstAmount)
                .totalCharges(totalCharge)
                .totalDeduction(totalDeduction)
                .build();
    }

    @Override
    @Transactional
    public PayoutOtpVerifyResponse verifyOtp(PayoutOtpVerifyRequest request, String rawUserId, String clientIp, String userAgent) {
        String cleanUserId = cleanUserIdString(rawUserId);
        UUID userUuid = parseUserUuid(cleanUserId);

        String challengeId = request.getChallengeId() != null ? request.getChallengeId().trim() : "";
        if (challengeId.isBlank()) {
            throw new IllegalArgumentException("Challenge ID is required for OTP verification.");
        }

        // 1. Pessimistic Lock on Challenge (Race condition & Replay protection across Cloud Run instances)
        PayoutOtpChallenge challenge = challengeRepository.findWithLockByChallengeId(challengeId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid OTP session or challenge not found."));

        // 2. Ownership Check
        if (!challenge.getUserId().equals(userUuid)) {
            log.warn("[SECURITY_ALERT] Payout OTP verify challenge ownership mismatch: challengeUser={}, requesterUser={}, ip={}",
                    challenge.getUserId(), userUuid, clientIp);
            recordAudit(userUuid, challenge.getUserRole(), "VERIFY_ATTEMPT_UNAUTHORIZED", challengeId,
                    challenge.getPayoutIntentId(), null, challenge.getMaskedMobile(), clientIp, userAgent,
                    "FAILED", "Challenge does not belong to user", null);
            throw new AccessDeniedException("Unauthorized challenge access.");
        }

        // 3. Challenge Status Check
        if (challenge.getStatus() != PayoutOtpStatus.PENDING) {
            log.warn("Attempt to verify non-pending payout OTP challenge: id={}, status={}", challengeId, challenge.getStatus());
            recordAudit(userUuid, challenge.getUserRole(), "VERIFY_NON_PENDING_CHALLENGE", challengeId,
                    challenge.getPayoutIntentId(), null, challenge.getMaskedMobile(), clientIp, userAgent,
                    "FAILED", "Status: " + challenge.getStatus(), null);
            throw new IllegalArgumentException("This OTP has already been verified, consumed, or expired. Please request a new OTP.");
        }

        // 4. Expiry Check
        if (Instant.now().isAfter(challenge.getExpiryAt())) {
            challenge.setStatus(PayoutOtpStatus.EXPIRED);
            challengeRepository.save(challenge);
            recordAudit(userUuid, challenge.getUserRole(), "EXPIRED_OTP", challengeId,
                    challenge.getPayoutIntentId(), null, challenge.getMaskedMobile(), clientIp, userAgent,
                    "FAILED", "OTP challenge expired", null);
            throw new IllegalArgumentException("Your OTP has expired. Please request a new OTP.");
        }

        // 5. Attempt Counter & Brute Force Limit
        if (challenge.getAttemptCount() >= challenge.getMaxAttempts()) {
            challenge.setStatus(PayoutOtpStatus.MAX_ATTEMPTS_EXCEEDED);
            challengeRepository.save(challenge);
            recordAudit(userUuid, challenge.getUserRole(), "MAX_ATTEMPTS_EXCEEDED", challengeId,
                    challenge.getPayoutIntentId(), null, challenge.getMaskedMobile(), clientIp, userAgent,
                    "FAILED", "Max attempts exceeded", null);
            throw new IllegalArgumentException("Maximum verification attempts reached. Request a new OTP.");
        }

        // Increment attempt count atomically
        challenge.setAttemptCount(challenge.getAttemptCount() + 1);
        challengeRepository.saveAndFlush(challenge);

        // 6. Change Detection: Re-validate Bound Payout Details against Request
        String cleanAcc = request.getAccountNumber() != null ? request.getAccountNumber().replaceAll("[^0-9]", "") : "";
        String cleanIfsc = request.getIfsc() != null ? request.getIfsc().trim().toUpperCase() : "";
        String transferMode = request.getTransferMode() != null && !request.getTransferMode().isBlank()
                ? request.getTransferMode().trim().toUpperCase() : challenge.getTransferMode();

        String currentFingerprint = computePayloadFingerprint(cleanUserId, cleanAcc, cleanIfsc, request.getAmount(), transferMode);
        if (!challenge.getPayloadHash().equals(currentFingerprint)) {
            log.warn("[SECURITY_ALERT] Payout details changed between OTP send and verify! challengeId={}, original={}, current={}, ip={}",
                    challengeId, challenge.getPayloadHash(), currentFingerprint, clientIp);
            challenge.setStatus(PayoutOtpStatus.INVALIDATED);
            challengeRepository.save(challenge);
            recordAudit(userUuid, challenge.getUserRole(), "DETAILS_MISMATCH_INVALIDATION", challengeId,
                    challenge.getPayoutIntentId(), null, challenge.getMaskedMobile(), clientIp, userAgent,
                    "FAILED", "Payout parameters changed since OTP was sent", null);
            throw new IllegalArgumentException("Payout details have changed since OTP generation. For security, this OTP challenge has been invalidated. Please request a new OTP.");
        }

        // 7. Verify OTP with DoveSoft Provider
        String submittedOtp = request.getOtp() != null ? request.getOtp().trim() : "";
        var provider = otpProviderRouter.current();
        boolean isOtpValid = provider.verifyOtp(challenge.getMobileNumber(), submittedOtp, challenge.getProviderReference());

        if (!isOtpValid) {
            int remaining = challenge.getMaxAttempts() - challenge.getAttemptCount();
            recordAudit(userUuid, challenge.getUserRole(), "INVALID_OTP", challengeId,
                    challenge.getPayoutIntentId(), null, challenge.getMaskedMobile(), clientIp, userAgent,
                    "FAILED", "Incorrect OTP. Remaining: " + remaining, null);

            if (remaining <= 0) {
                challenge.setStatus(PayoutOtpStatus.MAX_ATTEMPTS_EXCEEDED);
                challengeRepository.save(challenge);
                throw new IllegalArgumentException("Maximum verification attempts exceeded. Please request a new OTP.");
            }
            throw new IllegalArgumentException("Incorrect OTP. " + remaining + " attempts remaining.");
        }

        // 8. Verification Succeeded: Atomically mark VERIFIED and Issue Single-Use Authorization Reference
        challenge.setStatus(PayoutOtpStatus.VERIFIED);
        challenge.setVerifiedAt(Instant.now());

        String authReference = "AUTH_PO_" + UUID.randomUUID().toString().replace("-", "")
                + "_" + Long.toHexString(secureRandom.nextLong());
        challenge.setAuthorizationReference(authReference);
        challenge.setAuthorizationExpiresAt(Instant.now().plusSeconds(DEFAULT_TTL_SECONDS));
        challengeRepository.saveAndFlush(challenge);

        recordAudit(userUuid, challenge.getUserRole(), "OTP_VERIFIED", challengeId,
                challenge.getPayoutIntentId(), authReference, challenge.getMaskedMobile(), clientIp, userAgent,
                "SUCCESS", null, null);

        recordAudit(userUuid, challenge.getUserRole(), "AUTHORIZATION_REFERENCE_ISSUED", challengeId,
                challenge.getPayoutIntentId(), authReference, challenge.getMaskedMobile(), clientIp, userAgent,
                "SUCCESS", null, "Valid for 300 seconds");

        return PayoutOtpVerifyResponse.builder()
                .success(true)
                .message("OTP verified successfully. Proceed with payout confirmation.")
                .authorizationReference(authReference)
                .payoutIntentId(challenge.getPayoutIntentId())
                .expiresInSeconds(DEFAULT_TTL_SECONDS)
                .build();
    }

    @Override
    @Transactional
    public PayoutOtpChallenge validateAndConsumeAuthorization(String authorizationReference, PayoutRequest request, String rawUserId, String clientIp) {
        if (authorizationReference == null || authorizationReference.isBlank()) {
            throw new AccessDeniedException("Mandatory payout OTP authorization required. Please verify OTP before initiating payout.");
        }

        String cleanUserId = cleanUserIdString(rawUserId);
        UUID userUuid = parseUserUuid(cleanUserId);

        // Pessimistic write lock on authorization reference
        PayoutOtpChallenge challenge = challengeRepository.findWithLockByAuthorizationReference(authorizationReference.trim())
                .orElseThrow(() -> {
                    log.warn("[SECURITY_ALERT] Invalid payout authorization reference: ref={}, userId={}, ip={}",
                            authorizationReference, cleanUserId, clientIp);
                    recordAudit(userUuid, "UNKNOWN", "AUTHORIZATION_CONSUMPTION_FAILED", null, null,
                            authorizationReference, null, clientIp, null, "FAILED", "Invalid authorization reference", null);
                    return new AccessDeniedException("Invalid payout authorization reference.");
                });

        // 1. Verify User Ownership
        if (!challenge.getUserId().equals(userUuid)) {
            log.warn("[SECURITY_ALERT] Payout authorization user mismatch: challengeUser={}, callerUser={}, ref={}, ip={}",
                    challenge.getUserId(), userUuid, authorizationReference, clientIp);
            recordAudit(userUuid, challenge.getUserRole(), "AUTHORIZATION_USER_MISMATCH", challenge.getChallengeId(),
                    challenge.getPayoutIntentId(), authorizationReference, challenge.getMaskedMobile(), clientIp, null,
                    "FAILED", "Authorization does not belong to user", null);
            throw new AccessDeniedException("Payout authorization does not belong to the authenticated user.");
        }

        // 2. Verify Single-Use Status & Check If Already Consumed
        if (challenge.getStatus() == PayoutOtpStatus.CONSUMED || challenge.getConsumedAt() != null) {
            log.warn("[SECURITY_ALERT] Replay attempt with already consumed payout authorization: ref={}, userId={}, ip={}",
                    authorizationReference, cleanUserId, clientIp);
            recordAudit(userUuid, challenge.getUserRole(), "AUTHORIZATION_REPLAY_BLOCKED", challenge.getChallengeId(),
                    challenge.getPayoutIntentId(), authorizationReference, challenge.getMaskedMobile(), clientIp, null,
                    "FAILED", "Authorization reference already consumed", null);
            throw new AccessDeniedException("This payout authorization has already been consumed. Replay is strictly blocked.");
        }

        if (challenge.getStatus() != PayoutOtpStatus.VERIFIED) {
            log.warn("[SECURITY_ALERT] Payout authorization not in verified state: status={}, ref={}, ip={}",
                    challenge.getStatus(), authorizationReference, clientIp);
            recordAudit(userUuid, challenge.getUserRole(), "AUTHORIZATION_INVALID_STATUS", challenge.getChallengeId(),
                    challenge.getPayoutIntentId(), authorizationReference, challenge.getMaskedMobile(), clientIp, null,
                    "FAILED", "Challenge status is: " + challenge.getStatus(), null);
            throw new AccessDeniedException("Payout authorization is invalid (status: " + challenge.getStatus() + ").");
        }

        // 3. Verify Expiry
        if (challenge.getAuthorizationExpiresAt() != null && Instant.now().isAfter(challenge.getAuthorizationExpiresAt())) {
            challenge.setStatus(PayoutOtpStatus.EXPIRED);
            challengeRepository.save(challenge);
            recordAudit(userUuid, challenge.getUserRole(), "AUTHORIZATION_EXPIRED", challenge.getChallengeId(),
                    challenge.getPayoutIntentId(), authorizationReference, challenge.getMaskedMobile(), clientIp, null,
                    "FAILED", "Authorization reference expired", null);
            throw new AccessDeniedException("Payout authorization has expired. Please verify a new OTP.");
        }

        // 4. Revalidate Payout Details against Bound Fingerprint
        String cleanAcc = request.getAccountNumber() != null ? request.getAccountNumber().replaceAll("[^0-9]", "") : "";
        String cleanIfsc = request.getIfsc() != null ? request.getIfsc().trim().toUpperCase() : "";
        String transferMode = request.getTransferMode() != null && !request.getTransferMode().isBlank()
                ? request.getTransferMode().trim().toUpperCase() : "IMPS";

        String requestFingerprint = computePayloadFingerprint(cleanUserId, cleanAcc, cleanIfsc, request.getAmount(), transferMode);
        if (!challenge.getPayloadHash().equals(requestFingerprint)) {
            log.warn("[SECURITY_ALERT] Payout initiation payload differs from OTP authorization fingerprint! ref={}, expected={}, actual={}, ip={}",
                    authorizationReference, challenge.getPayloadHash(), requestFingerprint, clientIp);
            challenge.setStatus(PayoutOtpStatus.INVALIDATED);
            challengeRepository.save(challenge);
            recordAudit(userUuid, challenge.getUserRole(), "AUTHORIZATION_PAYLOAD_TAMPERING", challenge.getChallengeId(),
                    challenge.getPayoutIntentId(), authorizationReference, challenge.getMaskedMobile(), clientIp, null,
                    "FAILED", "Request details do not match OTP authorization", null);
            throw new AccessDeniedException("Payout parameters do not match the OTP-authorized transaction. Transaction rejected.");
        }

        // 5. Atomically Consume Authorization Reference
        challenge.setStatus(PayoutOtpStatus.CONSUMED);
        challenge.setConsumedAt(Instant.now());
        challengeRepository.saveAndFlush(challenge);

        recordAudit(userUuid, challenge.getUserRole(), "AUTHORIZATION_REFERENCE_CONSUMED", challenge.getChallengeId(),
                challenge.getPayoutIntentId(), authorizationReference, challenge.getMaskedMobile(), clientIp, null,
                "SUCCESS", null, "Amount: " + challenge.getAmount() + ", Rail: " + challenge.getTransferMode());

        return challenge;
    }
}
