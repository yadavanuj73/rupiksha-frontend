package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.api.dto.OtpDtos;

public interface AuthService {
    AuthDtos.AuthResponse login(AuthDtos.LoginRequest request);
    AuthDtos.AuthResponse refresh(AuthDtos.RefreshRequest request);
    AuthDtos.UserView register(AuthDtos.RegisterRequest request);
    void logout(String refreshToken);

    OtpDtos.OtpResponse forgotPasswordSendOtp(AuthDtos.ForgotPasswordRequest request);
    OtpDtos.OtpResponse resetPassword(AuthDtos.ResetPasswordRequest request);

    OtpDtos.OtpResponse forgotPinSendOtp(AuthDtos.ForgotPinRequest request);
    OtpDtos.OtpResponse resetPin(AuthDtos.ResetPinRequest request);
}
