package com.rupiksha.backend.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class FingpayUpiCashDtos {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InitiateRequest {
        @NotNull(message = "Amount is required")
        @DecimalMin(value = "100.00", message = "Minimum transaction amount is ₹100")
        @DecimalMax(value = "5000.00", message = "Maximum transaction amount is ₹5,000")
        private BigDecimal amount;

        @NotNull(message = "Latitude is required")
        private Double latitude;

        @NotNull(message = "Longitude is required")
        private Double longitude;

        private String remarks;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class InitiateResponse {
        private boolean success;
        private String message;
        private String partnerRequestId;
        private String fpTxnId;
        private String intentLink; // Real provider Base64 QR code image
        private String vpa;
        private BigDecimal amount;
        private String expiryDate;
        private String qrExpiryNote;
        private Integer qrExpiryIn; // Expiry in seconds
        private Integer statusCheckAttempts;
        private Integer statusCheckGap;
        private Integer statusCheckStartIn;
        private String responseCode;
        private String responseMessage;
        private String status; // "QR_GENERATED", "INITIATED"
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class StatusCheckRequest {
        private String partnerRequestId;
        private String fingpayTxnId;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class StatusCheckResponse {
        private boolean success;
        private String status; // "SUCCESS", "FAILED", "PENDING"
        private String message;
        private String partnerRequestId;
        private String fingpayTxnId;
        private String bankRrn;
        private BigDecimal payerAmount;
        private String payerVpa;
        private String payerName;
        private String transactionDate;
        private String responseCode;
        private String responseMessage;
        private boolean walletCredited;
        private BigDecimal walletBalance;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CallbackRequest {
        private String responseCode;
        private String payerAmount;
        private String fingpayTransactionId;
        private String txnStatus; // "SUCCESS", "FAILED", "PENDING"
        private String bankRrn;
        private String payerVpa;
        private String payerName;
        private String transactionDate;
        private String partnerRequestId;
        private String merchantLoginId;
        private String superMerchantId;
        private String responseMessage;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CallbackResponse {
        private boolean status;
        private String message;
        private Integer statusCode; // 10000 for Success, 10001 for Failure
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ThreeWayReconRequest {
        private String fingpayTxnId;
        private String partnerRequestId;
        private String transactionRrn;
        private String responseCode;
        private String transactionDate; // dd-MM-yyyy
        private String serviceType;     // UPICW
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ThreeWayReconResponse {
        private boolean status;
        private String message;
        private String referenceId;
        private String responseCode;
        private String responseMessage;
        private Integer statusCode;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class HistorySummaryResponse {
        private long totalTransactions;
        private BigDecimal totalVolume;
        private long successCount;
        private long failedCount;
        private long pendingCount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TransactionDetailResponse {
        private UUID id;
        private String partnerRequestId;
        private String fpTransactionId;
        private String bcLoginId;
        private BigDecimal amount;
        private String transactionType;
        private String providerStatus;
        private String internalStatus;
        private String bankRrn;
        private String payerName;
        private String payerVpa;
        private BigDecimal payerAmount;
        private String responseCode;
        private String responseMessage;
        private String errorMessage;
        private String remarks;
        private Integer qrExpiryIn;
        private String qrExpiryNote;
        private Boolean reconciled;
        private String reconReferenceId;
        private String reconResponseCode;
        private String reconMessage;
        private Instant createdAt;
        private Instant updatedAt;
    }
}
