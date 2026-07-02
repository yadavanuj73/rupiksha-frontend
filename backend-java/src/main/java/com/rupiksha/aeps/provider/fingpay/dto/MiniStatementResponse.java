package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;
import java.util.List;

@Data
public class MiniStatementResponse {
    private String status;
    private String message;
    private String txnId;
    private String fpTxnId;
    private String bankRRN;
    private Double balanceAmount;
    private String maskedAadhaar;
    private List<MiniStatementEntry> miniStatement;
}