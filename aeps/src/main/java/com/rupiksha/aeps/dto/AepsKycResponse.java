package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AepsKycResponse {

    @JsonProperty("status_id")
    private Integer statusId;

    private String message;

    private String agentId;

    @JsonProperty("merchant_id")
    private String merchantId;

    // 🔥 Add these
    private String refid;

    private Long txnid;
}