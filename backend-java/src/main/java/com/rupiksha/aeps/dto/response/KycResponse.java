package com.rupiksha.aeps.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class KycResponse {
    private boolean success;
    private String workflowState;
    private String message;
    private String providerReference;
    private String providerTxnId;
    private String provider;

    // 2FA Charge & Wallet Settlement Details
    private java.math.BigDecimal chargeAmount;
    private java.math.BigDecimal walletBalance;
    private java.math.BigDecimal outstandingAmount;
    private String chargeReference;
    private String chargeStatus;
}
