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
@Table(name = "fingpay_upi_cash_transactions")
public class FingpayUpiCashTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "txn_id")
    private Txn txn;

    @Column(name = "partner_request_id", nullable = false, unique = true, length = 100)
    private String partnerRequestId;

    @Column(name = "fp_transaction_id", length = 100)
    private String fpTransactionId;

    @Column(name = "bc_login_id", nullable = false, length = 100)
    private String bcLoginId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "transaction_type", length = 50)
    private String transactionType = "UPICW";

    @Column(name = "provider_status", length = 50)
    private String providerStatus; // "SUCCESS", "FAILED", "PENDING"

    @Column(name = "internal_status", nullable = false, length = 50)
    private String internalStatus; // "INITIATED", "QR_GENERATED", "PENDING", "SUCCESS", "FAILED", "EXPIRED"

    @Column(name = "intent_link", columnDefinition = "TEXT")
    private String intentLink;

    @Column(name = "vpa", length = 120)
    private String vpa;

    @Column(name = "bank_rrn", length = 100)
    private String bankRrn;

    @Column(name = "payer_name", length = 150)
    private String payerName;

    @Column(name = "payer_vpa", length = 150)
    private String payerVpa;

    @Column(name = "payer_amount", precision = 15, scale = 2)
    private BigDecimal payerAmount;

    @Column(name = "qr_expiry_date")
    private Instant qrExpiryDate;

    @Column(name = "qr_expiry_in")
    private Integer qrExpiryIn;

    @Column(name = "qr_expiry_note", length = 500)
    private String qrExpiryNote;

    @Column(name = "status_check_attempts")
    private Integer statusCheckAttempts = 3;

    @Column(name = "status_check_gap")
    private Integer statusCheckGap = 30;

    @Column(name = "status_check_start_in")
    private Integer statusCheckStartIn = 60;

    @Column(name = "response_code", length = 50)
    private String responseCode;

    @Column(name = "response_message", length = 500)
    private String responseMessage;

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "bc_latitude", precision = 10, scale = 6)
    private BigDecimal bcLatitude;

    @Column(name = "bc_longitude", precision = 10, scale = 6)
    private BigDecimal bcLongitude;

    @Column(name = "wallet_entry_id")
    private UUID walletEntryId;

    @Column(nullable = false)
    private Boolean reconciled = false;

    @Column(name = "recon_reference_id", length = 100)
    private String reconReferenceId;

    @Column(name = "recon_response_code", length = 50)
    private String reconResponseCode;

    @Column(name = "recon_message", length = 255)
    private String reconMessage;

    @Column(name = "raw_initiate_response", columnDefinition = "TEXT")
    private String rawInitiateResponse;

    @Column(name = "raw_callback_payload", columnDefinition = "TEXT")
    private String rawCallbackPayload;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();
}
