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
@Table(name = "aeps_2fa_charge_configs")
public class Aeps2faChargeConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "service_type", nullable = false, length = 64)
    @Builder.Default
    private String serviceType = "AEPS_1_2FA_CHARGE";

    @OneToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "plan_id", nullable = false, unique = true)
    private CommissionPlan plan;

    @Column(name = "plan_code", nullable = false, length = 32)
    private String planCode;

    @Column(name = "retailer_charge", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal retailerCharge = BigDecimal.ZERO;

    @Column(name = "distributor_charge", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal distributorCharge = BigDecimal.ZERO;

    @Column(name = "super_distributor_charge", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal superDistributorCharge = BigDecimal.ZERO;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "created_by", length = 64)
    private String createdBy;

    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

