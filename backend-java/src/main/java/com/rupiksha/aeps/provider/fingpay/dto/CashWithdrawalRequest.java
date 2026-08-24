package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class CashWithdrawalRequest {
    private Long uid;
    private String mobile;
    private String aadhar;
    private String lat;
    private String log;
    private Double amount;
    private Long bankId;
    private String requestRemarks;
    private String deviceId;
    private String virtualId;
    private String txnOtpRequestId;
    private String otp;

    // Biometric — RD service se as-is aata hai
    private String errorCode;
    private String errorInfo;
    private String fCount;
    private String fType;
    private String nmPoints;
    private String qScore;
    private String dpId;
    private String rdsId;
    private String rdsVer;
    private String dc;
    private String mi;
    private String mc;
    private String ci;
    private String sessionKey;
    private String hmac;
    private String pidType;
    private String pidData;
}