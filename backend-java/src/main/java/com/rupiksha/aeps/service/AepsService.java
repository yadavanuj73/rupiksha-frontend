package com.rupiksha.aeps.service;

import com.rupiksha.aeps.dto.request.BankEkycRequest;
import com.rupiksha.aeps.dto.request.OnboardingRequest;
import com.rupiksha.aeps.dto.request.KycRequest;
import com.rupiksha.aeps.dto.request.OtpVerifyRequest;
import com.rupiksha.aeps.dto.request.DailyAuthRequest;
import com.rupiksha.aeps.dto.response.OnboardingResponse;
import com.rupiksha.aeps.dto.response.KycResponse;
import com.rupiksha.aeps.dto.response.StatusResponse;

/**
 * Service interface for managing general AEPS operations.
 */
public interface AepsService {

    /**
     * Fetch the agent's enrollment status.
     */
    StatusResponse getAgentStatus(String mobile, String provider);

    /**
     * Test the connection of the configured active provider.
     */
    boolean testActiveProvider();

    /**
     * Executes merchant onboarding using the active provider strategy.
     */
    OnboardingResponse onboard(OnboardingRequest request);

    /**
     * Executes merchant biometric KYC submission using the active provider strategy.
     */
    KycResponse kyc(KycRequest request, String mobile);

    /**
     * Executes merchant OTP verification using the active provider strategy.
     */
    KycResponse verifyOtp(OtpVerifyRequest request, String mobile);

    /**
     * Executes merchant Daily 2FA authentication session using the active provider strategy.
     */
    KycResponse dailyAuthenticate(DailyAuthRequest request, String mobile);

    /**
     * Executes the mandatory Bank eKYC biometric submission step.
     * Called when Fingpay returns FP097 (BANK_EKYC_REQUIRED).
     * Uses the same biometric API as regular eKYC but marks the result as BeKYC.
     */
    KycResponse completeBankEkyc(BankEkycRequest request, String mobile);

    /**
     * Checks the eKYC or Bank eKYC (BeKYC) status from Fingpay.
     *
     * @param mobile    Merchant's registered mobile number
     * @param kycType   "EKYC" for onboarding KYC, "BeKYC" for bank eKYC
     */
    KycResponse checkEkycStatus(String mobile, String kycType);
}
