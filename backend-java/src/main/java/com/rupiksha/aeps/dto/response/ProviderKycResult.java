package com.rupiksha.aeps.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ProviderKycResult {
    private AepsWorkflowState workflowState;
    private String message;
    private String providerReference;
    private String providerTxnId;
}
