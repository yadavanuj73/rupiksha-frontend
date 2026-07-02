package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class CwCallbackRequest {
    private String ipaddress;
    private Double amount;
    private String transactionStatus; // "I" = initiated, "S" = success, "F" = failure
    private String merchantRefNo;
    private String fpTransactionId;
    private String aadhaarNumber;
    private String typeOfTransaction;
    private Double latitude;
    private Double longitude;
    private String mobile;
    private String errorMessage;
    private Object bankRRN;
    private String merchantName;
    private String terminalID;
    private String bankName;
    private String requestedTimestamp;
    private String merchantID;
    private String deviceIMEI;
}