package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.api.dto.OtpDtos;
import com.rupiksha.backend.service.AuthService;
import com.rupiksha.backend.service.OtpLoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final OtpLoginService otpLoginService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthDtos.UserView register(@Valid @RequestBody AuthDtos.RegisterRequest request, HttpServletRequest httpRequest) {
        String clientIp = resolveClientIp(httpRequest);
        return authService.register(request, clientIp);
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

    @PostMapping("/otp-login/request")
    public AuthDtos.OtpLoginRequestResponse requestOtpLogin(
            @Valid @RequestBody AuthDtos.OtpLoginRequest request,
            HttpServletRequest httpRequest
    ) {
        String ip = resolveClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        return otpLoginService.requestOtp(request, ip, userAgent);
    }

    @PostMapping("/otp-login/verify")
    public AuthDtos.AuthResponse verifyOtpLogin(
            @Valid @RequestBody AuthDtos.OtpLoginVerifyRequest request,
            HttpServletRequest httpRequest
    ) {
        String ip = resolveClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        return otpLoginService.verifyOtp(request, ip, userAgent);
    }

    @PostMapping("/otp-login/resend")
    public AuthDtos.OtpLoginRequestResponse resendOtpLogin(
            @Valid @RequestBody AuthDtos.OtpLoginResendRequest request,
            HttpServletRequest httpRequest
    ) {
        String ip = resolveClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        return otpLoginService.resendOtp(request, ip, userAgent);
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }
}
