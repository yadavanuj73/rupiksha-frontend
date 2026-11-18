package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "sms_delivery_logs")
@Getter
@Setter
@NoArgsConstructor
public class SmsDeliveryLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_sms_id", length = 64)
    private String clientSmsId;

    @Column(name = "provider_message_id", length = 100)
    private String providerMessageId;

    @Column(name = "mobile_masked", length = 20)
    private String mobileMasked;

    @Column(name = "sender_id", length = 20)
    private String senderId;

    @Column(name = "status", length = 32, nullable = false)
    private String status = "ACCEPTED";

    @Column(name = "error_code", length = 50)
    private String errorCode;

    @Column(name = "error_reason", length = 255)
    private String errorReason;

    @Column(name = "delivery_time", length = 100)
    private String deliveryTime;

    @Column(name = "raw_payload", columnDefinition = "TEXT")
    private String rawPayload;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
