package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "bbps_transactions")
public class BbpsTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "txn_id")
    private Txn txn;

    @Column(name = "idempotency_key", nullable = false, unique = true, length = 120)
    private String idempotencyKey;

    @Column(name = "request_id", nullable = false, unique = true, length = 40)
    private String requestId;

    @Column(name = "merchant_ref_no", nullable = false, unique = true, length = 64)
    private String merchantRefNo;

    @Column(name = "provider_txn_id", length = 64)
    private String providerTxnId;

    @Column(name = "approval_ref_no", length = 64)
    private String approvalRefNo;

    @Column(nullable = false, length = 50)
    private String category = "Mobile Prepaid";

    @Column(name = "biller_id", nullable = false, length = 32)
    private String billerId;

    @Column(name = "biller_name", nullable = false, length = 100)
    private String billerName;

    @Column(length = 100)
    private String circle;

    @Column(name = "mobile_number", nullable = false, length = 20)
    private String mobileNumber;

    @Column(name = "plan_id", length = 64)
    private String planId;

    @Column(name = "plan_description", columnDefinition = "TEXT")
    private String planDescription;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 20)
    private String status = "INITIATED";

    @Column(name = "wallet_debit_ref", length = 64)
    private String walletDebitRef;

    @Column(name = "wallet_refund_ref", length = 64)
    private String walletRefundRef;

    @Column(name = "provider_response_code", length = 20)
    private String providerResponseCode;

    @Column(name = "provider_message", length = 255)
    private String providerMessage;

    @Column(name = "raw_response", columnDefinition = "TEXT")
    private String rawResponse;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "completed_at")
    private Instant completedAt;
}
