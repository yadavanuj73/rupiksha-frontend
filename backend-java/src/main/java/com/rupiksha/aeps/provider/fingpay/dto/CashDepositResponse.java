package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class CashDepositResponse {
    private String status;       // SUCCESS / FAILED / PENDING / ERROR
    private String message;
    private String txnId;        // our merchantTranId
    private String fpTxnId;      // fingpayTransactionId
    private String bankRRN;
    private Double transactionAmount;
    private Double balanceAmount;
    private String maskedAadhaar;
    private String responseCode;
}
