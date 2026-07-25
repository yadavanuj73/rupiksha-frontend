package com.example.Rupiksha.Fingpay.dto;

import lombok.Data;

@Data
public class ValidateOtpRequestDTO {
    private String merchantLoginId;
    private String otp;
    private Integer primaryKeyId;
    private String encodeFPTxnId;
}