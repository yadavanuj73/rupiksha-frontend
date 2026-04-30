package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class AepsKycRequest {

    @JsonProperty("api_token")
    private String apiToken;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("aadhar_number")
    private String aadharNumber;

    @JsonProperty("aeps_agent_id")
    private String aepsAgentId;

    @JsonProperty("merchant_id")
    private String merchantId;

    @JsonProperty("RdpiData")   // 🔥 IMPORTANT
    private String rdpiData;

    private String biometricType;
    private String mobile;

    private String ad1;
    private String ad2;
    private String ad3;
    private String ad4;
}