package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class MiniStatementRequest {
    private Long uid;
    private String mobile;
    private String aadhar;
    private String lat;
    private String log;
    private Long bankId;
    private String merchantUserName;
    private String merchantPin;
    private String virtualId;
    private String deviceId;
    private String requestRemarks;

    // Biometric — RD service se as-is
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