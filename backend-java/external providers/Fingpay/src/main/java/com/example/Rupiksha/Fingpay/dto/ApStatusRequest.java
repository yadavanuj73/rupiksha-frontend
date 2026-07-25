package com.example.Rupiksha.Fingpay.dto;

import lombok.Data;

@Data
public class ApStatusRequest {
    private Long uid;
    private String merchantTranId;
}