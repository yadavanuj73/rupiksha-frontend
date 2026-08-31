package com.rupiksha.backend.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class CommissionDtos {

    public record CommissionSlabDto(
            UUID id,
            @NotNull(message = "Min amount is required")
            @DecimalMin(value = "0.0", inclusive = true, message = "Min amount cannot be negative")
            BigDecimal minAmount,

            @NotNull(message = "Max amount is required")
            @DecimalMin(value = "0.0", inclusive = true, message = "Max amount cannot be negative")
            BigDecimal maxAmount,

            @NotNull(message = "Retailer commission is required")
            @DecimalMin(value = "0.0", inclusive = true, message = "Retailer commission cannot be negative")
            BigDecimal retailerCommission,

            @NotNull(message = "Distributor commission is required")
            @DecimalMin(value = "0.0", inclusive = true, message = "Distributor commission cannot be negative")
            BigDecimal distributorCommission,

            @NotNull(message = "Super Distributor commission is required")
            @DecimalMin(value = "0.0", inclusive = true, message = "Super Distributor commission cannot be negative")
            BigDecimal superDistributorCommission,

            BigDecimal totalCommission,
            Boolean enabled
    ) {}

    public record CommissionPlanDto(
            UUID id,
            String serviceType,
            String planName,
            String planCode,
            BigDecimal price,
            Boolean isDefault,
            Boolean enabled,
            List<CommissionSlabDto> slabs
    ) {}

    public record UpdateSlabsRequest(
            @NotEmpty(message = "Slabs list cannot be empty")
            @Valid
            List<CommissionSlabDto> slabs
    ) {}

    public record CreatePlanRequest(
            @NotBlank(message = "Service type is required")
            String serviceType,

            @NotBlank(message = "Plan name is required")
            String planName,

            @NotBlank(message = "Plan code is required")
            String planCode,

            @DecimalMin(value = "0.0", inclusive = true, message = "Price cannot be negative")
            BigDecimal price,

            Boolean isDefault,

            @Valid
            List<CommissionSlabDto> slabs
    ) {}

    public record CommissionTransactionDto(
            UUID id,
            String commissionReference,
            String originalTransactionId,
            String serviceType,
            String planCode,
            String slabRange,
            BigDecimal transactionAmount,
            String beneficiaryId,
            String beneficiaryName,
            String beneficiaryUsername,
            String beneficiaryRole,
            String retailerId,
            String retailerName,
            String retailerUsername,
            BigDecimal commissionAmount,
            String status,
            String remarks,
            Instant createdAt
    ) {}

    public record CommissionSummaryDto(
            BigDecimal totalCommission,
            BigDecimal todayCommission,
            BigDecimal thisMonthCommission,
            BigDecimal aeps1Commission,
            String currentPlanName,
            String currentPlanCode
    ) {}

    public record AssignPlanRequest(
            @NotNull(message = "User ID is required")
            UUID userId,

            @NotNull(message = "Plan ID is required")
            UUID planId
    ) {}

    public record UpgradePlanRequest(
            @NotNull(message = "Plan ID is required")
            UUID planId
    ) {}
}
