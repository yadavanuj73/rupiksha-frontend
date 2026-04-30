package com.rupiksha.aeps.dto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AepsTwoFaResponse {

    @JsonProperty("status_id")
    private Integer statusId;

    private Object message;   // ✅ FIX

    @JsonProperty("RRN")
    private String rrn;

    @JsonProperty("txnid")
    private String txnid;

    @JsonProperty("customer_mobile")
    private String customerMobile;

    @JsonProperty("bank_name")
    private String bankName;

    @JsonProperty("AvailableBalance")
    private String availableBalance;

    @JsonProperty("client_id")
    private String clientId;

    @JsonProperty("aeps_mta_id")
    private String aepsMtaId;

    @JsonProperty("status")
    private String status;

    @JsonProperty("error_code")
    private String errorCode;
}