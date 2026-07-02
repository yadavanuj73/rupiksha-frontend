package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class ValidateOtpRequestDTO {
    private String merchantLoginId;
    private String otp;
    private Integer primaryKeyId;
    private String encodeFPTxnId;
}