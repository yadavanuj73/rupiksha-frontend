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

    public static com.rupiksha.aeps.dto.TransactionResult mapMapToTransactionResult(
            java.util.Map<String, Object> map,
            com.rupiksha.aeps.dto.TransactionContext context) {
        
        Integer statusId = null;
        if (map.get("status_id") != null) {
            try {
                statusId = Integer.parseInt(map.get("status_id").toString());
            } catch (Exception ignored) {}
        } else if (map.get("statusId") != null) {
            try {
                statusId = Integer.parseInt(map.get("statusId").toString());
            } catch (Exception ignored) {}
        }

        String statusStr = map.get("status") != null ? map.get("status").toString() : null;
        Boolean isSuccessFlag = null;
        if (map.get("success") instanceof Boolean) {
            isSuccessFlag = (Boolean) map.get("success");
        } else if (map.get("status") instanceof Boolean) {
            isSuccessFlag = (Boolean) map.get("status");
        }
        
        com.rupiksha.aeps.enums.TransactionWorkflowState state = com.rupiksha.aeps.enums.TransactionWorkflowState.FAILED;
        String status = "FAILED";
        
        if (statusId != null) {
            if (statusId == 1) {
                state = com.rupiksha.aeps.enums.TransactionWorkflowState.SUCCESS;
                status = "SUCCESS";
            } else if (statusId == 0 || statusId == 2) {
                state = com.rupiksha.aeps.enums.TransactionWorkflowState.PENDING;
                status = "PENDING";
            } else {
                state = com.rupiksha.aeps.enums.TransactionWorkflowState.FAILED;
                status = "FAILED";
            }
        } else if (Boolean.TRUE.equals(isSuccessFlag) || "SUCCESS".equalsIgnoreCase(statusStr) || "TRUE".equalsIgnoreCase(statusStr) || "APPROVED".equalsIgnoreCase(statusStr)) {
            state = com.rupiksha.aeps.enums.TransactionWorkflowState.SUCCESS;
            status = "SUCCESS";
        } else if ("PENDING".equalsIgnoreCase(statusStr)) {
            state = com.rupiksha.aeps.enums.TransactionWorkflowState.PENDING;
            status = "PENDING";
        }
        
        String message = map.get("message") != null ? map.get("message").toString() :
                (map.get("msg") != null ? map.get("msg").toString() : 
                (map.get("responseMessage") != null ? map.get("responseMessage").toString() :
                (status.equals("SUCCESS") ? "Transaction approved successfully" : "Transaction failed")));

        String txnid = map.get("txnid") != null ? map.get("txnid").toString() :
                (map.get("transaction_id") != null ? map.get("transaction_id").toString() : 
                (map.get("fpTransactionId") != null ? map.get("fpTransactionId").toString() : null));

        String refid = map.get("refid") != null ? map.get("refid").toString() :
                (map.get("ref_id") != null ? map.get("ref_id").toString() :
                (map.get("client_ref_id") != null ? map.get("client_ref_id").toString() : null));

        String bankRrn = map.get("bank_rrn") != null ? map.get("bank_rrn").toString() :
                (map.get("rrn") != null ? map.get("rrn").toString() :
                (map.get("bankRrn") != null ? map.get("bankRrn").toString() :
                (map.get("stan") != null ? map.get("stan").toString() : null)));

        java.math.BigDecimal balance = null;
        Object balObj = map.get("balance") != null ? map.get("balance") :
                (map.get("balance_amount") != null ? map.get("balance_amount") :
                (map.get("account_balance") != null ? map.get("account_balance") : 
                (map.get("available_balance") != null ? map.get("available_balance") : map.get("balanceAmount"))));
        if (balObj != null) {
            try {
                balance = new java.math.BigDecimal(balObj.toString().replaceAll("[^0-9.]", ""));
            } catch (Exception ignored) {}
        }

        // If response has nested "data" object, extract missing fields from it
        if (map.get("data") instanceof java.util.Map) {
            @SuppressWarnings("unchecked")
            java.util.Map<String, Object> dataMap = (java.util.Map<String, Object>) map.get("data");
            if (txnid == null && dataMap.get("txnid") != null) txnid = dataMap.get("txnid").toString();
            if (refid == null && dataMap.get("refid") != null) refid = dataMap.get("refid").toString();
            if (bankRrn == null && dataMap.get("bank_rrn") != null) bankRrn = dataMap.get("bank_rrn").toString();
            if (bankRrn == null && dataMap.get("rrn") != null) bankRrn = dataMap.get("rrn").toString();
            if (balance == null && dataMap.get("balance") != null) {
                try {
                    balance = new java.math.BigDecimal(dataMap.get("balance").toString().replaceAll("[^0-9.]", ""));
                } catch (Exception ignored) {}
            }
        }

        return com.rupiksha.aeps.dto.TransactionResult.builder()
                .transactionId(context.getRequest().getTransactionId())
                .referenceNumber(context.getCorrelationId())
                .providerReference(txnid != null ? txnid : refid)
                .status(status)
                .workflowState(state)
                .responseCode(statusId != null ? String.valueOf(statusId) : (status.equals("SUCCESS") ? "00" : "99"))
                .responseMessage(message)
                .amount(context.getRequest().getAmount())
                .balanceAmount(balance)
                .bankRrn(bankRrn)
                .bankName(context.getRequest().getBankName())
                .maskedAadhaar(context.getRequest().getAdhaarNumber() != null && context.getRequest().getAdhaarNumber().length() >= 4 
                        ? "XXXX-XXXX-" + context.getRequest().getAdhaarNumber().substring(context.getRequest().getAdhaarNumber().length() - 4) 
                        : null)
                .providerName("levin")
                .completedTime(java.time.LocalDateTime.now())
                .build();
    }
}

