package com.rupiksha.aeps.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class AepsKycResponse {
    @JsonProperty("status_id")
    private Integer statusId;

    private String message;
    private String refid;
    private String txnid;
}
