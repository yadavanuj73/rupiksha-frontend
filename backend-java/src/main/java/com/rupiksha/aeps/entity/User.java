package com.rupiksha.aeps.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity(name = "AepsUser")
@Data
@Table(name = "aeps_users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String email;
    private String username;

    @Column(unique = true)
    private String mobile;

    @Transient
    private String dob;

    private LocalDateTime createdAt;
    
    // AEPS related fields
    @Column(name = "aeps_agent_id", length = 80)
    private String aepsAgentId;

    @Column(name = "aeps_merchant_id", length = 80)
    private String aepsMerchantId;

    @Column(name = "aeps_onboarded")
    private Boolean aepsOnboarded;

    @Column(name = "aeps_kyc_done")
    private Boolean aepsKycDone;

    @Column(name = "aeps_kyc_refid", length = 255)
    private String aepsKycRefId;

    @Column(name = "aeps_kyc_txnid", length = 255)
    private String aepsKycTxnId;

    @Column(name = "aeps_kyc_completed_at")
    private LocalDateTime aepsKycCompletedAt;

    @Column(name = "aeps_2fa_session_id", length = 255)
    private String aeps2faSessionId;

    @Column(name = "aeps_2fa_authenticated_at")
    private LocalDateTime aeps2faAuthenticatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
