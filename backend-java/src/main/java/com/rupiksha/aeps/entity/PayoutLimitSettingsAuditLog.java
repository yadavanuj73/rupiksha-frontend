package com.rupiksha.aeps.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payout_limit_settings_audit_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayoutLimitSettingsAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", unique = true, nullable = false, length = 64)
    private String eventId;

    @Column(name = "admin_user_id", length = 64)
    private String adminUserId;

    @Column(name = "admin_username", length = 100)
    private String adminUsername;

    @Column(name = "previous_minimum_amount", precision = 12, scale = 2)
    private BigDecimal previousMinimumAmount;

    @Column(name = "new_minimum_amount", precision = 12, scale = 2)
    private BigDecimal newMinimumAmount;

    @Column(name = "previous_maximum_amount", precision = 12, scale = 2)
    private BigDecimal previousMaximumAmount;

    @Column(name = "new_maximum_amount", precision = 12, scale = 2)
    private BigDecimal newMaximumAmount;

    @Column(name = "event_timestamp", nullable = false)
    @Builder.Default
    private Instant eventTimestamp = Instant.now();

    @Column(name = "correlation_id", length = 64)
    private String correlationId;

    @Column(name = "source_ip", length = 64)
    private String sourceIp;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "operation_result", nullable = false, length = 32)
    private String operationResult;

    @Column(name = "failure_reason", length = 255)
    private String failureReason;

    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;
}
