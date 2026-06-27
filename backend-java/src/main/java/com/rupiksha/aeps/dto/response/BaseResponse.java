package com.rupiksha.aeps.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class BaseResponse {
    private String status;       // e.g. SUCCESS, FAILED, PENDING

    @JsonProperty("status_id")
    private Integer statusId;    // Numeric status code

    private String message;      // Human-readable message
    private String errorCode;    // String error key if failed
    private String correlationId;// Tracks response back to request
}
