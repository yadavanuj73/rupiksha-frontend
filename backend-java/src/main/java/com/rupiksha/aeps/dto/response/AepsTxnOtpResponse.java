package com.rupiksha.aeps.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AepsTxnOtpResponse {
    private boolean success;
    private String message;
    private Long statusCode;
    private String fpTransactionId;
    private String merchantTxnId;
    private String transactionTimestamp;
    private Double transactionAmount;
    private String provider;
}
