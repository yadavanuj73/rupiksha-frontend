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
@Table(name = "aeps_2fa_charge_config_audits")
public class Aeps2faChargeConfigAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "config_id", nullable = false)
    private Aeps2faChargeConfig config;

    @Column(name = "plan_id", nullable = false)
    private UUID planId;

    @Column(name = "plan_code", nullable = false, length = 32)
    private String planCode;

    @Column(name = "admin_user_id")
    private UUID adminUserId;

    @Column(name = "admin_username", nullable = false, length = 64)
    private String adminUsername;

    @Column(name = "prev_retailer_charge", precision = 10, scale = 2)
    private BigDecimal prevRetailerCharge;

    @Column(name = "prev_distributor_charge", precision = 10, scale = 2)
    private BigDecimal prevDistributorCharge;

    @Column(name = "prev_super_distributor_charge", precision = 10, scale = 2)
    private BigDecimal prevSuperDistributorCharge;

    @Column(name = "prev_enabled")
    private Boolean prevEnabled;

    @Column(name = "new_retailer_charge", nullable = false, precision = 10, scale = 2)
    private BigDecimal newRetailerCharge;

    @Column(name = "new_distributor_charge", nullable = false, precision = 10, scale = 2)
    private BigDecimal newDistributorCharge;

    @Column(name = "new_super_distributor_charge", nullable = false, precision = 10, scale = 2)
    private BigDecimal newSuperDistributorCharge;

    @Column(name = "new_enabled", nullable = false)
    private Boolean newEnabled;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

