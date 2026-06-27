package com.rupiksha.aeps.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class KycResponse {
    private boolean success;
    private String workflowState;
    private String message;
    private String providerReference;
    private String provider;
}
