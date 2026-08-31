package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "commission_transactions")
public class CommissionTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "commission_reference", nullable = false, unique = true, length = 64)
    private String commissionReference;

    @Column(name = "original_transaction_id", nullable = false, length = 120)
    private String originalTransactionId;

    @Column(name = "service_type", nullable = false, length = 40)
    private String serviceType; // e.g. "AEPS_1"

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id")
    private CommissionPlan plan;

    @Column(name = "plan_code", length = 50)
    private String planCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "slab_id")
    private CommissionSlab slab;

    @Column(name = "slab_min", nullable = false, precision = 18, scale = 2)
    private BigDecimal slabMin;

    @Column(name = "slab_max", nullable = false, precision = 18, scale = 2)
    private BigDecimal slabMax;

    @Column(name = "transaction_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal transactionAmount;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "beneficiary_user_id", nullable = false)
    private User beneficiaryUser;

    @Column(name = "beneficiary_role", nullable = false, length = 40)
    private String beneficiaryRole; // "RETAILER", "DISTRIBUTOR", "SUPER_DISTRIBUTOR"

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "retailer_user_id", nullable = false)
    private User retailerUser;

    @Column(name = "commission_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal commissionAmount;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "SUCCESS"; // "SUCCESS", "FAILED", "NOT_CONFIGURED"

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_entry_id")
    private WalletEntry walletEntry;

    @Column(length = 255)
    private String remarks;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
