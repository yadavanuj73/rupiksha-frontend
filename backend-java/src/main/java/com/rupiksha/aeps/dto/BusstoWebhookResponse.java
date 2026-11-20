package com.rupiksha.aeps.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BusstoWebhookResponse {
    private boolean success;
    private String status; // SUCCESS, DUPLICATE, REJECTED, ERROR
    private String message;
    private String orderId;
    private String providerTxnId;
    private String utr;
}
