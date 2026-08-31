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
@Table(name = "wallet_entries")
public class WalletEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_id", nullable = false)
    private Wallet wallet;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(name = "entry_type", nullable = false, length = 20)
    private String entryType; // CREDIT | DEBIT | etc.

    @Column(name = "reference_id", nullable = false, length = 64)
    private String referenceId;

    @Column(nullable = false, length = 128)
    private String narration;

    @Column(name = "opening_balance", precision = 18, scale = 2)
    private BigDecimal openingBalance;

    @Column(name = "closing_balance", precision = 18, scale = 2)
    private BigDecimal closingBalance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "operator_id")
    private User operator;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(precision = 18, scale = 2)
    private BigDecimal gst = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal tds = BigDecimal.ZERO;

    @Column(name = "platform_charges", precision = 18, scale = 2)
    private BigDecimal platformCharges = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private WalletTransactionStatus status = WalletTransactionStatus.INITIATED;

    @Column(name = "idempotency_key", length = 255, unique = true)
    private String idempotencyKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_context", length = 50)
    private WalletTransactionContext transactionContext;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}

