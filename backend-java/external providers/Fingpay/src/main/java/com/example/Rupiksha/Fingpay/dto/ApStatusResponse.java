package com.example.Rupiksha.Fingpay.dto;

import lombok.Data;

@Data
public class ApStatusResponse {
    private boolean apiStatus;
    private String apiStatusMessage;
    private Object data;
    private long apiStatusCode;
}