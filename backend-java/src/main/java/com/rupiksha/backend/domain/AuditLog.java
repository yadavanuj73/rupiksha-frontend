package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "audit_logs")
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "operator_id")
    private User operator;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "target_user_id", nullable = false)
    private User targetUser;

    @Column(name = "old_balance", nullable = false, precision = 18, scale = 2)
    private BigDecimal oldBalance;

    @Column(name = "new_balance", nullable = false, precision = 18, scale = 2)
    private BigDecimal newBalance;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(name = "wallet_type", nullable = false, length = 20)
    private String walletType = "MAIN";

    @Column(name = "ledger_type", nullable = false, length = 30)
    private String ledgerType;

    @Column(name = "reference_number", length = 64)
    private String referenceNumber;

    @Column(name = "transaction_id", length = 64)
    private String transactionId;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(length = 255)
    private String remark;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
