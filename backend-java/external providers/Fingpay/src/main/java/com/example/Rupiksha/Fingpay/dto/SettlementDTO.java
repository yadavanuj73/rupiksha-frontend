package com.example.Rupiksha.Fingpay.dto;

import lombok.Data;

@Data
public class SettlementDTO {

    private String companyBankAccountNumber;
    private String bankIfscCode;
    private String companyBankName;
    private String bankAccountName;
}