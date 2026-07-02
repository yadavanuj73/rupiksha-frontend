package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.Data;

@Data
public class MiniStatementEntry {
    private String date;
    private String txnType;
    private String amount;
    private String narration;
}