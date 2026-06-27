package com.rupiksha.aeps.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class OnboardingResponse extends BaseResponse {

    private String agentId;

    @JsonProperty("merchant_id")
    private String merchantId;
}
