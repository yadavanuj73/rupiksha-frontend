package com.rupiksha.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "aeps_mini_statement_commission_configs")
public class AepsMiniStatementCommissionConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "service_type", nullable = false, length = 40)
    @Builder.Default
    private String serviceType = "AEPS_1_MINI_STATEMENT";

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private CommissionPlan plan;

    @Column(name = "plan_code", nullable = false, length = 50)
    private String planCode;

    @Column(name = "retailer_commission", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal retailerCommission = BigDecimal.ZERO;

    @Column(name = "distributor_commission", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal distributorCommission = BigDecimal.ZERO;

    @Column(name = "super_distributor_commission", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal superDistributorCommission = BigDecimal.ZERO;

    @Column(nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private User updatedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    public BigDecimal getTotalCommission() {
        BigDecimal ret = retailerCommission != null ? retailerCommission : BigDecimal.ZERO;
        BigDecimal dist = distributorCommission != null ? distributorCommission : BigDecimal.ZERO;
        BigDecimal sd = superDistributorCommission != null ? superDistributorCommission : BigDecimal.ZERO;
        return ret.add(dist).add(sd);
    }
}

