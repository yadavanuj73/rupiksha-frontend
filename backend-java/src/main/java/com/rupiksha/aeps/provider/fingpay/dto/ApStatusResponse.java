package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class ApStatusResponse {
    private boolean apiStatus;
    private String apiStatusMessage;
    private Object data;
    private long apiStatusCode;
}