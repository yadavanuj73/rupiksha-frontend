package com.rupiksha.backend.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
@Table(name = "commission_slabs")
public class CommissionSlab {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @JsonIgnore
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "commission_plan_id", nullable = false)
    private CommissionPlan commissionPlan;

    @Column(name = "min_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal minAmount;

    @Column(name = "max_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal maxAmount;

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

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
