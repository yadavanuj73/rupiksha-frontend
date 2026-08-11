package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.Map;

public class ProviderTxnDtos {
    public record RechargeRequest(
            @NotBlank String userId,
            @NotBlank String mobile,
            @NotBlank String operator,
            @NotNull @DecimalMin("1.00") BigDecimal amount,
            String idempotencyKey
    ) {}

    public record TransferRequest(
            @NotBlank String userId,
            @NotBlank String beneficiaryName,
            @NotBlank String accountNumber,
            @NotBlank String ifsc,
            @NotNull @DecimalMin("1.00") BigDecimal amount,
            String idempotencyKey
    ) {}

    public record TxnResponse(
            boolean success,
            String txnId,
            String message,
            String status,
            String merchantRefNo,
            String mobileNo,
            java.math.BigDecimal amount,
            String operatorTxnId,
            String orderNo,
            java.math.BigDecimal openingBalance,
            java.math.BigDecimal closingBalance,
            java.math.BigDecimal newBalance,
            Map<String, Object> raw
    ) {
        public TxnResponse(boolean success, String txnId, String message, Map<String, Object> raw) {
            this(success, txnId, message, null, null, null, null, null, null, null, null, null, raw);
        }
    }
}

