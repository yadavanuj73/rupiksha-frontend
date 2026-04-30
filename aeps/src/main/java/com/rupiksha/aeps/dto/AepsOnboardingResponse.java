package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AepsOnboardingResponse {

    @JsonProperty("status_id")
    private Integer statusId;

    private String message;

    @JsonProperty("agentId")
    private String agentId;

    @JsonProperty("merchant_id")
    private String merchantId;

    private String description;
}