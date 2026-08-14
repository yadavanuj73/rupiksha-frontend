package com.rupiksha.aeps.provider.fingpay.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FingpayKycStatusUtilTest {

    @Test
    void shouldDetectAlreadyCompletedBankEkycMessage() {
        String message = "You have already completed Bank eKYC. Please proceed with your transactions.";

        assertTrue(FingpayKycStatusUtil.isBankEkycAlreadyCompleted(message));
        assertFalse(FingpayKycStatusUtil.isBankEkycRequired(message));
    }

    @Test
    void shouldDetectBankEkycRequiredMessage() {
        String message = "EKYC Registration completed. Please complete Bank eKYC to enable transactions";

        assertTrue(FingpayKycStatusUtil.isBankEkycRequired(message));
        assertFalse(FingpayKycStatusUtil.isBankEkycAlreadyCompleted(message));
    }

    @Test
    void shouldNotTreatGenericFailureAsBankEkycStatus() {
        assertFalse(FingpayKycStatusUtil.isBankEkycRequired("Merchant is Inactive or Invalid Details"));
        assertFalse(FingpayKycStatusUtil.isBankEkycAlreadyCompleted("OTP verification failed"));
    }
}
