package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aeps_2fa_charge_txns",
        uniqueConstraints = @UniqueConstraint(name = "uq_2fa_charge_orig_role_user", columnNames = {"original_2fa_reference", "user_role", "user_id"}))
public class Aeps2faChargeTxn {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "charge_reference", nullable = false, unique = true, length = 64)
    private String chargeReference;

    @Column(name = "original_2fa_reference", nullable = false, length = 128)
    private String original2faReference;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_role", nullable = false, length = 32)
    private String userRole;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id")
    private CommissionPlan plan;

    @Column(name = "plan_code", nullable = false, length = 32)
    private String planCode;

    @Column(name = "configured_charge_amount", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal configuredChargeAmount = BigDecimal.ZERO;

    @Column(name = "amount_charged", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal amountCharged = BigDecimal.ZERO;

    @Column(name = "wallet_opening_balance", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal walletOpeningBalance = BigDecimal.ZERO;

    @Column(name = "wallet_closing_balance", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal walletClosingBalance = BigDecimal.ZERO;

    @Column(name = "outstanding_amount", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal outstandingAmount = BigDecimal.ZERO;

    @Column(name = "settlement_status", nullable = false, length = 32)
    @Builder.Default
    private String settlementStatus = "NONE"; // NONE, UNSETTLED, PARTIALLY_SETTLED, SETTLED

    @Column(name = "provider_transaction_reference", length = 128)
    private String providerTransactionReference;

    @Column(name = "transaction_status", nullable = false, length = 32)
    @Builder.Default
    private String transactionStatus = "SUCCESS"; // SUCCESS, FAILED, PENDING

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

