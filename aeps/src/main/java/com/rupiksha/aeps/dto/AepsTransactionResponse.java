package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AepsTransactionResponse {

    @JsonProperty("status_id")
    private Integer statusId;

    private Object message;

    @JsonProperty("RRN")
    private String rrn;

    @JsonProperty("bank_name")
    private String bankName;

    @JsonProperty("AvailableBalance")
    private String availableBalance;

    @JsonProperty("txnid")
    private String txnid;

    @JsonProperty("customer_mobile")
    private String customerMobile;

    private String status;

    @JsonProperty("error_code")
    private String errorCode;

    // Optional / future fields
    private String balance;

    @JsonProperty("timestamp")
    private String timestamp;

    @JsonProperty("transaction_id")
    private String transactionId;

    @JsonProperty("bank_rrn")
    private String bankRrn;

    @JsonProperty("response_code")
    private String responseCode;

    // Helper method
    public boolean isSuccess() {
        return statusId != null && statusId == 1;
    }
}