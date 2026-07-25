package com.example.Rupiksha.Fingpay.dto;

import lombok.Data;

@Data
public class ResendOtpRequestDTO {
    private String merchantLoginId;
    private Integer primaryKeyId;
    private String encodeFPTxnId;
}