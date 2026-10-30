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
@Table(name = "bbps_commission_config_audits")
public class BbpsCommissionConfigAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "config_id")
    private BbpsCommissionConfig config;

    @Column(name = "service_id", nullable = false, length = 64)
    private String serviceId;

    @Column(name = "plan_code", nullable = false, length = 50)
    private String planCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_user_id")
    private User adminUser;

    @Column(name = "admin_username", length = 100)
    private String adminUsername;

    @Column(name = "prev_retailer_percentage", precision = 6, scale = 4)
    private BigDecimal prevRetailerPercentage;

    @Column(name = "prev_distributor_percentage", precision = 6, scale = 4)
    private BigDecimal prevDistributorPercentage;

    @Column(name = "prev_super_distributor_percentage", precision = 6, scale = 4)
    private BigDecimal prevSuperDistributorPercentage;

    @Column(name = "prev_enabled")
    private Boolean prevEnabled;

    @Column(name = "new_retailer_percentage", precision = 6, scale = 4)
    private BigDecimal newRetailerPercentage;

    @Column(name = "new_distributor_percentage", precision = 6, scale = 4)
    private BigDecimal newDistributorPercentage;

    @Column(name = "new_super_distributor_percentage", precision = 6, scale = 4)
    private BigDecimal newSuperDistributorPercentage;

    @Column(name = "new_enabled")
    private Boolean newEnabled;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

