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
@Table(name = "fingpay_cms_transactions")
public class FingpayCmsTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "txn_id")
    private Txn txn;

    @Column(name = "fp_transaction_id", nullable = false, unique = true, length = 100)
    private String fpTransactionId;

    @Column(name = "merchant_transaction_id", nullable = false, unique = true, length = 100)
    private String merchantTransactionId;

    @Column(name = "bc_login_id", nullable = false, length = 100)
    private String bcLoginId;

    @Column(name = "type_of_transaction", length = 50)
    private String typeOfTransaction = "CDC";

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "provider_status", nullable = false, length = 10)
    private String providerStatus; // "I", "S", "F"

    @Column(name = "internal_status", nullable = false, length = 30)
    private String internalStatus; // "INITIATED", "SUCCESS", "FAILED", "REVERSED"

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "wallet_entry_id")
    private UUID walletEntryId;

    @Column(name = "refund_wallet_entry_id")
    private UUID refundWalletEntryId;

    @Column(name = "callback_hash", length = 255)
    private String callbackHash;

    @Column(name = "raw_callback_payload", columnDefinition = "TEXT")
    private String rawCallbackPayload;

    @Column(name = "provider_timestamp", length = 50)
    private String providerTimestamp;

    @Column(nullable = false)
    private Boolean reconciled = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();
}
