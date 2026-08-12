package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class CdStatusRequest {
    private Long uid;
    private String merchantTranId;
}
