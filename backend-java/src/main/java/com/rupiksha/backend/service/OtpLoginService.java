package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.AuthDtos;

public interface OtpLoginService {
    AuthDtos.OtpLoginRequestResponse requestOtp(AuthDtos.OtpLoginRequest request, String clientIp, String userAgent);
    AuthDtos.AuthResponse verifyOtp(AuthDtos.OtpLoginVerifyRequest request, String clientIp, String userAgent);
    AuthDtos.OtpLoginRequestResponse resendOtp(AuthDtos.OtpLoginResendRequest request, String clientIp, String userAgent);
}

