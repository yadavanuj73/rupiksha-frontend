package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FingpayTxnOtpResponseDTO {
    private boolean status;
    private String message;
    private Long statusCode;
    private String fpTransactionId;
    private String merchantTxnId;
    private String bankRRN;
    private String responseCode;
    private String bankResponseMessage;
    private String transactionTimestamp;
    private Double transactionAmount;
    private String transactionStatus;
    private String transactionType;
}
