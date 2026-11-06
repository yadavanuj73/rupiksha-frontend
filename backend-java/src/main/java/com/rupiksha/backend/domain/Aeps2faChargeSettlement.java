package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "aeps_2fa_charge_settlements")
public class Aeps2faChargeSettlement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "settlement_reference", nullable = false, unique = true, length = 64)
    private String settlementReference;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "charge_txn_id", nullable = false)
    private Aeps2faChargeTxn chargeTxn;

    @Column(name = "incoming_credit_reference", nullable = false, length = 64)
    private String incomingCreditReference;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "settlement_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal settlementAmount;

    @Column(name = "remaining_outstanding_amount", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal remainingOutstandingAmount = BigDecimal.ZERO;

    @Column(name = "settlement_status", nullable = false, length = 32)
    @Builder.Default
    private String settlementStatus = "SETTLED"; // PARTIALLY_SETTLED, SETTLED

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

