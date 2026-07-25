package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.api.dto.OtpDtos;
import com.rupiksha.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthDtos.UserView register(@Valid @RequestBody AuthDtos.RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthDtos.AuthResponse login(@Valid @RequestBody AuthDtos.LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/refresh")
    public AuthDtos.AuthResponse refresh(@Valid @RequestBody AuthDtos.RefreshRequest request) {
        return authService.refresh(request);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody AuthDtos.RefreshRequest request) {
        authService.logout(request.refreshToken());
    }

    @PostMapping("/forgot-password/send-otp")
    public OtpDtos.OtpResponse forgotPasswordSendOtp(@Valid @RequestBody AuthDtos.ForgotPasswordRequest request) {
        return authService.forgotPasswordSendOtp(request);
    }

    @PostMapping("/forgot-password/reset")
    public OtpDtos.OtpResponse resetPassword(@Valid @RequestBody AuthDtos.ResetPasswordRequest request) {
        return authService.resetPassword(request);
    }

    @PostMapping("/forgot-pin/send-otp")
    public OtpDtos.OtpResponse forgotPinSendOtp(@Valid @RequestBody AuthDtos.ForgotPinRequest request) {
        return authService.forgotPinSendOtp(request);
    }

    @PostMapping("/forgot-pin/reset")
    public OtpDtos.OtpResponse resetPin(@Valid @RequestBody AuthDtos.ResetPinRequest request) {
        return authService.resetPin(request);
    }
}
