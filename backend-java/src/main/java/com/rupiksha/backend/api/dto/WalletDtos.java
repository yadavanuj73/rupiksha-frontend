package com.rupiksha.backend.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class WalletDtos {
    @JsonIgnoreProperties(ignoreUnknown = true)
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
            String status,
            String partyCode
    ) {
        public WalletBalanceResponse(
                String id, String name, String username, String mobile, String role,
                BigDecimal balance, BigDecimal lockedAmount, BigDecimal availableBalance,
                BigDecimal gst_rate, String status
        ) {
            this(id, name, username, mobile, role, balance, lockedAmount, availableBalance, gst_rate, status, null);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record WalletEntryRequest(
            @NotBlank String userId,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            String narration,
            String remark,
            String reason,
            String channel,
            String referenceNo,
            String category,
            String pin
    ) {
        public WalletEntryRequest(String userId, BigDecimal amount, String narration) {
            this(userId, amount, narration, null, null, null, null, null, null);
        }

        public WalletEntryRequest(String userId, BigDecimal amount, String narration, String remark) {
            this(userId, amount, narration, remark, null, null, null, null, null);
        }

        public WalletEntryRequest(String userId, BigDecimal amount, String narration, String remark, String reason, String channel, String referenceNo, String category) {
            this(userId, amount, narration, remark, reason, channel, referenceNo, category, null);
        }

        public String getNarrationOrRemark() {
            if (narration != null && !narration.isBlank()) return narration;
            if (remark != null && !remark.isBlank()) return remark;
            if (reason != null && !reason.isBlank()) return reason;
            return "No remark";
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
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

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record WalletStatusUpdateRequest(
            @NotBlank String userId,
            @NotBlank String status,
            @NotBlank String remark,
            String pin
    ) {
        public WalletStatusUpdateRequest(String userId, String status, String remark) {
            this(userId, status, remark, null);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FundRequestCreateRequest(
            @NotBlank String userId,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotBlank String utrNumber,
            @NotBlank String method,
            String remark
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FundRequestSubmitRequest(
            @NotNull(message = "Bank account ID is required")
            UUID bankAccountId,

            @NotNull(message = "Amount is required")
            @DecimalMin(value = "1.00", message = "Minimum amount is ₹1.00")
            BigDecimal amount,

            @NotBlank(message = "UTR / Reference number is required")
            String utrNumber,

            @NotBlank(message = "Payment mode is required")
            String method,

            @NotBlank(message = "Payment bank is required")
            String paymentBank,

            Instant paymentDateTime,

            String userNote
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FundRequestProcessRequest(
            @NotBlank String requestId,
            String remark,
            String pin
    ) {
        public FundRequestProcessRequest(String requestId, String remark) {
            this(requestId, remark, null);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FundRequestResponse(
            String id,
            String userId,
            String username,
            String fullName,
            String mobile,
            String userRole,
            BigDecimal amount,
            String status,
            String utrNumber,
            String method,
            String paymentBank,
            Instant paymentDateTime,
            String userNote,
            String remark,
            String adminRemark,
            String rejectionReason,
            String bankAccountId,
            String receivingAccountHolder,
            String receivingBankName,
            String receivingAccountMasked,
            String receivingIfsc,
            String receivingBranch,
            boolean hasProof,
            String proofOriginalFilename,
            String approvedByUsername,
            Instant approvedAt,
            Instant createdAt
    ) {
        public FundRequestResponse(
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
        ) {
            this(id, userId, username, fullName, null, null, amount, status, utrNumber, method, null, null, null, remark, adminRemark, null, null, null, null, null, null, null, false, null, approvedByUsername, approvedAt, createdAt);
        }
    }

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

