package com.rupiksha.aeps.dto.request;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AepsOtpVerifyRequest {
    private String verifyKycOtp;
    private String email;
    private String contactNumber;
    private String kycRefId;
    private String clientRefId;
    private String aepsAgentId;
    private String merchantId;
}
