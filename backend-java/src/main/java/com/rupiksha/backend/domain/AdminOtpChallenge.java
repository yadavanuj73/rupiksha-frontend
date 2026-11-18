package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "admin_otp_challenges")
public class AdminOtpChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "challenge_id", nullable = false, unique = true, length = 64)
    private String challengeId;

    @Column(name = "admin_user_id", nullable = false)
    private UUID adminUserId;

    @Column(name = "admin_username", nullable = false, length = 100)
    private String adminUsername;

    @Column(name = "destination_identifier", nullable = false, length = 32)
    private String destinationIdentifier;

    @Column(name = "masked_destination", nullable = false, length = 20)
    private String maskedDestination;

    @Column(name = "otp_hash", nullable = false, length = 255)
    private String otpHash;

    @Column(name = "provider_reference", length = 255)
    private String providerReference;

    @Column(name = "expiry_at", nullable = false)
    private Instant expiryAt;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount = 0;

    @Column(name = "max_attempts", nullable = false)
    private int maxAttempts = 5;

    @Column(name = "resend_count", nullable = false)
    private int resendCount = 0;

    @Column(name = "resend_available_at", nullable = false)
    private Instant resendAvailableAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private AdminOtpChallengeStatus status = AdminOtpChallengeStatus.PENDING;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    public boolean isExpired() {
        return Instant.now().isAfter(expiryAt);
    }

    public boolean isConsumed() {
        return consumedAt != null || status == AdminOtpChallengeStatus.VERIFIED;
    }

    public boolean hasExceededAttempts() {
        return attemptCount >= maxAttempts;
    }
}
