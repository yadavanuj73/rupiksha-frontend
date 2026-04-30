package com.rupiksha.aeps.dto;

import lombok.Data;

@Data
public class AepsKycOtpVerifyRequest {

    private String verifyKycOtp;
    private String email;
    private String contactNumber;
    private String kycRefId;
    private String clientRefId;
    private String aepsAgentId;
    private String merchantId;

}