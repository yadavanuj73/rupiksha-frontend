package com.example.Rupiksha.Fingpay.dto;

import lombok.Data;

@Data
public class AadhaarPayResponse {
    private String status;
    private String message;
    private String txnId;
    private String fpTxnId;
    private String bankRRN;
    private Double transactionAmount;
    private Double balanceAmount;
    private String maskedAadhaar;
    private String responseCode;
}