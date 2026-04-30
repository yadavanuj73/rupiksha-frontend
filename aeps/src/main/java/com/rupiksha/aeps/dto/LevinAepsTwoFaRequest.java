package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LevinAepsTwoFaRequest {

    @JsonProperty("api_token")
    private String apiToken;

    @JsonProperty("mobile_number")
    private String mobileNumber;

    @JsonProperty("aeps_method")
    private String aepsMethod;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("adhar_number")
    private String adharNumber;

    @JsonProperty("client_id")
    private String clientId;

    @JsonProperty("RdPidData")   // 🔥 FIX HERE
    private String rdPidData;

    @JsonProperty("aeps_agent_id")
    private String aepsAgentId;

    @JsonProperty("merchant_id")
    private String merchantId;

    private String latitude;
    private String longitude;

    @JsonProperty("biometricType")
    private String biometricType;

    private String ad1;
    private String ad2;
    private String ad3;
    private String ad4;
}