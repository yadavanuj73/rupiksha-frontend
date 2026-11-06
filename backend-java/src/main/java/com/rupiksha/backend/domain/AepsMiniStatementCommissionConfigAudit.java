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
@Table(name = "aeps_mini_statement_commission_config_audits")
public class AepsMiniStatementCommissionConfigAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "config_id")
    private AepsMiniStatementCommissionConfig config;

    @Column(name = "service_type", nullable = false, length = 40)
    @Builder.Default
    private String serviceType = "AEPS_1_MINI_STATEMENT";

    @Column(name = "plan_code", nullable = false, length = 50)
    private String planCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_user_id")
    private User adminUser;

    @Column(name = "admin_username", length = 100)
    private String adminUsername;

    @Column(name = "prev_retailer_commission", precision = 18, scale = 2)
    private BigDecimal prevRetailerCommission;

    @Column(name = "prev_distributor_commission", precision = 18, scale = 2)
    private BigDecimal prevDistributorCommission;

    @Column(name = "prev_super_distributor_commission", precision = 18, scale = 2)
    private BigDecimal prevSuperDistributorCommission;

    @Column(name = "prev_enabled")
    private Boolean prevEnabled;

    @Column(name = "new_retailer_commission", precision = 18, scale = 2)
    private BigDecimal newRetailerCommission;

    @Column(name = "new_distributor_commission", precision = 18, scale = 2)
    private BigDecimal newDistributorCommission;

    @Column(name = "new_super_distributor_commission", precision = 18, scale = 2)
    private BigDecimal newSuperDistributorCommission;

    @Column(name = "new_enabled")
    private Boolean newEnabled;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

