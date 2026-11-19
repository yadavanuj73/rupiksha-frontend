package com.rupiksha.aeps.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "payout_otp_audit_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayoutOtpAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", unique = true, nullable = false, length = 64)
    private String eventId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "user_role", length = 50)
    private String userRole;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(name = "event_timestamp", nullable = false)
    @Builder.Default
    private Instant eventTimestamp = Instant.now();

    @Column(name = "challenge_id", length = 64)
    private String challengeId;

    @Column(name = "payout_intent_id", length = 64)
    private String payoutIntentId;

    @Column(name = "authorization_reference", length = 128)
    private String authorizationReference;

    @Column(name = "masked_mobile", length = 20)
    private String maskedMobile;

    @Column(name = "source_ip", length = 64)
    private String sourceIp;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "correlation_id", length = 64)
    private String correlationId;

    @Column(name = "outcome", nullable = false, length = 32)
    private String outcome; // SUCCESS, FAILED

    @Column(name = "failure_reason", length = 255)
    private String failureReason;

    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;
}
