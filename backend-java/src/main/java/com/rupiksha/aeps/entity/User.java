package com.rupiksha.aeps.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
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
    private String aepsKycRefId;
    private String aepsKycTxnId;
    private LocalDateTime aepsKycCompletedAt;
    private String aeps2faSessionId;
    private LocalDateTime aeps2faAuthenticatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
