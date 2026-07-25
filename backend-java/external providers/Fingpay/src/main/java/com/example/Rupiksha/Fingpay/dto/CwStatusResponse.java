package com.example.Rupiksha.Fingpay.dto;

import lombok.Data;

@Data
public class CwStatusResponse {
    private boolean apiStatus;
    private String apiStatusMessage;
    private Object data;
    private long apiStatusCode;
}