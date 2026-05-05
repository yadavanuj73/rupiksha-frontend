package com.rupiksha.backend.integration.otp;

public interface OtpProvider {
    String providerName();
    String sendOtp(String mobile);
    boolean verifyOtp(String mobile, String otp, String reference);
}

