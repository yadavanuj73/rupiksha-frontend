package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class LevinKycOtpVerifyRequest {

    @JsonProperty("api_token")
    private String apiToken;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("verify_kyc_otp")
    private String verifyKycOtp;

    private String email;
    private String contactNumber;

    @JsonProperty("kyc_ref_id")
    private String kycRefId;

    @JsonProperty("client_ref_id")
    private String clientRefId;

    @JsonProperty("aeps_agent_id")
    private String aepsAgentId;

    @JsonProperty("merchant_id")
    private String merchantId;

}