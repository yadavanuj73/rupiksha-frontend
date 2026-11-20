package com.rupiksha.aeps.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "payout_webhook_events")
public class PayoutWebhookEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", length = 100)
    private String eventId;

    @Column(name = "order_id", length = 100)
    private String orderId;

    @Column(name = "provider_txn_id", length = 100)
    private String providerTxnId;

    @Column(name = "payload_hash", nullable = false, length = 64)
    private String payloadHash;

    @Column(name = "provider_status", length = 50)
    private String providerStatus;

    @Column(name = "mapped_status", length = 50)
    private String mappedStatus;

    @Column(name = "verification_method", length = 50)
    private String verificationMethod;

    @Column(name = "verification_result", length = 50)
    private String verificationResult;

    @Column(name = "processing_status", nullable = false, length = 50)
    private String processingStatus;

    @Column(name = "http_status_code", nullable = false)
    @Builder.Default
    private Integer httpStatusCode = 200;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "raw_payload", columnDefinition = "TEXT")
    private String rawPayload;

    @Column(name = "ip_address", length = 100)
    private String ipAddress;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
