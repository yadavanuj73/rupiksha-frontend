package com.rupiksha.backend.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

public class FingpayCmsDtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LaunchRequest {
        private String latitude;
        private String longitude;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class LaunchResponse {
        private boolean success;
        private String message;
        private String launchUrl;
        private String merchantId;
        private String mobileNumber;
        private String supermerchantId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DebitCallbackRequest {
        private Double amount;
        private String transactionStatus; // I, S, F
        private String fpTransactionId;
        private String merchantTransactionId;
        private String typeOfTransaction; // CDC
        private String bcLoginId;
        private String transactionTimestamp;
        private String errorMessage;
        private String remarks;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class DebitCallbackResponse {
        private String merchantTransactionId;
        private Boolean status;
        private String errorMessage;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class BalanceCheckRequest {
        private List<String> bcLoginIds;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BalanceCheckResponse {
        private Boolean status;
        private String errorMessage;
        private List<BcBalanceItem> bcBalances;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class BcBalanceItem {
        private String bcLoginId;
        private Double balance;
    }
}
