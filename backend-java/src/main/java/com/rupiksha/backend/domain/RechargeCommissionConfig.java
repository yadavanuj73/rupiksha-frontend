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
@Table(name = "recharge_commission_configs")
public class RechargeCommissionConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "service_type", nullable = false, length = 40)
    @Builder.Default
    private String serviceType = "MOBILE_RECHARGE"; // "MOBILE_RECHARGE", "DTH_RECHARGE"

    @Column(name = "operator_code", nullable = false, length = 20)
    private String operatorCode; // e.g. "JRE", "ATL", "BNT", "VDF"

    @Column(name = "operator_name", nullable = false, length = 100)
    private String operatorName; // e.g. "Jio Recharge", "Airtel"

    @Column(name = "commission_mode", nullable = false, length = 20)
    @Builder.Default
    private String commissionMode = "PERCENTAGE"; // "PERCENTAGE" or "FIXED"

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private CommissionPlan plan;

    @Column(name = "plan_code", nullable = false, length = 50)
    private String planCode;

    @Column(name = "retailer_value", nullable = false, precision = 18, scale = 4)
    @Builder.Default
    private BigDecimal retailerValue = BigDecimal.ZERO;

    @Column(name = "distributor_value", nullable = false, precision = 18, scale = 4)
    @Builder.Default
    private BigDecimal distributorValue = BigDecimal.ZERO;

    @Column(name = "super_distributor_value", nullable = false, precision = 18, scale = 4)
    @Builder.Default
    private BigDecimal superDistributorValue = BigDecimal.ZERO;

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

    public BigDecimal getTotalValue() {
        BigDecimal ret = retailerValue != null ? retailerValue : BigDecimal.ZERO;
        BigDecimal dist = distributorValue != null ? distributorValue : BigDecimal.ZERO;
        BigDecimal sd = superDistributorValue != null ? superDistributorValue : BigDecimal.ZERO;
        return ret.add(dist).add(sd);
    }
}

