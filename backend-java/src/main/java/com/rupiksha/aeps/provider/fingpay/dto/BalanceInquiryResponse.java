package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class BalanceInquiryResponse {
    private String status;
    private String message;
    private String txnId;
    private String fpTxnId;
    private String bankRRN;
    private Double balanceAmount;
    private String maskedAadhaar;
    private String responseCode;
}