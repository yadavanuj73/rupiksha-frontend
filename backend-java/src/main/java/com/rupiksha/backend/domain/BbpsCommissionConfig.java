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
@Table(name = "bbps_commission_configs")
public class BbpsCommissionConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "service_id", nullable = false, length = 64)
    private String serviceId; // e.g. "loan-repayment"

    @Column(name = "service_name", nullable = false, length = 100)
    private String serviceName; // e.g. "Loan Repayment"

    @Column(name = "commission_model", nullable = false, length = 20)
    @Builder.Default
    private String commissionModel = "PERCENTAGE";

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private CommissionPlan plan;

    @Column(name = "plan_code", nullable = false, length = 50)
    private String planCode;

    @Column(name = "retailer_percentage", nullable = false, precision = 6, scale = 4)
    @Builder.Default
    private BigDecimal retailerPercentage = BigDecimal.ZERO;

    @Column(name = "distributor_percentage", nullable = false, precision = 6, scale = 4)
    @Builder.Default
    private BigDecimal distributorPercentage = BigDecimal.ZERO;

    @Column(name = "super_distributor_percentage", nullable = false, precision = 6, scale = 4)
    @Builder.Default
    private BigDecimal superDistributorPercentage = BigDecimal.ZERO;

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

    public BigDecimal getTotalPercentage() {
        BigDecimal ret = retailerPercentage != null ? retailerPercentage : BigDecimal.ZERO;
        BigDecimal dist = distributorPercentage != null ? distributorPercentage : BigDecimal.ZERO;
        BigDecimal sd = superDistributorPercentage != null ? superDistributorPercentage : BigDecimal.ZERO;
        return ret.add(dist).add(sd);
    }
}

