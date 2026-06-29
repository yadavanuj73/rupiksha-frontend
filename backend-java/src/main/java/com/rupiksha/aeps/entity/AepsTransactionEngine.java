package com.rupiksha.aeps.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "aeps_transaction_engine")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AepsTransactionEngine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transaction_id", unique = true, nullable = false, length = 100)
    private String transactionId;

    @Column(name = "reference_number", unique = true, nullable = false, length = 100)
    private String referenceNumber;

    @Column(name = "provider", nullable = false, length = 50)
    private String provider;

    @Column(name = "service_type", nullable = false, length = 50)
    private String serviceType;

    @Column(name = "merchant_id", nullable = false, length = 80)
    private String merchantId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "status", nullable = false, length = 30)
    private String status;

    @Column(name = "workflow_state", nullable = false, length = 50)
    private String workflowState;

    @Column(name = "provider_reference", length = 100)
    private String providerReference;

    @Column(name = "provider_status", length = 50)
    private String providerStatus;

    @Column(name = "provider_message", length = 255)
    private String providerMessage;

    @Column(name = "initiated_at", updatable = false, nullable = false)
    private LocalDateTime initiatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "last_updated", nullable = false)
    private LocalDateTime lastUpdated;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "device_id", length = 100)
    private String deviceId;

    @Column(name = "latitude", length = 30)
    private String latitude;

    @Column(name = "longitude", length = 30)
    private String longitude;

    @Column(name = "correlation_id", length = 100)
    private String correlationId;

    @Column(name = "created_by", length = 80)
    private String createdBy;

    @Column(name = "updated_by", length = 80)
    private String updatedBy;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (initiatedAt == null) {
            initiatedAt = now;
        }
        lastUpdated = now;
    }

    @PreUpdate
    protected void onUpdate() {
        lastUpdated = LocalDateTime.now();
    }
}
