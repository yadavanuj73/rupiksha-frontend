package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class WalletDtos {
    public record WalletBalanceResponse(
            String id, // User ID
            String name,
            String username,
            String mobile,
            String role,
            BigDecimal balance,
            BigDecimal lockedAmount,
            BigDecimal availableBalance,
            BigDecimal gst_rate,
            String status
    ) {}

    public record WalletEntryRequest(
            @NotBlank String userId,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            String narration,
            String remark
    ) {
        public String getNarrationOrRemark() {
            if (narration != null && !narration.isBlank()) return narration;
            if (remark != null && !remark.isBlank()) return remark;
            return "No remark";
        }
    }

    public record CommissionRequest(
            @NotBlank String userId,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotNull BigDecimal gstPercentage,
            String narration,
            String remark
    ) {
        public String getNarrationOrRemark() {
            if (narration != null && !narration.isBlank()) return narration;
            if (remark != null && !remark.isBlank()) return remark;
            return "No remark";
        }
    }

    public record WalletStatusUpdateRequest(
            @NotBlank String userId,
            @NotBlank String status,
            @NotBlank String remark
    ) {}

    public record FundRequestCreateRequest(
            @NotBlank String userId,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotBlank String utrNumber,
            @NotBlank String method,
            String remark
    ) {}

    public record FundRequestProcessRequest(
            @NotBlank String requestId,
            String remark
    ) {}

    public record FundRequestResponse(
            String id,
            String userId,
            String username,
            String fullName,
            BigDecimal amount,
            String status,
            String utrNumber,
            String method,
            String remark,
            String adminRemark,
            String approvedByUsername,
            Instant approvedAt,
            Instant createdAt
    ) {}

    public record TaxSummaryResponse(
            BigDecimal total_tds,
            BigDecimal total_gst
    ) {}

    public record WalletHistoryEntryResponse(
            String referenceNumber,
            String status,
            String transactionContext,
            String ledgerType,
            BigDecimal amount,
            BigDecimal openingBalance,
            BigDecimal closingBalance,
            String operatorUsername,
            String targetUsername,
            String serviceName,
            Instant createdAt,
            String narration
    ) {}
}

