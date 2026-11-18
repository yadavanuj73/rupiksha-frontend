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
@Table(name = "admin_auth_audit_log")
public class AdminAuthAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false, unique = true, length = 64)
    private String eventId;

    @Column(name = "admin_user_id")
    private UUID adminUserId;

    @Column(name = "admin_username", length = 100)
    private String adminUsername;

    @Column(name = "admin_role", length = 50)
    private String adminRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 64)
    private AdminAuthAuditEventType eventType;

    @Column(name = "event_timestamp", nullable = false)
    private Instant eventTimestamp = Instant.now();

    @Column(name = "masked_destination", length = 20)
    private String maskedDestination;

    @Column(name = "challenge_id", length = 64)
    private String challengeId;

    @Column(name = "source_ip", length = 64)
    private String sourceIp;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "device_info", length = 255)
    private String deviceInfo;

    @Column(name = "correlation_id", length = 64)
    private String correlationId;

    @Column(name = "outcome", nullable = false, length = 32)
    private String outcome; // SUCCESS, FAILURE, BLOCKED, WARNING

    @Column(name = "failure_reason", length = 255)
    private String failureReason;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    @Column(name = "auth_version")
    private Integer authVersion;

    @Column(name = "metadata", columnDefinition = "text")
    private String metadata;
}
