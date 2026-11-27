package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public class EmployeeDtos {

    public record ScopeItem(
            String scopeType,
            String stateName,
            String zoneName,
            String cityOrDistrict
    ) {}

    public record EmployeeLoginRequest(
            @NotBlank String identifier,
            @NotBlank String password
    ) {}

    public record EmployeeRefreshRequest(
            @NotBlank String refreshToken
    ) {}

    public record EmployeeProfileView(
            String id,
            String employeeCode,
            String username,
            String fullName,
            String mobile,
            String email,
            String address,
            String role,
            String roleDisplayName,
            String status,
            String reportingManagerId,
            String reportingManagerName,
            String reportingManagerCode,
            String territoryLabel,
            List<ScopeItem> scopes,
            List<String> permissions,
            Instant lastLoginAt,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record EmployeeAuthResponse(
            String accessToken,
            String refreshToken,
            String tokenType,
            long expiresInSeconds,
            EmployeeProfileView employee
    ) {}

    public record CreateEmployeeRequest(
            @NotBlank @Size(min = 3, max = 40) String employeeCode,
            @NotBlank @Size(min = 3, max = 80) String username,
            @NotBlank @Size(min = 2, max = 120) String fullName,
            @NotBlank @Size(min = 10, max = 20) String mobile,
            @NotBlank @Email String email,
            String address,
            @NotBlank String role,
            @NotBlank @Size(min = 6, max = 100) String initialPassword,
            String reportingManagerId,
            String territoryLabel,
            List<ScopeItem> scopes,
            List<String> permissions,
            String status
    ) {}

    public record UpdateEmployeeRequest(
            @Size(min = 2, max = 120) String fullName,
            @Size(min = 10, max = 20) String mobile,
            @Email String email,
            String address,
            String reportingManagerId,
            String territoryLabel,
            List<ScopeItem> scopes,
            List<String> permissions
    ) {}

    public record UpdateStatusRequest(
            @NotBlank String status,
            String reason
    ) {}

    public record ResetPasswordRequest(
            @NotBlank @Size(min = 6, max = 100) String newPassword
    ) {}

    public record UpdatePermissionsRequest(
            List<String> permissions
    ) {}

    public record OnboardMemberRequest(
            @NotBlank @Size(min = 3, max = 80) String username,
            @NotBlank @Size(min = 10, max = 20) String mobile,
            @NotBlank @Email String email,
            @NotBlank String fullName,
            @NotBlank @Size(min = 6, max = 100) String password,
            String pin,
            @NotBlank String role,
            String state,
            String city,
            String district,
            String zoneName,
            String pincode,
            String address,
            String businessName,
            String parentUserId,
            String firstName,
            String lastName,
            String dob,
            String fatherName,
            String gender,
            String businessType,
            String gstNumber,
            String shopLandmark,
            String shopAddress,
            String shopState,
            String shopDistrict,
            String shopCity,
            String shopPincode,
            String permanentAddress,
            String permState,
            String permDistrict,
            String permCity,
            String permPincode,
            String aadhaarNumber,
            String panNumber,
            String bankAccountHolder,
            String bankName,
            String bankAccountNumber,
            String bankIfsc,
            String bankBranch,
            String photoUrl,
            String aadhaarPhotoUrl,
            String aadhaarBackPhotoUrl,
            String panPhotoUrl,
            String shopPhotoUrl,
            String bankPassbookUrl,
            String liveSelfieUrl
    ) {}

    public record ServiceBreakdownItem(
            String service,
            long totalCount,
            long successCount,
            long failedCount,
            long pendingCount,
            BigDecimal totalVolume
    ) {}

    public record DateTrendPoint(
            String date,
            long totalTransactions,
            long successTransactions,
            long failedTransactions,
            long pendingTransactions,
            BigDecimal totalVolume,
            long onboardedUsers
    ) {}

    public record ScopedMemberSummary(
            String id,
            String username,
            String fullName,
            String businessName,
            String mobile,
            String email,
            String role,
            String partyCode,
            String status,
            String kycStatus,
            String stateName,
            String city,
            String zoneName,
            String parentName,
            String parentPartyCode,
            String onboardedByEmployeeId,
            String onboardedByEmployeeCode,
            BigDecimal walletBalance,
            Instant createdAt
    ) {}

    public record ScopedMemberDetail(
            ScopedMemberSummary summary,
            String fatherName,
            String dob,
            String gender,
            String businessType,
            String gstNumber,
            String addressLine1,
            String shopAddress,
            String shopDistrict,
            String shopPincode,
            String permanentAddress,
            String panMasked,
            String aadhaarMasked,
            String bankName,
            String bankIfsc,
            String bankAccountMasked
    ) {}

    public record ScopedTransactionItem(
            String id,
            String referenceNo,
            String serviceType,
            String category,
            BigDecimal amount,
            String status,
            String userId,
            String userName,
            String userPartyCode,
            String userRole,
            String userState,
            String userCity,
            String userZone,
            String targetAccountOrMobile,
            String remarks,
            Instant createdAt
    ) {}

    public record EmployeePerformanceItem(
            String id,
            String employeeCode,
            String username,
            String fullName,
            String mobile,
            String email,
            String role,
            String roleDisplayName,
            String status,
            String reportingManagerId,
            String reportingManagerName,
            String reportingManagerCode,
            String territoryLabel,
            List<ScopeItem> scopes,
            List<String> permissions,
            long directUsersOnboarded,
            long retailersOnboarded,
            long distributorsOnboarded,
            long superDistributorsOnboarded,
            long hierarchyTotalUsers,
            long hierarchyRetailers,
            long hierarchyDistributors,
            long hierarchySuperDistributors,
            long subordinateEmployeesCount,
            long totalTransactions,
            long successTransactions,
            long failedTransactions,
            long pendingTransactions,
            BigDecimal totalVolume,
            Instant lastLoginAt,
            Instant createdAt,
            List<ServiceBreakdownItem> serviceBreakdown,
            List<DateTrendPoint> dailyPerformance
    ) {}

    public record EmployeeDashboardResponse(
            EmployeeProfileView employee,
            boolean hasDashboardAccess,
            long totalUsers,
            long totalRetailers,
            long totalDistributors,
            long totalSuperDistributors,
            long totalSubordinateEmployees,
            long directUsersOnboarded,
            long totalTransactions,
            long successTransactions,
            long failedTransactions,
            long pendingTransactions,
            BigDecimal totalVolume,
            List<ServiceBreakdownItem> serviceBreakdown,
            List<DateTrendPoint> dailyTrend,
            List<ScopedTransactionItem> recentTransactions
    ) {}

    public record EmployeeAuditLogView(
            String id,
            String employeeId,
            String employeeUsername,
            String actorType,
            String actorId,
            String actorUsername,
            String eventType,
            String targetUserId,
            String targetEmployeeId,
            String details,
            String ipAddress,
            String outcome,
            Instant createdAt
    ) {}

    public record PermissionCategoryView(
            String category,
            String categoryLabel,
            List<PermissionItemView> items
    ) {}

    public record PermissionItemView(
            String code,
            String label,
            String description,
            boolean onboardingWrite
    ) {}

    public record ZoneCatalogResponse(
            Map<String, List<String>> zoneToStates,
            List<String> allStates
    ) {}
}
