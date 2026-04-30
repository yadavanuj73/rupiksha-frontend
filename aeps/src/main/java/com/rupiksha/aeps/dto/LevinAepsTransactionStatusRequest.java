package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class LevinAepsTransactionStatusRequest {

    @JsonProperty("api_token")
    private String apiToken;

    @JsonProperty("user_id")
    private String userId;

    @JsonProperty("client_id")
    private String clientId;

}