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
@Table(name = "recharge_commission_config_audits")
public class RechargeCommissionConfigAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "config_id")
    private UUID configId;

    @Column(name = "service_type", nullable = false, length = 40)
    private String serviceType;

    @Column(name = "operator_code", nullable = false, length = 20)
    private String operatorCode;

    @Column(name = "plan_code", nullable = false, length = 50)
    private String planCode;

    @Column(name = "admin_user_id")
    private UUID adminUserId;

    @Column(name = "admin_username", length = 100)
    private String adminUsername;

    @Column(name = "prev_commission_mode", length = 20)
    private String prevCommissionMode;

    @Column(name = "prev_retailer_value", precision = 18, scale = 4)
    private BigDecimal prevRetailerValue;

    @Column(name = "prev_distributor_value", precision = 18, scale = 4)
    private BigDecimal prevDistributorValue;

    @Column(name = "prev_super_distributor_value", precision = 18, scale = 4)
    private BigDecimal prevSuperDistributorValue;

    @Column(name = "prev_enabled")
    private Boolean prevEnabled;

    @Column(name = "new_commission_mode", length = 20)
    private String newCommissionMode;

    @Column(name = "new_retailer_value", precision = 18, scale = 4)
    private BigDecimal newRetailerValue;

    @Column(name = "new_distributor_value", precision = 18, scale = 4)
    private BigDecimal newDistributorValue;

    @Column(name = "new_super_distributor_value", precision = 18, scale = 4)
    private BigDecimal newSuperDistributorValue;

    @Column(name = "new_enabled")
    private Boolean newEnabled;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}

