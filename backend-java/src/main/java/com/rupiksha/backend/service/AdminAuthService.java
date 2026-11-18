package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.AdminAuthDtos;
import com.rupiksha.backend.api.dto.AuthDtos;

import java.util.UUID;

public interface AdminAuthService {

    AdminAuthDtos.AdminLoginInitResponse initiateLogin(
            AdminAuthDtos.AdminLoginRequest request,
            String clientIp,
            String userAgent,
            String correlationId
    );

    AdminAuthDtos.AdminSendOtpResponse sendOtp(
            AdminAuthDtos.AdminSendOtpRequest request,
            String clientIp,
            String userAgent,
            String correlationId
    );

    AdminAuthDtos.AdminSendOtpResponse resendOtp(
            AdminAuthDtos.AdminResendOtpRequest request,
            String clientIp,
            String userAgent,
            String correlationId
    );

    AuthDtos.AuthResponse verifyOtp(
            AdminAuthDtos.AdminVerifyOtpRequest request,
            String clientIp,
            String userAgent,
            String correlationId
    );

    void logout(
            String refreshToken,
            UUID adminUserId,
            String clientIp,
            String userAgent,
            String correlationId
    );

    void invalidateAllAdminSessions(
            UUID actingAdminUserId,
            String clientIp,
            String userAgent,
            String correlationId
    );
}
