package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.OtpLoginChallengeRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.service.AuthService;
import com.rupiksha.backend.service.IdPaymentRequiredException;
import com.rupiksha.backend.service.OtpLoginService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OtpLoginServiceImpl implements OtpLoginService {

    private static final Set<String> ALLOWED_PORTAL_ROLES = Set.of("RETAILER", "DISTRIBUTOR", "SUPER_DISTRIBUTOR");
    private static final int RESEND_COOLDOWN_SECONDS = 60;
    private static final int IP_RATE_LIMIT_MAX = 15;
    private static final int IP_RATE_LIMIT_WINDOW_MINUTES = 10;
    private static final int MOBILE_RATE_LIMIT_MAX = 5;
    private static final int MOBILE_RATE_LIMIT_WINDOW_MINUTES = 15;

    public static final String GENERIC_OTP_SENT_MESSAGE =
            "If an eligible Rupiksha account exists for this mobile number, an OTP will be sent.";

    private final OtpLoginChallengeRepository challengeRepository;
    private final UserRepository userRepository;
    private final OtpProviderRouter otpProviderRouter;
    private final AuthService authService;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties appProperties;

    @Override
    @Transactional
    public AuthDtos.OtpLoginRequestResponse requestOtp(AuthDtos.OtpLoginRequest request, String clientIp, String userAgent) {
        String cleanMobile = cleanMobileNumber(request.mobile());
        if (cleanMobile.length() != 10 || !cleanMobile.matches("^[6-9]\\d{9}$")) {
            throw new IllegalArgumentException("Enter a valid 10-digit mobile number.");
        }

        String normalizedRole = normalizeRole(request.role());
        if (!ALLOWED_PORTAL_ROLES.contains(normalizedRole)) {
            throw new IllegalArgumentException("Invalid portal role specified for OTP login.");
        }

        RoleName expectedRoleName = RoleName.valueOf(normalizedRole);

        // 1. IP & Mobile Rate Limiting
        enforceRateLimits(clientIp, cleanMobile);

        // 2. Resend Cooldown Check
        List<OtpLoginChallenge> existingChallenges = challengeRepository
                .findByMobileNumberAndExpectedRoleAndStatus(cleanMobile, normalizedRole, OtpChallengeStatus.PENDING);
        for (OtpLoginChallenge c : existingChallenges) {
            if (Instant.now().isBefore(c.getResendAvailableAt())) {
                throw new IllegalArgumentException("Please wait before requesting another OTP.");
            }
        }

        long ttlSeconds = appProperties.otp() != null && appProperties.otp().ttlSeconds() > 0
                ? appProperties.otp().ttlSeconds()
                : 300L;
        int maxAttempts = appProperties.otp() != null && appProperties.otp().maxAttempts() > 0
                ? appProperties.otp().maxAttempts()
                : 5;

        // 3. Resolve Account with Multi-Role Awareness
        List<User> matchingUsers = userRepository.findAllByMobileAndRole(cleanMobile, expectedRoleName);

        if (matchingUsers.isEmpty()) {
            log.info("OTP Login requested for non-existent mobile {} and role {}", cleanMobile, normalizedRole);
            OtpLoginChallenge decoy = createDecoyChallenge(cleanMobile, normalizedRole, ttlSeconds, maxAttempts, clientIp, userAgent);
            return new AuthDtos.OtpLoginRequestResponse(true, GENERIC_OTP_SENT_MESSAGE, decoy.getChallengeId(), RESEND_COOLDOWN_SECONDS, ttlSeconds);
        }

        if (matchingUsers.size() > 1) {
            log.warn("SECURITY ALERT: Multiple accounts found for mobile {} and role {}. Ambiguity detected, rejecting silently.", cleanMobile, normalizedRole);
            OtpLoginChallenge decoy = createDecoyChallenge(cleanMobile, normalizedRole, ttlSeconds, maxAttempts, clientIp, userAgent);
            return new AuthDtos.OtpLoginRequestResponse(true, GENERIC_OTP_SENT_MESSAGE, decoy.getChallengeId(), RESEND_COOLDOWN_SECONDS, ttlSeconds);
        }

        User user = matchingUsers.get(0);

        // 4. Verify Account Status Permits Login
        if (user.getStatus() != UserStatus.ACTIVE && user.getStatus() != UserStatus.APPROVED) {
            log.warn("OTP Login requested for inactive/suspended account: user={} status={}", user.getUsername(), user.getStatus());
            OtpLoginChallenge decoy = createDecoyChallenge(cleanMobile, normalizedRole, ttlSeconds, maxAttempts, clientIp, userAgent);
            return new AuthDtos.OtpLoginRequestResponse(true, GENERIC_OTP_SENT_MESSAGE, decoy.getChallengeId(), RESEND_COOLDOWN_SECONDS, ttlSeconds);
        }

        // 5. Invalidate / Supersede previous challenges for this mobile + role
        for (OtpLoginChallenge oldChallenge : existingChallenges) {
            oldChallenge.setStatus(OtpChallengeStatus.SUPERSEDED);
            challengeRepository.save(oldChallenge);
        }

        // 6. Send OTP via configured provider
        String providerReference;
        try {
            var provider = otpProviderRouter.current();
            log.info("Sending login OTP for mobile {} (role={}) using provider {}", cleanMobile, normalizedRole, provider.providerName());
            providerReference = provider.sendOtp(cleanMobile);
        } catch (Exception e) {
            log.error("Failed to send OTP via provider for mobile {}: {}", cleanMobile, e.getMessage(), e);
            throw new IllegalArgumentException("Unable to send OTP. Please try again later.");
        }

        // 7. Store new active Challenge
        OtpLoginChallenge challenge = new OtpLoginChallenge();
        challenge.setChallengeId(UUID.randomUUID().toString());
        challenge.setMobileNumber(cleanMobile);
        challenge.setExpectedRole(normalizedRole);
        challenge.setUserId(user.getId());
        challenge.setProviderReference(providerReference);
        challenge.setOtpHash(providerReference != null && !providerReference.isBlank() && !providerReference.equalsIgnoreCase("success")
                ? passwordEncoder.encode(providerReference)
                : "PROVIDER_MANAGED");
        challenge.setExpiryAt(Instant.now().plusSeconds(ttlSeconds));
        challenge.setAttemptCount(0);
        challenge.setMaxAttempts(maxAttempts);
        challenge.setResendAvailableAt(Instant.now().plusSeconds(RESEND_COOLDOWN_SECONDS));
        challenge.setStatus(OtpChallengeStatus.PENDING);
        challenge.setIpAddress(clientIp);
        challenge.setUserAgent(userAgent);
        challenge.setCreatedAt(Instant.now());
        challengeRepository.save(challenge);

        return new AuthDtos.OtpLoginRequestResponse(
                true,
                GENERIC_OTP_SENT_MESSAGE,
                challenge.getChallengeId(),
                RESEND_COOLDOWN_SECONDS,
                ttlSeconds
        );
    }

    @Override
    @Transactional
    public AuthDtos.AuthResponse verifyOtp(AuthDtos.OtpLoginVerifyRequest request, String clientIp, String userAgent) {
        String challengeId = request.challengeId() == null ? "" : request.challengeId().trim();
        String otp = request.otp() == null ? "" : request.otp().trim();

        // 1. Pessimistic Write Lock on challenge prevents race conditions and replay
        OtpLoginChallenge challenge = challengeRepository.findWithLockByChallengeId(challengeId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid OTP or verification session expired."));

        // If decoy challenge (unknown account or invalid state)
        if (challenge.getUserId() == null) {
            log.info("Decoy challenge verification rejected for challengeId {}", challengeId);
            throw new IllegalArgumentException("Incorrect OTP. Please try again.");
        }

        // 2. Challenge Status Check
        if (challenge.getStatus() != OtpChallengeStatus.PENDING) {
            log.warn("Attempt to verify non-pending challenge: id={}, status={}", challengeId, challenge.getStatus());
            throw new IllegalArgumentException("This OTP has already been used or expired. Please request a new OTP.");
        }

        // 3. Expiry Check
        if (Instant.now().isAfter(challenge.getExpiryAt())) {
            challenge.setStatus(OtpChallengeStatus.EXPIRED);
            challengeRepository.save(challenge);
            throw new IllegalArgumentException("Your OTP has expired. Request a new OTP.");
        }

        // 4. Attempt Counter & Brute Force Check
        if (challenge.getAttemptCount() >= challenge.getMaxAttempts()) {
            challenge.setStatus(OtpChallengeStatus.MAX_ATTEMPTS_EXCEEDED);
            challengeRepository.save(challenge);
            throw new IllegalArgumentException("Maximum verification attempts reached. Request a new OTP later.");
        }

        // Increment attempt count atomically
        challenge.setAttemptCount(challenge.getAttemptCount() + 1);
        challengeRepository.saveAndFlush(challenge);

        // 5. Role Match Check
        String reqRole = normalizeRole(request.role());
        if (!challenge.getExpectedRole().equalsIgnoreCase(reqRole)) {
            log.warn("Portal role mismatch: expected={}, requested={}", challenge.getExpectedRole(), reqRole);
            throw new IllegalArgumentException("Portal role mismatch. Please log in through the correct portal.");
        }

        // 6. Verify with Provider
        var provider = otpProviderRouter.current();
        boolean matches = provider.verifyOtp(challenge.getMobileNumber(), otp, challenge.getProviderReference());

        if (!matches) {
            if (challenge.getAttemptCount() >= challenge.getMaxAttempts()) {
                challenge.setStatus(OtpChallengeStatus.MAX_ATTEMPTS_EXCEEDED);
                challengeRepository.save(challenge);
                throw new IllegalArgumentException("Maximum verification attempts reached. Request a new OTP later.");
            }
            throw new IllegalArgumentException("Incorrect OTP. Please try again.");
        }

        // 7. Atomic Challenge Consumption (single-use)
        challenge.setStatus(OtpChallengeStatus.VERIFIED);
        challenge.setConsumedAt(Instant.now());
        challenge.setOtpHash(passwordEncoder.encode(otp));
        challengeRepository.saveAndFlush(challenge);

        // 8. Confirm Account and Permissions
        User user = userRepository.findById(challenge.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("Account not found."));

        if (user.getStatus() != UserStatus.ACTIVE && user.getStatus() != UserStatus.APPROVED) {
            throw new IllegalArgumentException("Your account is currently suspended. Contact support.");
        }

        // 9. ID Payment Gate Check
        boolean isPartnerRole = user.getRoles().stream()
                .anyMatch(r -> r.getName() == RoleName.RETAILER
                        || r.getName() == RoleName.DISTRIBUTOR
                        || r.getName() == RoleName.SUPER_DISTRIBUTOR);

        if (isPartnerRole && user.getIdPaymentStatus() != IdPaymentStatus.SUCCESS) {
            String roleStr = user.getRoles().stream()
                    .map(r -> r.getName().name())
                    .findFirst()
                    .orElse(challenge.getExpectedRole());
            log.warn("OTP Login blocked for user {} ({}): ID Charge payment is {}", user.getUsername(), user.getMobile(), user.getIdPaymentStatus());
            throw new IdPaymentRequiredException(
                    "ID charge payment is required before portal access.",
                    user.getId().toString(),
                    user.getUsername(),
                    user.getMobile(),
                    user.getFullName(),
                    roleStr,
                    user.getIdPaymentStatus() != null ? user.getIdPaymentStatus().name() : "PENDING"
            );
        }

        // 10. Issue Standard JWT / Refresh Token Session
        log.info("OTP Login successful for user {} (role={})", user.getUsername(), challenge.getExpectedRole());
        return authService.issueTokensForUser(user);
    }

    @Override
    @Transactional
    public AuthDtos.OtpLoginRequestResponse resendOtp(AuthDtos.OtpLoginResendRequest request, String clientIp, String userAgent) {
        String challengeId = request.challengeId() == null ? "" : request.challengeId().trim();

        OtpLoginChallenge oldChallenge = challengeRepository.findByChallengeId(challengeId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid verification session. Please request a new OTP."));

        if (Instant.now().isBefore(oldChallenge.getResendAvailableAt())) {
            throw new IllegalArgumentException("Please wait before requesting another OTP.");
        }

        long ttlSeconds = appProperties.otp() != null && appProperties.otp().ttlSeconds() > 0
                ? appProperties.otp().ttlSeconds()
                : 300L;
        int maxAttempts = appProperties.otp() != null && appProperties.otp().maxAttempts() > 0
                ? appProperties.otp().maxAttempts()
                : 5;

        // If old challenge was a decoy
        if (oldChallenge.getUserId() == null) {
            oldChallenge.setStatus(OtpChallengeStatus.SUPERSEDED);
            challengeRepository.save(oldChallenge);
            OtpLoginChallenge decoy = createDecoyChallenge(oldChallenge.getMobileNumber(), oldChallenge.getExpectedRole(), ttlSeconds, maxAttempts, clientIp, userAgent);
            return new AuthDtos.OtpLoginRequestResponse(true, GENERIC_OTP_SENT_MESSAGE, decoy.getChallengeId(), RESEND_COOLDOWN_SECONDS, ttlSeconds);
        }

        // Invalidate old challenge
        oldChallenge.setStatus(OtpChallengeStatus.SUPERSEDED);
        challengeRepository.save(oldChallenge);

        // Check user eligibility
        User user = userRepository.findById(oldChallenge.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("Account not found."));

        if (user.getStatus() != UserStatus.ACTIVE && user.getStatus() != UserStatus.APPROVED) {
            OtpLoginChallenge decoy = createDecoyChallenge(oldChallenge.getMobileNumber(), oldChallenge.getExpectedRole(), ttlSeconds, maxAttempts, clientIp, userAgent);
            return new AuthDtos.OtpLoginRequestResponse(true, GENERIC_OTP_SENT_MESSAGE, decoy.getChallengeId(), RESEND_COOLDOWN_SECONDS, ttlSeconds);
        }

        // Send OTP via provider
        String providerReference;
        try {
            var provider = otpProviderRouter.current();
            log.info("Resending login OTP for mobile {} (role={}) using provider {}", oldChallenge.getMobileNumber(), oldChallenge.getExpectedRole(), provider.providerName());
            providerReference = provider.sendOtp(oldChallenge.getMobileNumber());
        } catch (Exception e) {
            log.error("Failed to resend OTP via provider for mobile {}: {}", oldChallenge.getMobileNumber(), e.getMessage(), e);
            throw new IllegalArgumentException("Unable to send OTP. Please try again later.");
        }

        OtpLoginChallenge newChallenge = new OtpLoginChallenge();
        newChallenge.setChallengeId(UUID.randomUUID().toString());
        newChallenge.setMobileNumber(oldChallenge.getMobileNumber());
        newChallenge.setExpectedRole(oldChallenge.getExpectedRole());
        newChallenge.setUserId(user.getId());
        newChallenge.setProviderReference(providerReference);
        newChallenge.setOtpHash(providerReference != null && !providerReference.isBlank() && !providerReference.equalsIgnoreCase("success")
                ? passwordEncoder.encode(providerReference)
                : "PROVIDER_MANAGED");
        newChallenge.setExpiryAt(Instant.now().plusSeconds(ttlSeconds));
        newChallenge.setAttemptCount(0);
        newChallenge.setMaxAttempts(maxAttempts);
        newChallenge.setResendAvailableAt(Instant.now().plusSeconds(RESEND_COOLDOWN_SECONDS));
        newChallenge.setStatus(OtpChallengeStatus.PENDING);
        newChallenge.setIpAddress(clientIp);
        newChallenge.setUserAgent(userAgent);
        newChallenge.setCreatedAt(Instant.now());
        challengeRepository.save(newChallenge);

        return new AuthDtos.OtpLoginRequestResponse(
                true,
                GENERIC_OTP_SENT_MESSAGE,
                newChallenge.getChallengeId(),
                RESEND_COOLDOWN_SECONDS,
                ttlSeconds
        );
    }

    private void enforceRateLimits(String clientIp, String mobile) {
        if (clientIp != null && !clientIp.isBlank()) {
            Instant ipWindow = Instant.now().minus(IP_RATE_LIMIT_WINDOW_MINUTES, ChronoUnit.MINUTES);
            long ipCount = challengeRepository.countByIpAddressAndCreatedAtAfter(clientIp.trim(), ipWindow);
            if (ipCount >= IP_RATE_LIMIT_MAX) {
                log.warn("Rate limit exceeded for IP {}", clientIp);
                throw new IllegalArgumentException("Too many OTP requests from this network. Please wait before trying again.");
            }
        }

        Instant mobileWindow = Instant.now().minus(MOBILE_RATE_LIMIT_WINDOW_MINUTES, ChronoUnit.MINUTES);
        long mobileCount = challengeRepository.countByMobileNumberAndCreatedAtAfter(mobile, mobileWindow);
        if (mobileCount >= MOBILE_RATE_LIMIT_MAX) {
            log.warn("Rate limit exceeded for mobile {}", mobile);
            throw new IllegalArgumentException("Too many OTP requests for this mobile number. Please try again later.");
        }
    }

    private OtpLoginChallenge createDecoyChallenge(String mobile, String role, long ttlSeconds, int maxAttempts, String clientIp, String userAgent) {
        OtpLoginChallenge decoy = new OtpLoginChallenge();
        decoy.setChallengeId(UUID.randomUUID().toString());
        decoy.setMobileNumber(mobile);
        decoy.setExpectedRole(role);
        decoy.setUserId(null); // No user attached
        decoy.setProviderReference(null);
        decoy.setOtpHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        decoy.setExpiryAt(Instant.now().plusSeconds(ttlSeconds));
        decoy.setAttemptCount(0);
        decoy.setMaxAttempts(maxAttempts);
        decoy.setResendAvailableAt(Instant.now().plusSeconds(RESEND_COOLDOWN_SECONDS));
        decoy.setStatus(OtpChallengeStatus.PENDING);
        decoy.setIpAddress(clientIp);
        decoy.setUserAgent(userAgent);
        decoy.setCreatedAt(Instant.now());
        return challengeRepository.save(decoy);
    }

    private String cleanMobileNumber(String raw) {
        if (raw == null) return "";
        String cleaned = raw.replaceAll("[^0-9]", "");
        if (cleaned.length() > 10) {
            cleaned = cleaned.substring(cleaned.length() - 10);
        }
        return cleaned;
    }

    private String normalizeRole(String raw) {
        if (raw == null || raw.isBlank()) return "RETAILER";
        return raw.trim().replace('-', '_').replace(' ', '_').toUpperCase();
    }

    @Scheduled(cron = "0 0 * * * *") // Runs every hour
    @Transactional
    public void cleanupExpiredChallenges() {
        try {
            Instant cutoff = Instant.now().minus(48, ChronoUnit.HOURS);
            int deleted = challengeRepository.deleteOlderThan(cutoff);
            if (deleted > 0) {
                log.info("Retention cleanup: purged {} expired/consumed OTP login challenges older than 48 hours", deleted);
            }
        } catch (Exception e) {
            log.warn("Failed to clean up expired OTP login challenges: {}", e.getMessage());
        }
    }
}
