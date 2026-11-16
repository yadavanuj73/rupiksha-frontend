package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

public class UserMappingDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserMappingSearchDto {
        private UUID id;
        private String fullName;
        private String mobile;
        private String partyCode;
        private String address;
        private String currentOwnerName;
        private String currentOwnerPartyCode;
        private String currentOwnerRole;
        private String status;
        private String role;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserMappingRequest {
        @NotNull(message = "Retailer ID is required")
        private UUID retailerId;

        @NotBlank(message = "Target role is required (ADMIN, DISTRIBUTOR, SUPER_DISTRIBUTOR)")
        private String targetRole;

        private UUID targetParentId;

        private String reason;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserMappingResponseDto {
        private UUID mappingId;
        private UUID retailerId;
        private String retailerName;
        private String retailerPartyCode;
        private String retailerMobile;
        private String parentRole;
        private UUID parentId;
        private String parentName;
        private String parentPartyCode;
        private String message;
        private Instant mappedAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserMappingDetailDto {
        private UUID retailerId;
        private String retailerName;
        private String partyCode;
        private String mobile;
        private String address;
        private String status;
        private String currentOwnerRole;
        private UUID currentOwnerId;
        private String currentOwnerName;
        private String currentOwnerPartyCode;
        private String currentOwnerMobile;
        private Instant lastMappedAt;
        private String lastMappedByAdmin;
        private int mappingHistoryCount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserMappingTableItemDto {
        private UUID id;
        private UUID retailerId;
        private String retailerName;
        private String partyCode;
        private String mobile;
        private String address;
        private String mappedUnder;
        private String parentName;
        private String parentPartyCode;
        private Instant mappingDate;
        private String status;
        private boolean active;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserMappingHistoryDto {
        private UUID mappingId;
        private UUID retailerId;
        private String retailerName;
        private String retailerPartyCode;
        private String retailerMobile;
        private UUID previousParentId;
        private String previousParentRole;
        private String previousParentName;
        private String previousParentPartyCode;
        private UUID newParentId;
        private String newParentRole;
        private String newParentName;
        private String newParentPartyCode;
        private String actionType;
        private String mappedByAdminUsername;
        private String reason;
        private String status;
        private Instant createdAt;
    }
}
