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

    public static com.rupiksha.aeps.dto.TransactionResult mapToTransactionResult(
            com.rupiksha.aeps.dto.response.AepsKycResponse response,
            com.rupiksha.aeps.dto.TransactionContext context) {
        
        com.rupiksha.aeps.enums.TransactionWorkflowState state = com.rupiksha.aeps.enums.TransactionWorkflowState.FAILED;
        String status = "FAILED";
        
        if (response.getStatusId() != null) {
            if (response.getStatusId() == 1) {
                state = com.rupiksha.aeps.enums.TransactionWorkflowState.SUCCESS;
                status = "SUCCESS";
            } else if (response.getStatusId() == 0 || response.getStatusId() == 2) {
                state = com.rupiksha.aeps.enums.TransactionWorkflowState.PENDING;
                status = "PENDING";
            }
        }
        
        return com.rupiksha.aeps.dto.TransactionResult.builder()
                .transactionId(context.getRequest().getTransactionId())
                .referenceNumber(context.getCorrelationId())
                .providerReference(response.getTxnid() != null ? response.getTxnid() : response.getRefid())
                .status(status)
                .workflowState(state)
                .responseCode(response.getStatusId() != null ? String.valueOf(response.getStatusId()) : "99")
                .responseMessage(response.getMessage())
                .amount(context.getRequest().getAmount())
                .providerName("levin")
                .completedTime(java.time.LocalDateTime.now())
                .build();
    }
}

