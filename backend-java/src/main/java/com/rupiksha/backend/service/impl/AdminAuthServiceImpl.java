package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.AdminAuthDtos;
import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.AdminOtpChallengeRepository;
import com.rupiksha.backend.repository.RefreshTokenRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtService;
import com.rupiksha.backend.service.AdminAuditService;
import com.rupiksha.backend.service.AdminAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuthServiceImpl implements AdminAuthService {

    public static final int OTP_TTL_SECONDS = 300; // 5 minutes
    public static final int RESEND_COOLDOWN_SECONDS = 60; // 60 seconds
    public static final int MAX_OTP_ATTEMPTS = 5; // 5 incorrect attempts
    public static final int MAX_RESENDS_PER_CHALLENGE = 5;
    public static final int IP_RATE_LIMIT_MAX = 20; // 20 requests per 10 mins
    public static final int IP_RATE_LIMIT_WINDOW_MINUTES = 10;

    private final UserRepository userRepository;
    private final AdminOtpChallengeRepository challengeRepository;
    private final AdminDestinationService destinationService;
    private final AdminAuditService auditService;
    private final OtpProviderRouter otpProviderRouter;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AppProperties appProperties;

    private final SecureRandom secureRandom = new SecureRandom();

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.rupiksha.backend.integration.otp.DoveSoftOtpProvider doveSoftOtpProvider;

    @Override
    public Map<String, Object> getDoveSoftDiagnostics() {
        if (doveSoftOtpProvider != null) {
            return doveSoftOtpProvider.getDiagnostics();
        }
        if (otpProviderRouter != null && otpProviderRouter.current() instanceof com.rupiksha.backend.integration.otp.DoveSoftOtpProvider ds) {
            return ds.getDiagnostics();
        }
        return Map.of(
                "activeProvider", otpProviderRouter != null ? otpProviderRouter.current().providerName() : "UNKNOWN",
                "message", "DoveSoft is not currently the active OTP provider"
        );
    }

    @Override
    @Transactional
    public AdminAuthDtos.AdminLoginInitResponse initiateLogin(
            AdminAuthDtos.AdminLoginRequest request,
            String clientIp,
            String userAgent,
            String correlationId
    ) {
        String identifier = request.username() != null ? request.username().trim() : "";
        String cleanIp = clientIp != null ? clientIp.trim() : "unknown";

        auditService.logEvent(
                AdminAuthAuditEventType.ADMIN_LOGIN_INITIATED,
                null, identifier, "ADMIN",
                null, null, cleanIp, userAgent, correlationId,
                "INITIATED", null, null, null, null
        );

        // 1. IP-based Rate Limiting
        enforceIpRateLimit(cleanIp, correlationId);

        // 2. Locate Admin User
        User user = userRepository.findByUsername(identifier)
                .or(() -> userRepository.findByEmail(identifier))
                .or(() -> userRepository.findByMobile(identifier))
                .orElse(null);

        if (user == null) {
            auditService.logEvent(
                    AdminAuthAuditEventType.PASSWORD_AUTH_FAILED,
                    null, identifier, "ADMIN",
                    null, null, cleanIp, userAgent, correlationId,
                    "FAILURE", "User not found", null, null, null
            );
            throw new IllegalArgumentException("Invalid admin credentials.");
        }

        // 3. Verify Password
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            auditService.logEvent(
                    AdminAuthAuditEventType.PASSWORD_AUTH_FAILED,
                    user.getId(), user.getUsername(), "ADMIN",
                    null, null, cleanIp, userAgent, correlationId,
                    "FAILURE", "Incorrect password", null, user.getAdminSessionVersion(), null
            );
            throw new IllegalArgumentException("Invalid admin credentials.");
        }

        // 4. Verify Account Status
        if (user.getStatus() != UserStatus.ACTIVE && user.getStatus() != UserStatus.APPROVED) {
            auditService.logEvent(
                    AdminAuthAuditEventType.PASSWORD_AUTH_FAILED,
                    user.getId(), user.getUsername(), "ADMIN",
                    null, null, cleanIp, userAgent, correlationId,
                    "BLOCKED", "Admin account suspended or pending approval: " + user.getStatus(),
                    null, user.getAdminSessionVersion(), null
            );
            throw new IllegalArgumentException("Admin account is not active. Contact system administration.");
        }

        // 5. Verify ADMIN Role Authorization
        boolean hasAdminRole = user.getRoles().stream()
                .anyMatch(r -> r.getName() == RoleName.ADMIN);
        if (!hasAdminRole) {
            auditService.logEvent(
                    AdminAuthAuditEventType.PASSWORD_AUTH_FAILED,
                    user.getId(), user.getUsername(), "NON_ADMIN",
                    null, null, cleanIp, userAgent, correlationId,
                    "BLOCKED", "Unauthorized role for admin portal",
                    null, user.getAdminSessionVersion(), null
            );
            throw new IllegalArgumentException("These credentials are not authorized for the admin portal.");
        }

        auditService.logEvent(
                AdminAuthAuditEventType.PASSWORD_AUTH_SUCCESS,
                user.getId(), user.getUsername(), "ADMIN",
                null, null, cleanIp, userAgent, correlationId,
                "SUCCESS", null, null, user.getAdminSessionVersion(), null
        );

        // 6. Invalidate previous active challenges for this admin
        List<AdminOtpChallenge> existing = challengeRepository.findByAdminUserIdAndStatus(
                user.getId(), AdminOtpChallengeStatus.PENDING
        );
        for (AdminOtpChallenge old : existing) {
            old.setStatus(AdminOtpChallengeStatus.SUPERSEDED);
            challengeRepository.save(old);
        }

        // 7. Create Short-Lived Restricted OTP Challenge
        AdminOtpChallenge challenge = new AdminOtpChallenge();
        challenge.setChallengeId(UUID.randomUUID().toString());
        challenge.setAdminUserId(user.getId());
        challenge.setAdminUsername(user.getUsername());
        challenge.setDestinationIdentifier("PENDING_SELECTION");
        challenge.setMaskedDestination("NOT_SELECTED");
        challenge.setOtpHash("PENDING");
        challenge.setExpiryAt(Instant.now().plusSeconds(OTP_TTL_SECONDS));
        challenge.setAttemptCount(0);
        challenge.setMaxAttempts(MAX_OTP_ATTEMPTS);
        challenge.setResendCount(0);
        challenge.setResendAvailableAt(Instant.now());
        challenge.setStatus(AdminOtpChallengeStatus.PENDING);
        challenge.setIpAddress(cleanIp);
        challenge.setUserAgent(userAgent);
        challenge.setCreatedAt(Instant.now());

        challengeRepository.save(challenge);

        return new AdminAuthDtos.AdminLoginInitResponse(
                true,
                challenge.getChallengeId(),
                "Credentials verified. Select mobile number to receive OTP.",
                destinationService.getAvailableDestinations(),
                OTP_TTL_SECONDS,
                RESEND_COOLDOWN_SECONDS
        );
    }

    @Override
    @Transactional
    public AdminAuthDtos.AdminSendOtpResponse sendOtp(
            AdminAuthDtos.AdminSendOtpRequest request,
            String clientIp,
            String userAgent,
            String correlationId
    ) {
        String challengeId = request.challengeId() != null ? request.challengeId().trim() : "";
        String cleanIp = clientIp != null ? clientIp.trim() : "unknown";

        AdminOtpChallenge challenge = challengeRepository.findWithLockByChallengeId(challengeId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid verification challenge or session expired."));

        if (challenge.getStatus() != AdminOtpChallengeStatus.PENDING) {
            throw new IllegalArgumentException("This verification challenge is no longer active. Please sign in again.");
        }

        if (challenge.isExpired()) {
            challenge.setStatus(AdminOtpChallengeStatus.EXPIRED);
            challengeRepository.save(challenge);
            auditService.logEvent(
                    AdminAuthAuditEventType.OTP_EXPIRED,
                    challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                    challenge.getMaskedDestination(), challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                    "EXPIRED", "Challenge expired before OTP delivery", null, null, null
            );
            throw new IllegalArgumentException("Verification session has expired. Please sign in again.");
        }

        if (Instant.now().isBefore(challenge.getResendAvailableAt())) {
            throw new IllegalArgumentException("Please wait 60 seconds before requesting another code.");
        }

        if (challenge.getResendCount() >= MAX_RESENDS_PER_CHALLENGE) {
            challenge.setStatus(AdminOtpChallengeStatus.BLOCKED);
            challengeRepository.save(challenge);
            auditService.logEvent(
                    AdminAuthAuditEventType.OTP_CHALLENGE_BLOCKED,
                    challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                    challenge.getMaskedDestination(), challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                    "BLOCKED", "Max resend attempts reached", null, null, null
            );
            throw new IllegalArgumentException("Maximum OTP requests exceeded. Challenge blocked for security.");
        }

        // 1. Resolve and Validate Destination Identifier
        String destinationId = request.destination() != null ? request.destination().trim() : "";
        String resolvedPhoneNumber = destinationService.resolveDestination(destinationId);
        String maskedDestination = destinationService.maskForIdentifier(destinationId);

        auditService.logEvent(
                AdminAuthAuditEventType.OTP_DESTINATION_SELECTED,
                challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                maskedDestination, challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                "SUCCESS", null, null, null, null
        );

        auditService.logEvent(
                AdminAuthAuditEventType.OTP_GEN_REQUESTED,
                challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                maskedDestination, challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                "SUCCESS", null, null, null, null
        );

        // 2. Generate Cryptographically Secure 6-Digit OTP
        int secureNumber = secureRandom.nextInt(1000000);
        String generatedOtp = String.format("%06d", secureNumber);
        String saltedOtpHash = passwordEncoder.encode(generatedOtp);

        // 3. Deliver Real OTP via Configured SMS Provider
        var provider = otpProviderRouter.current();
        String providerReference;
        try {
            log.info("Sending Admin 2FA OTP to destination identifier {} (masked={}) using provider {}",
                    destinationId, maskedDestination, provider.providerName());
            providerReference = provider.sendOtp(resolvedPhoneNumber);
            if (providerReference == null || providerReference.isBlank()) {
                throw new IllegalStateException("SMS provider returned an empty delivery reference.");
            }
        } catch (Exception e) {
            log.error("Real SMS delivery failed for admin {} to masked destination {}: {}",
                    challenge.getAdminUsername(), maskedDestination, e.getMessage(), e);
            auditService.logEvent(
                    AdminAuthAuditEventType.OTP_SMS_DELIVERY_FAILED,
                    challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                    maskedDestination, challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                    "FAILURE", "SMS provider delivery error: " + e.getMessage(), null, null, null
            );
            throw new IllegalArgumentException("Unable to deliver verification code via SMS. Please try again later.");
        }

        auditService.logEvent(
                AdminAuthAuditEventType.OTP_SMS_DELIVERY_SUCCESS,
                challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                maskedDestination, challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                "SUCCESS", null, null, null, null
        );

        // 4. Update Challenge State
        challenge.setDestinationIdentifier(destinationId.toUpperCase());
        challenge.setMaskedDestination(maskedDestination);
        challenge.setOtpHash(saltedOtpHash);
        challenge.setProviderReference(providerReference);
        challenge.setExpiryAt(Instant.now().plusSeconds(OTP_TTL_SECONDS));
        challenge.setResendAvailableAt(Instant.now().plusSeconds(RESEND_COOLDOWN_SECONDS));
        challenge.setResendCount(challenge.getResendCount() + 1);

        challengeRepository.save(challenge);

        return new AdminAuthDtos.AdminSendOtpResponse(
                true,
                challenge.getChallengeId(),
                maskedDestination,
                "Verification code sent to " + maskedDestination,
                OTP_TTL_SECONDS,
                RESEND_COOLDOWN_SECONDS
        );
    }

    @Override
    @Transactional
    public AdminAuthDtos.AdminSendOtpResponse resendOtp(
            AdminAuthDtos.AdminResendOtpRequest request,
            String clientIp,
            String userAgent,
            String correlationId
    ) {
        String challengeId = request.challengeId() != null ? request.challengeId().trim() : "";
        AdminOtpChallenge challenge = challengeRepository.findWithLockByChallengeId(challengeId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid verification challenge or session expired."));

        if ("PENDING_SELECTION".equals(challenge.getDestinationIdentifier())) {
            throw new IllegalArgumentException("Please select an authorized mobile number first.");
        }

        auditService.logEvent(
                AdminAuthAuditEventType.OTP_RESEND_REQUESTED,
                challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                challenge.getMaskedDestination(), challenge.getChallengeId(), clientIp, userAgent, correlationId,
                "REQUESTED", null, null, null, null
        );

        return sendOtp(
                new AdminAuthDtos.AdminSendOtpRequest(challenge.getChallengeId(), challenge.getDestinationIdentifier()),
                clientIp, userAgent, correlationId
        );
    }

    @Override
    @Transactional
    public AuthDtos.AuthResponse verifyOtp(
            AdminAuthDtos.AdminVerifyOtpRequest request,
            String clientIp,
            String userAgent,
            String correlationId
    ) {
        String challengeId = request.challengeId() != null ? request.challengeId().trim() : "";
        String cleanIp = clientIp != null ? clientIp.trim() : "unknown";
        String submittedOtp = request.otp() != null ? request.otp().trim() : "";

        // 1. Lock and Load Challenge
        AdminOtpChallenge challenge = challengeRepository.findWithLockByChallengeId(challengeId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid verification challenge or session expired."));

        // 2. Validate Challenge Status
        if (challenge.getStatus() != AdminOtpChallengeStatus.PENDING) {
            auditService.logEvent(
                    AdminAuthAuditEventType.OTP_VERIFY_FAILED,
                    challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                    challenge.getMaskedDestination(), challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                    "FAILURE", "Challenge is not pending (status: " + challenge.getStatus() + ")", null, null, null
            );
            throw new IllegalArgumentException("This verification challenge is no longer valid. Please log in again.");
        }

        // 3. Expiration Check
        if (challenge.isExpired()) {
            challenge.setStatus(AdminOtpChallengeStatus.EXPIRED);
            challengeRepository.save(challenge);
            auditService.logEvent(
                    AdminAuthAuditEventType.OTP_EXPIRED,
                    challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                    challenge.getMaskedDestination(), challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                    "EXPIRED", "OTP challenge expired", null, null, null
            );
            throw new IllegalArgumentException("Verification code has expired. Please request a new code.");
        }

        // 4. Max Attempts Exceeded Check
        if (challenge.hasExceededAttempts()) {
            challenge.setStatus(AdminOtpChallengeStatus.MAX_ATTEMPTS_EXCEEDED);
            challengeRepository.save(challenge);
            auditService.logEvent(
                    AdminAuthAuditEventType.OTP_CHALLENGE_BLOCKED,
                    challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                    challenge.getMaskedDestination(), challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                    "BLOCKED", "Maximum verification attempts exceeded", null, null, null
            );
            throw new IllegalArgumentException("Maximum verification attempts exceeded. Challenge blocked for security.");
        }

        // Increment attempt count atomically
        challenge.setAttemptCount(challenge.getAttemptCount() + 1);
        challengeRepository.saveAndFlush(challenge);

        // 5. Strict 6-Digit Format Validation
        if (!submittedOtp.matches("^\\d{6}$")) {
            auditService.logEvent(
                    AdminAuthAuditEventType.OTP_VERIFY_FAILED,
                    challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                    challenge.getMaskedDestination(), challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                    "FAILURE", "Malformed OTP format", null, null, null
            );
            throw new IllegalArgumentException("Verification code must be exactly 6 digits.");
        }

        // 6. Server-Side Verification against SMS Provider and Secure Hash
        String resolvedPhoneNumber = destinationService.resolveDestination(challenge.getDestinationIdentifier());
        var provider = otpProviderRouter.current();

        boolean verified = false;

        // Path A: SMS Provider verification (e.g. DoveSoft validateOtpApi)
        if (provider != null) {
            try {
                verified = provider.verifyOtp(resolvedPhoneNumber, submittedOtp, challenge.getProviderReference());
            } catch (Exception e) {
                log.warn("Provider verifyOtp threw exception: {}", e.getMessage());
            }
        }

        // Path B: Cryptographic BCrypt match against backend-generated salted hash
        if (!verified && challenge.getOtpHash() != null && !challenge.getOtpHash().isBlank() && !"PENDING".equals(challenge.getOtpHash())) {
            verified = passwordEncoder.matches(submittedOtp, challenge.getOtpHash());
        }

        if (!verified) {
            boolean blockedNow = challenge.getAttemptCount() >= challenge.getMaxAttempts();
            if (blockedNow) {
                challenge.setStatus(AdminOtpChallengeStatus.MAX_ATTEMPTS_EXCEEDED);
                challengeRepository.save(challenge);
                auditService.logEvent(
                        AdminAuthAuditEventType.OTP_CHALLENGE_BLOCKED,
                        challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                        challenge.getMaskedDestination(), challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                        "BLOCKED", "Incorrect OTP. Max attempts (" + challenge.getMaxAttempts() + ") exceeded",
                        null, null, null
                );
                throw new IllegalArgumentException("Incorrect verification code. Maximum attempts reached, challenge blocked.");
            }

            auditService.logEvent(
                    AdminAuthAuditEventType.OTP_VERIFY_FAILED,
                    challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                    challenge.getMaskedDestination(), challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                    "FAILURE", "Incorrect OTP (attempt " + challenge.getAttemptCount() + " of " + challenge.getMaxAttempts() + ")",
                    null, null, null
            );
            throw new IllegalArgumentException("Incorrect verification code. " +
                    (challenge.getMaxAttempts() - challenge.getAttemptCount()) + " attempt(s) remaining.");
        }

        // 7. Atomic Challenge Consumption
        challenge.setStatus(AdminOtpChallengeStatus.VERIFIED);
        challenge.setVerifiedAt(Instant.now());
        challenge.setConsumedAt(Instant.now());
        challenge.setOtpHash(passwordEncoder.encode(submittedOtp)); // Store salted hash of verified OTP
        challengeRepository.saveAndFlush(challenge);

        auditService.logEvent(
                AdminAuthAuditEventType.OTP_VERIFY_SUCCESS,
                challenge.getAdminUserId(), challenge.getAdminUsername(), "ADMIN",
                challenge.getMaskedDestination(), challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                "SUCCESS", null, null, null, null
        );

        // 8. Confirm Admin User Account and Issue Authorized Session
        User user = userRepository.findById(challenge.getAdminUserId())
                .orElseThrow(() -> new IllegalArgumentException("Admin account not found."));

        if (user.getStatus() != UserStatus.ACTIVE && user.getStatus() != UserStatus.APPROVED) {
            throw new IllegalArgumentException("Admin account is no longer active.");
        }

        boolean hasAdminRole = user.getRoles().stream()
                .anyMatch(r -> r.getName() == RoleName.ADMIN);
        if (!hasAdminRole) {
            throw new IllegalArgumentException("Unauthorized: account does not possess ADMIN permissions.");
        }

        AuthDtos.AuthResponse authResponse = issueAdminTokens(user);

        auditService.logEvent(
                AdminAuthAuditEventType.ADMIN_LOGIN_COMPLETED,
                user.getId(), user.getUsername(), "ADMIN",
                challenge.getMaskedDestination(), challenge.getChallengeId(), cleanIp, userAgent, correlationId,
                "SUCCESS", null, user.getId().toString(), user.getAdminSessionVersion(), null
        );

        return authResponse;
    }

    @Override
    @Transactional
    public void logout(
            String refreshToken,
            UUID adminUserId,
            String clientIp,
            String userAgent,
            String correlationId
    ) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            String hash = sha256(refreshToken.trim());
            refreshTokenRepository.findByTokenHash(hash).ifPresent(rt -> {
                rt.setRevoked(true);
                refreshTokenRepository.save(rt);
            });
        }

        if (adminUserId != null) {
            userRepository.findById(adminUserId).ifPresent(u -> {
                // Increment session version to instantly invalidate all issued access tokens
                u.setAdminSessionVersion(u.getAdminSessionVersion() + 1);
                userRepository.save(u);

                auditService.logEvent(
                        AdminAuthAuditEventType.ADMIN_LOGOUT,
                        u.getId(), u.getUsername(), "ADMIN",
                        null, null, clientIp, userAgent, correlationId,
                        "SUCCESS", null, null, u.getAdminSessionVersion(), null
                );
                auditService.logEvent(
                        AdminAuthAuditEventType.SESSION_INVALIDATED,
                        u.getId(), u.getUsername(), "ADMIN",
                        null, null, clientIp, userAgent, correlationId,
                        "INVALIDATED", "Admin logout: session version incremented", null, u.getAdminSessionVersion(), null
                );
            });
        }
    }

    @Override
    @Transactional
    public void invalidateAllAdminSessions(
            UUID actingAdminUserId,
            String clientIp,
            String userAgent,
            String correlationId
    ) {
        log.warn("SECURITY EVENT: Invalidate all admin sessions triggered by user {}", actingAdminUserId);

        // 1. Invalidate all admin refresh tokens in database
        List<User> adminUsers = userRepository.findAll().stream()
                .filter(u -> u.getRoles().stream().anyMatch(r -> r.getName() == RoleName.ADMIN))
                .toList();

        for (User admin : adminUsers) {
            admin.setAdminSessionVersion(admin.getAdminSessionVersion() + 1);
            userRepository.save(admin);

            refreshTokenRepository.findAllByUser(admin).forEach(rt -> {
                rt.setRevoked(true);
                refreshTokenRepository.save(rt);
            });

            auditService.logEvent(
                    AdminAuthAuditEventType.SESSION_INVALIDATED,
                    admin.getId(), admin.getUsername(), "ADMIN",
                    null, null, clientIp, userAgent, correlationId,
                    "INVALIDATED", "Global admin session invalidation", null, admin.getAdminSessionVersion(), null
            );
        }
    }

    private AuthDtos.AuthResponse issueAdminTokens(User user) {
        List<String> roles = user.getRoles().stream().map(r -> r.getName().name()).toList();
        // Crucial: Embed admin_session_version in JWT claims
        String access = jwtService.createAccessToken(
                user.getId(),
                user.getUsername(),
                roles,
                user.getAdminSessionVersion()
        );
        String refreshRaw = UUID.randomUUID().toString() + "." + UUID.randomUUID();
        String refreshHash = sha256(refreshRaw);

        RefreshToken rt = new RefreshToken();
        rt.setUser(user);
        rt.setTokenHash(refreshHash);
        rt.setExpiresAt(Instant.now().plusSeconds(appProperties.jwt().refreshTokenDays() * 86400));
        refreshTokenRepository.save(rt);

        return new AuthDtos.AuthResponse(
                access,
                refreshRaw,
                "Bearer",
                appProperties.jwt().accessTokenMinutes() * 60,
                toView(user)
        );
    }

    private AuthDtos.UserView toView(User user) {
        return new AuthDtos.UserView(
                user.getId().toString(),
                user.getUsername(),
                user.getMobile(),
                user.getEmail(),
                user.getFullName(),
                user.getPartyCode(),
                user.getStatus() != null ? user.getStatus().name() : null,
                user.getRegistrationStatus() != null ? user.getRegistrationStatus().name() : "APPROVED",
                user.getKycStatus() != null ? user.getKycStatus().name() : "APPROVED",
                user.getIdPaymentStatus() != null ? user.getIdPaymentStatus().name() : "SUCCESS",
                user.getPinHash() != null && !user.getPinHash().isBlank(),
                user.getRoles().stream().map(r -> r.getName().name()).toList(),
                user.getAddedByName(),
                user.getAddedByPartyCode(),
                user.getCreatedAt(),
                user.getPhotoUrl()
        );
    }

    private void enforceIpRateLimit(String clientIp, String correlationId) {
        if ("unknown".equalsIgnoreCase(clientIp) || "127.0.0.1".equals(clientIp) || "localhost".equalsIgnoreCase(clientIp)) {
            return;
        }
        Instant windowStart = Instant.now().minus(IP_RATE_LIMIT_WINDOW_MINUTES, ChronoUnit.MINUTES);
        long recentCount = challengeRepository.countByIpAddressAndCreatedAtAfter(clientIp, windowStart);
        if (recentCount >= IP_RATE_LIMIT_MAX) {
            auditService.logEvent(
                    AdminAuthAuditEventType.RATE_LIMIT_TRIGGERED,
                    null, null, "ADMIN",
                    null, null, clientIp, null, correlationId,
                    "BLOCKED", "IP rate limit exceeded (" + recentCount + " attempts in " + IP_RATE_LIMIT_WINDOW_MINUTES + " mins)",
                    null, null, null
            );
            throw new IllegalArgumentException("Too many requests from this location. Please try again later.");
        }
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to hash token");
        }
    }
}
