package com.rupiksha.aeps.provider.mapper;

import com.rupiksha.aeps.dto.response.AepsKycResponse;
import com.rupiksha.aeps.dto.response.AepsWorkflowState;
import com.rupiksha.aeps.dto.response.ProviderKycResult;

public class LevinResponseMapper {

    public static ProviderKycResult mapToKycResult(AepsKycResponse response) {
        AepsWorkflowState state = AepsWorkflowState.UNKNOWN;
        
        if (response.getStatusId() != null) {
            if (response.getStatusId() == 1) {
                state = AepsWorkflowState.READY_FOR_DAILY_2FA;
            } else if (response.getStatusId() == 19) {
                state = AepsWorkflowState.OTP_VERIFICATION_REQUIRED;
            } else {
                state = AepsWorkflowState.FAILED;
            }
        }

        return ProviderKycResult.builder()
                .workflowState(state)
                .message(response.getMessage())
                .providerReference(response.getRefid())
                .providerTxnId(response.getTxnid())
                .build();
    }

    public static ProviderKycResult mapToOtpVerifyResult(AepsKycResponse response) {
        AepsWorkflowState state = AepsWorkflowState.UNKNOWN;
        
        if (response.getStatusId() != null) {
            if (response.getStatusId() == 1) {
                state = AepsWorkflowState.READY_FOR_DAILY_2FA;
            } else {
                state = AepsWorkflowState.FAILED;
            }
        }

        return ProviderKycResult.builder()
                .workflowState(state)
                .message(response.getMessage())
                .providerReference(response.getRefid())
                .providerTxnId(response.getTxnid())
                .build();
    }

    public static ProviderKycResult mapToDailyAuthResult(AepsKycResponse response) {
        AepsWorkflowState state = AepsWorkflowState.UNKNOWN;
        
        if (response.getStatusId() != null) {
            if (response.getStatusId() == 1) {
                state = AepsWorkflowState.READY_FOR_TRANSACTIONS;
            } else {
                state = AepsWorkflowState.FAILED;
            }
        }

        return ProviderKycResult.builder()
                .workflowState(state)
                .message(response.getMessage())
                .providerReference(response.getRefid())
                .providerTxnId(response.getTxnid())
                .build();
    }
}
