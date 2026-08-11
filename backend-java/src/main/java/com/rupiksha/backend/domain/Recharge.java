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
@Table(name = "recharges")
public class Recharge {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "merchant_ref_no", nullable = false, unique = true, length = 14)
    private String merchantRefNo;

    @Column(name = "mobile_no", nullable = false, length = 20)
    private String mobileNo;

    @Column(name = "operator_code", nullable = false, length = 10)
    private String operatorCode;

    @Column(name = "service_type", nullable = false, length = 10)
    private String serviceType = "MR";

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TransactionStatus status = TransactionStatus.INITIATED;

    @Column(length = 255)
    private String description;

    @Column(name = "operator_txn_id", length = 120)
    private String operatorTxnId;

    @Column(name = "order_no", length = 120)
    private String orderNo;

    @Column(name = "opening_balance", precision = 18, scale = 2)
    private BigDecimal openingBalance;

    @Column(name = "closing_balance", precision = 18, scale = 2)
    private BigDecimal closingBalance;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "completed_at")
    private Instant completedAt;

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
