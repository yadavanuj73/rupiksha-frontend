package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CdoResponse {
    private boolean success;
    private String status;
    private String message;
    private Long statusCode;
    
    // Data fields
    private String fingpayTransactionId;
    private Integer cdPkId;
    private String bankRrn;
    private String fpRrn;
    private String stan;
    private String merchantTranId;
    private String responseCode;
    private String responseMessage;
    private String accountNumber;
    private String mobileNumber;
    private String beneficiaryName;
    private String transactionTimestamp;
    private BigDecimal amount;
    private Double balanceAmount;
}
