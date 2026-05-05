package com.rupiksha.backend.api.dto;

import com.rupiksha.backend.domain.*;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Data
@Builder
public class MemberDetailResponse {
    private UUID id;
    private String username;
    private String mobile;
    private String email;
    private String fullName;
    private String password; // Only for admin view
    private UserStatus status;
    private KycStatus kycStatus;
    private String aadhaarNumber;
    private String panNumber;
    private String photoUrl;
    private String aadhaarPhotoUrl;
    private String panPhotoUrl;
    private String addressLine1;
    private String city;
    private String stateName;
    private String pincode;
    private String businessName;
    private String partyCode;
    private String addedByUserRef;
    private String addedByName;
    private String addedByRole;
    private String addedByPartyCode;
    private String kycRejectionReason;
    private Instant kycSubmittedAt;
    private Instant kycApprovedAt;
    private Set<RoleName> roles;
    private BigDecimal walletBalance;
    private List<UserServiceDTO> services;
    private Instant createdAt;
    private Instant updatedAt;
    private String lastAepsTxnDate;
    private Integer totalAepsTxnCount;
}
