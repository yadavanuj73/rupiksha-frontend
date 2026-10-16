package com.rupiksha.backend.integration.bbps.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

public class BillAvenueDtos {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class BillPayRequest {
        private String billerAdhoc;
        private String agentId;
        private AgentDeviceInfo agentDeviceInfo;
        private CustomerInfo customerInfo;
        private String billerId;
        private InputParams inputParams;
        private AmountInfo amountInfo;
        private PaymentMethod paymentMethod;
        private PaymentInfo paymentInfo;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AgentDeviceInfo {
        private String initChannel;
        private String ip;
        private String mac;
        private String app;
        private String imei;
        private String os;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CustomerInfo {
        private String customerMobile;
        private String customerEmail;
        private String customerPan;
        private String customerAdhaar;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InputParams {
        private List<InputParam> input;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InputParam {
        private String paramName;
        private String paramValue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AmountInfo {
        private String amount; // in paise
        private String currency; // "356"
        private String custConvFee; // "0"
        private String CCF1;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PaymentMethod {
        private String paymentMode; // "Wallet"
        private String quickPay; // "Y"
        private String splitPay; // "N"
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PaymentInfo {
        private List<InfoItem> info;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InfoItem {
        private String infoName;
        private String infoValue;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class BillPayResponse {
        private String responseCode;
        private String responseReason;
        private String txnRefId;
        private String approvalRefNumber;
        private String txnRespType;
        private String respAmount; // in paise
        private String respBillNumber;
        private String respCustomerName;
        private String complianceCode;
        private String complianceReason;
        private String message;
        private String errorMessage;
        private String requestId;
        private List<ErrorInfo> errorInfo;

        public boolean isSuccess() {
            return "000".equals(responseCode) &&
                    (responseReason == null || responseReason.equalsIgnoreCase("Successful") || responseReason.equalsIgnoreCase("SUCCESS"));
        }

        public String getErrorMessage() {
            if (complianceReason != null && !complianceReason.isBlank()) {
                return complianceReason + (complianceCode != null && !complianceCode.isBlank() ? " (" + complianceCode + ")" : "");
            }
            if (errorMessage != null && !errorMessage.isBlank()) {
                return errorMessage;
            }
            if (message != null && !message.isBlank()) {
                return message;
            }
            if (errorInfo != null && !errorInfo.isEmpty()) {
                ErrorInfo first = errorInfo.get(0);
                if (first.getErrorMessage() != null && !first.getErrorMessage().isBlank()) {
                    return first.getErrorMessage() + (first.getErrorCode() != null ? " (" + first.getErrorCode() + ")" : "");
                }
            }
            if (responseReason != null && !responseReason.isBlank() && !responseReason.equalsIgnoreCase("FAILURE")) {
                return responseReason;
            }
            if ("202".equals(responseCode)) {
                return "BillAvenue rejected request (Code 202: Invalid parameter combination or unsupported payment channel/mode for operator)";
            }
            if ("205".equals(responseCode)) {
                return "BillAvenue rejected request (Code 205: Duplicate transaction or unmapped request/biller ID)";
            }
            return responseReason != null ? responseReason : "Failed with code: " + responseCode;
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ErrorInfo {
        private String errorCode;
        private String errorMessage;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TransactionStatusResponse {
        private String responseCode;
        private String responseReason;
        private String statusRequestId;
        private List<TxnStatusItem> txnList;
        private List<ErrorInfo> errorInfo;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TxnStatusItem {
        private String agentId;
        private String amount;
        private String billerId;
        private String txnDate;
        private String txnReferenceId;
        private String txnStatus; // "SUCCESS", "FAILURE", "PENDING"
        private String mobile;
        private String approvalRefNumber;
        private String txnRespType;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PlanPullResponse {
        private String responseCode;
        private List<PlanDetail> planDetails;
        private List<ErrorInfo> errorInfo;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PlanDetail {
        private String planId;
        private String billerId;
        private String categoryType;
        private String categorySubType;
        private Double amountInRupees;
        private String planDesc;
        private String effectiveFrom;
        private String effectiveTo;
        private String status;
        private PlanAddnlInfo planAddnlInfo;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PlanAddnlInfo {
        private List<ParamTag> paramTag;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ParamTag {
        private String paramName;
        private String paramValue;
    }
}
