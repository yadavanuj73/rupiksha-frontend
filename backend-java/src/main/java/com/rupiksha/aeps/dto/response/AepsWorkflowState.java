package com.rupiksha.aeps.dto.response;

public enum AepsWorkflowState {
    ONBOARDING_REQUIRED,
    KYC_REQUIRED,
    OTP_VERIFICATION_REQUIRED,
    BANK_EKYC_REQUIRED,
    READY_FOR_DAILY_2FA,
    READY_FOR_TRANSACTIONS,
    RETRY_CAPTURE,
    FAILED,
    UNKNOWN
}
