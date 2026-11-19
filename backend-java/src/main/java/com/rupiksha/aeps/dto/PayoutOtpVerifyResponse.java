package com.rupiksha.aeps.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayoutOtpVerifyResponse {
    private boolean success;
    private String message;
    private String authorizationReference;
    private String payoutIntentId;
    private long expiresInSeconds;
}
