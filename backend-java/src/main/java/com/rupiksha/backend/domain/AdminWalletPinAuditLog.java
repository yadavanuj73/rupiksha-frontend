package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "admin_wallet_pin_audit_log")
public class AdminWalletPinAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false, unique = true, length = 64)
    private String eventId;

    @Column(name = "admin_user_id")
    private UUID adminUserId;

    @Column(name = "admin_username", length = 100)
    private String adminUsername;

    @Column(name = "target_user_id")
    private UUID targetUserId;

    @Column(name = "target_username", length = 100)
    private String targetUsername;

    @Enumerated(EnumType.STRING)
    @Column(name = "operation_type", nullable = false, length = 64)
    private AdminWalletOperationType operationType;

    @Column(name = "amount", precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(name = "fund_request_id", length = 64)
    private String fundRequestId;

    @Column(name = "timestamp", nullable = false)
    private Instant timestamp = Instant.now();

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome", nullable = false, length = 64)
    private AdminWalletPinAuditOutcome outcome;

    @Column(name = "transaction_reference_id", length = 64)
    private String transactionReferenceId;

    @Column(name = "failure_category", length = 64)
    private String failureCategory;

    @Column(name = "failure_reason", length = 255)
    private String failureReason;

    @Column(name = "correlation_id", length = 64)
    private String correlationId;

    @Column(name = "source_ip", length = 64)
    private String sourceIp;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "metadata", columnDefinition = "text")
    private String metadata;
}
