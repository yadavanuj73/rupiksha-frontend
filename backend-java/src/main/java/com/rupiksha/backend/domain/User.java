package com.rupiksha.backend.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 80)
    private String username;

    @Column(nullable = false, unique = true, length = 20)
    private String mobile;

    @Column(nullable = false, unique = true, length = 120)
    private String email;

    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @JsonIgnore
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserStatus status = UserStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "kyc_status", nullable = false, length = 20)
    private KycStatus kycStatus = KycStatus.NOT_SUBMITTED;

    @Column(name = "aadhaar_number", length = 20)
    private String aadhaarNumber;

    @Column(name = "pan_number", length = 20)
    private String panNumber;

    @Column(name = "photo_url", columnDefinition = "text")
    private String photoUrl;

    @Column(name = "aadhaar_photo_url", columnDefinition = "text")
    private String aadhaarPhotoUrl;

    @Column(name = "pan_photo_url", columnDefinition = "text")
    private String panPhotoUrl;

    @Column(name = "address_line1", length = 200)
    private String addressLine1;

    @Column(name = "city", length = 100)
    private String city;

    @Column(name = "state_name", length = 100)
    private String stateName;

    @Column(name = "pincode", length = 10)
    private String pincode;

    @Column(name = "business_name", length = 120)
    private String businessName;

    @Column(name = "party_code", length = 30)
    private String partyCode;

    @Column(name = "aeps_agent_id", length = 80)
    private String aepsAgentId;

    @Column(name = "aeps_merchant_id", length = 80)
    private String aepsMerchantId;

    @Column(name = "aeps_onboarded", nullable = false)
    private Boolean aepsOnboarded = false;

    @Column(name = "aeps_kyc_done", nullable = false)
    private Boolean aepsKycDone = false;

    @Column(name = "added_by_user_ref", length = 64)
    private String addedByUserRef;

    @Column(name = "added_by_name", length = 120)
    private String addedByName;

    @Column(name = "added_by_role", length = 40)
    private String addedByRole;

    @Column(name = "added_by_party_code", length = 80)
    private String addedByPartyCode;

    @Column(name = "first_name", length = 60)
    private String firstName;

    @Column(name = "last_name", length = 60)
    private String lastName;

    @Column(name = "dob", length = 20)
    private String dob;

    @Column(name = "shop_address", length = 300)
    private String shopAddress;

    @Column(name = "permanent_address", length = 300)
    private String permanentAddress;

    @Column(name = "shop_photo_url", columnDefinition = "text")
    private String shopPhotoUrl;

    @Column(name = "bank_passbook_url", columnDefinition = "text")
    private String bankPassbookUrl;

    @Column(name = "kyc_rejection_reason", length = 300)
    private String kycRejectionReason;

    @Column(name = "kyc_submitted_at")
    private Instant kycSubmittedAt;

    @Column(name = "kyc_approved_at")
    private Instant kycApprovedAt;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "user_roles",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }
}

