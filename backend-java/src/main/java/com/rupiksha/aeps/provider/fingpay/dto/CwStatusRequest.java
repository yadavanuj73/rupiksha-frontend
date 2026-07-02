package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class CwStatusRequest {
    private Long uid;
    private String merchantTranId;
}