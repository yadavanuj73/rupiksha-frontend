package com.rupiksha.aeps.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "payout_otp_challenges")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayoutOtpChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "challenge_id", unique = true, nullable = false, length = 64)
    private String challengeId;

    @Column(name = "payout_intent_id", nullable = false, length = 64)
    private String payoutIntentId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "user_role", nullable = false, length = 32)
    private String userRole;

    @Column(name = "mobile_number", nullable = false, length = 20)
    private String mobileNumber;

    @Column(name = "masked_mobile", nullable = false, length = 20)
    private String maskedMobile;

    @Column(name = "beneficiary_id")
    private Long beneficiaryId;

    @Column(name = "beneficiary_name", nullable = false, length = 150)
    private String beneficiaryName;

    @Column(name = "account_number", nullable = false, length = 30)
    private String accountNumber;

    @Column(name = "ifsc", nullable = false, length = 20)
    private String ifsc;

    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "transfer_mode", nullable = false, length = 10)
    @Builder.Default
    private String transferMode = "IMPS";

    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "base_charge", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal baseCharge = BigDecimal.ZERO;

    @Column(name = "gst_amount", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal gstAmount = BigDecimal.ZERO;

    @Column(name = "total_charge", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal totalCharge = BigDecimal.ZERO;

    @Column(name = "total_deducted_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalDeductedAmount;

    @Column(name = "payload_hash", nullable = false, length = 128)
    private String payloadHash;

    @Column(name = "otp_hash", nullable = false, length = 255)
    private String otpHash;

    @Column(name = "provider_reference", length = 255)
    private String providerReference;

    @Column(name = "expiry_at", nullable = false)
    private Instant expiryAt;

    @Column(name = "attempt_count", nullable = false)
    @Builder.Default
    private int attemptCount = 0;

    @Column(name = "max_attempts", nullable = false)
    @Builder.Default
    private int maxAttempts = 5;

    @Column(name = "resend_count", nullable = false)
    @Builder.Default
    private int resendCount = 0;

    @Column(name = "resend_available_at", nullable = false)
    private Instant resendAvailableAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    @Builder.Default
    private PayoutOtpStatus status = PayoutOtpStatus.PENDING;

    @Column(name = "authorization_reference", unique = true, length = 128)
    private String authorizationReference;

    @Column(name = "authorization_expires_at")
    private Instant authorizationExpiresAt;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
