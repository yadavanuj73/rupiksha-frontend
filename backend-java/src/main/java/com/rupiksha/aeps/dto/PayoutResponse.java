package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayoutResponse {
    private boolean success;
    private String statusCode;
    private String status; // SUCCESS, PENDING, FAILED, INITIATED
    private String message;
    private String orderId;
    private String transactionId;
    private String utr;
    private BigDecimal amount;
    private String beneficiaryName;
    private String accountNumber;
    private String ifsc;
    private String bankName;
    private String transferMode;
    private String timestamp;
    private Object data;
}
