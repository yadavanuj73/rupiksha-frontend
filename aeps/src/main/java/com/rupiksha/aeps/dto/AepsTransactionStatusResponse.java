package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class AepsTransactionStatusResponse {

    @JsonProperty("status_id")
    private Integer statusId;

    private String message;

    @JsonProperty("RRN")
    private String rrn;

    private String txnid;

    @JsonProperty("client_id")
    private String clientId;

}