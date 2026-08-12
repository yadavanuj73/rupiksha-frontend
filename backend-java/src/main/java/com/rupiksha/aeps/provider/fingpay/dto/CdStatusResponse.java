package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class CdStatusResponse {
    private Boolean apiStatus;
    private String apiStatusMessage;

    private String fingpayTransactionId;
    private String stan;
    private String bankRRN;
    private String transactionTime;
    private String merchantTranId;
    private String transactionStatus;
    private Double transactionAmount;
    private String transactionStatusCode;
    private String transactionStatusMessage;
    private String remarks;
    private Double balanceAmount;
    private String aadhaarNumber;
    private String latitude;
    private String longitude;
    private String mobileNumber;
    private String deviceIMEI;
    private String bankName;
}
