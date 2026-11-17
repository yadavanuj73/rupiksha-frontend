package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.OtpDtos;

public interface OtpService {
    OtpDtos.OtpResponse sendOtp(OtpDtos.SendOtpRequest request);
    OtpDtos.OtpResponse verifyOtp(OtpDtos.VerifyOtpRequest request);
    OtpDtos.OtpResponse resendOtp(OtpDtos.SendOtpRequest request);

    /**
     * Atomically verifies and consumes a registration OTP verification.
     * Prevents OTP reuse and replay attacks.
     *
     * @param mobile clean 10-digit mobile number
     * @param otp optional submitted OTP value to confirm against verification session
     * @return true if valid and consumed; false otherwise
     */
    boolean verifyAndConsumeRegistration(String mobile, String otp);
}

