package com.example.Rupiksha.Fingpay.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class BiometricRequestDTO {
    private String merchantLoginId;
    private Integer primaryKeyId;
    private String encodeFPTxnId;
    private String requestRemarks;
    private CardnumberORUID cardnumberORUID;
    private CaptureResponse captureResponse;

    @Data
    public static class CardnumberORUID {
        private String adhaarNumber;
        private String indicatorforUID;
        private String nationalBankIdentificationNumber;
    }

    @Data
    public static class CaptureResponse {
        private String errCode;
        private String errInfo;
        private String fCount;
        private String fType;
        private String iCount;
        private String iType;
        private String pCount;
        private String pType;
        private String nmPoints;
        private String qScore;
        private String dpID;
        private String rdsID;
        private String rdsVer;
        private String dc;
        private String mi;
        private String mc;
        private String ci;
        private String sessionKey;
        private String hmac;
        @JsonProperty("PidDatatype")
        private String PidDatatype;
        @JsonProperty("Piddata")
        private String Piddata;
    }
}