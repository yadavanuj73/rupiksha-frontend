package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class ApStatusRequest {
    private Long uid;
    private String merchantTranId;
}