package com.rupiksha.backend.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.*;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class BbpsDtos {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class OperatorInfo {
        private String billerId;
        private String operatorName;
        private String operatorAlias;
        private String category;
        private String billerFetchRequirement; // NOT_SUPPORTED
        private String supportBillValidation;  // OPTIONAL
        private List<InputParamInfo> inputParams;
        private List<String> supportedCircles;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InputParamInfo {
        private String paramName;
        private String dataType;
        private boolean optional;
        private int minLength;
        private int maxLength;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PlanInfo {
        private String planId;
        private String billerId;
        private String categoryType;
        private String categorySubType;
        private BigDecimal amount;
        private String validity;
        private String data;
        private String calls;
        private String sms;
        private String description;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RechargeRequest {
        @NotBlank(message = "Mobile number is required")
        @Pattern(regexp = "^[6-9]\\d{9}$", message = "Invalid 10-digit mobile number")
        private String mobileNumber;

        @NotBlank(message = "Biller/Operator ID is required")
        private String billerId;

        @NotBlank(message = "Telecom circle is required")
        private String circle;

        private String planId;
        private String planDescription;

        @NotNull(message = "Amount is required")
        @DecimalMin(value = "1.00", message = "Amount must be at least ₹1")
        @DecimalMax(value = "50000.00", message = "Amount cannot exceed ₹50,000")
        private BigDecimal amount;

        private String idempotencyKey;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RechargeResponse {
        private boolean success;
        private String transactionId;
        private String merchantRefNo;
        private String providerTxnId;
        private String approvalRefNo;
        private String status;
        private BigDecimal amount;
        private String mobileNumber;
        private String billerName;
        private String circle;
        private String message;
        private BigDecimal walletBalance;
        private Instant createdAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HistoryResponse {
        private List<HistoryItem> content;
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
        private SummaryStats summary;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HistoryItem {
        private String id;
        private String merchantRefNo;
        private String providerTxnId;
        private String approvalRefNo;
        private String category;
        private String billerId;
        private String billerName;
        private String circle;
        private String mobileNumber;
        private String maskedMobileNumber;
        private String planId;
        private String planDescription;
        private BigDecimal amount;
        private String status;
        private String walletDebitRef;
        private String walletRefundRef;
        private String providerMessage;
        private Instant createdAt;
        private Instant completedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SummaryStats {
        private long totalTransactions;
        private long successCount;
        private long pendingCount;
        private long failedCount;
        private long refundedCount;
        private BigDecimal totalVolume;
    }
}
