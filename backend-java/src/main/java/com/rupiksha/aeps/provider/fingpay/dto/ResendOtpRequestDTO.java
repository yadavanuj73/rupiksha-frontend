package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class ResendOtpRequestDTO {
    private String merchantLoginId;
    private Integer primaryKeyId;
    private String encodeFPTxnId;
}