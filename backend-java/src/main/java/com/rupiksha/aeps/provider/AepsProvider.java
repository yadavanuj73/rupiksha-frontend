package com.rupiksha.aeps.provider;

import com.rupiksha.aeps.dto.request.OnboardingRequest;
import com.rupiksha.aeps.dto.request.AepsKycRequest;
import com.rupiksha.aeps.dto.request.AepsOtpVerifyRequest;
import com.rupiksha.aeps.dto.request.AepsDailyAuthRequest;
import com.rupiksha.aeps.dto.response.OnboardingResponse;
import com.rupiksha.aeps.dto.response.ProviderKycResult;

/**
 * Interface representing an AEPS service provider.
 * Specific partner API integrations (e.g. Levin) should implement this interface.
 */
public interface AepsProvider {

    /**
     * Gets the unique registration name of the provider implementation (e.g. "levin").
     */
    String getProviderName();

    /**
     * Validates whether provider is active and credentials are correct.
     */
    boolean testConnection();

    /**
     * Executes merchant onboarding with the partner API.
     */
    OnboardingResponse onboard(OnboardingRequest request);

    /**
     * Executes merchant biometric KYC submission with the partner API.
     */
    ProviderKycResult kyc(AepsKycRequest request);

    /**
     * Executes merchant OTP verification with the partner API.
     */
    ProviderKycResult verifyOtp(AepsOtpVerifyRequest request);

    /**
     * Executes merchant Daily 2FA authentication session with the partner API.
     */
    ProviderKycResult dailyAuthenticate(AepsDailyAuthRequest request);
}
