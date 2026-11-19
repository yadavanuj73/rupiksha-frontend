package com.rupiksha.aeps.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayoutOtpSendResponse {
    private boolean success;
    private String message;
    private String challengeId;
    private String payoutIntentId;
    private String maskedMobile;
    private int resendCooldownSeconds;
    private long expiresInSeconds;
    private BigDecimal amount;
    private BigDecimal baseCharge;
    private BigDecimal gstAmount;
    private BigDecimal totalCharges;
    private BigDecimal totalDeduction;
}
