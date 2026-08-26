package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class BankVerificationResponse {
    private boolean success;
    private String statusCode;
    private String status;
    private String message;
    private String verificationId;
    private String nameAtBank;
    private String acValidationStatus;
    private String custAcctNo;
    private String custIfsc;
    private String bankCode;
    private String utr;
    private String methodUsed;
}
