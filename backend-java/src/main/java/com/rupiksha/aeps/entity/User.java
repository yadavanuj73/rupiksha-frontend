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

    private String dob;
    private LocalDateTime createdAt;
    
    // AEPS related fields
    private String aepsAgentId;
    private String aepsMerchantId;
    private Boolean aepsOnboarded;
    private Boolean aepsKycDone;
    @Column(name = "aeps_kyc_refid")
    private String aepsKycRefId;

    @Column(name = "aeps_kyc_txnid")
    private String aepsKycTxnId;

    private LocalDateTime aepsKycCompletedAt;

    @Column(name = "aeps_2fa_session_id")
    private String aeps2faSessionId;

    @Column(name = "aeps_2fa_authenticated_at")
    private LocalDateTime aeps2faAuthenticatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
