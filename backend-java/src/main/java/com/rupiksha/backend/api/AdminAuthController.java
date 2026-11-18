package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.AdminAuthDtos;
import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.AdminAuditService;
import com.rupiksha.backend.service.AdminAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/auth")
@RequiredArgsConstructor
public class AdminAuthController {

    private final AdminAuthService adminAuthService;
    private final AdminAuditService adminAuditService;

    @PostMapping("/login")
    public AdminAuthDtos.AdminLoginInitResponse initiateLogin(
            @Valid @RequestBody AdminAuthDtos.AdminLoginRequest request,
            HttpServletRequest httpRequest
    ) {
        String ip = resolveClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        String correlationId = resolveCorrelationId(httpRequest);
        return adminAuthService.initiateLogin(request, ip, userAgent, correlationId);
    }

    @PostMapping("/send-otp")
    public AdminAuthDtos.AdminSendOtpResponse sendOtp(
            @Valid @RequestBody AdminAuthDtos.AdminSendOtpRequest request,
            HttpServletRequest httpRequest
    ) {
        String ip = resolveClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        String correlationId = resolveCorrelationId(httpRequest);
        return adminAuthService.sendOtp(request, ip, userAgent, correlationId);
    }

    @PostMapping("/resend-otp")
    public AdminAuthDtos.AdminSendOtpResponse resendOtp(
            @Valid @RequestBody AdminAuthDtos.AdminResendOtpRequest request,
            HttpServletRequest httpRequest
    ) {
        String ip = resolveClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        String correlationId = resolveCorrelationId(httpRequest);
        return adminAuthService.resendOtp(request, ip, userAgent, correlationId);
    }

    @PostMapping("/verify-otp")
    public AuthDtos.AuthResponse verifyOtp(
            @Valid @RequestBody AdminAuthDtos.AdminVerifyOtpRequest request,
            HttpServletRequest httpRequest
    ) {
        String ip = resolveClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        String correlationId = resolveCorrelationId(httpRequest);
        return adminAuthService.verifyOtp(request, ip, userAgent, correlationId);
    }

    @GetMapping("/dovesoft-diagnostics")
    public org.springframework.http.ResponseEntity<?> getDoveSoftDiagnostics() {
        return org.springframework.http.ResponseEntity.ok(adminAuthService.getDoveSoftDiagnostics());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(
            @RequestBody(required = false) AuthDtos.RefreshRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        String ip = resolveClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        String correlationId = resolveCorrelationId(httpRequest);
        UUID userId = principal != null && principal.userId() != null ? UUID.fromString(principal.userId()) : null;
        String refreshToken = request != null ? request.refreshToken() : null;
        adminAuthService.logout(refreshToken, userId, ip, userAgent, correlationId);
    }

    @PostMapping("/invalidate-sessions")
    @PreAuthorize("hasRole('ADMIN')")
    public void invalidateAllSessions(
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        String ip = resolveClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        String correlationId = resolveCorrelationId(httpRequest);
        UUID userId = principal != null && principal.userId() != null ? UUID.fromString(principal.userId()) : null;
        adminAuthService.invalidateAllAdminSessions(userId, ip, userAgent, correlationId);
    }

    @GetMapping("/audit-logs")
    @PreAuthorize("hasRole('ADMIN')")
    public Page<AdminAuthDtos.AdminAuditLogView> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        int boundedSize = Math.min(Math.max(size, 1), 100);
        return adminAuditService.getAuditLogs(PageRequest.of(page, boundedSize));
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

    private String resolveCorrelationId(HttpServletRequest request) {
        if (request == null) return UUID.randomUUID().toString();
        String header = request.getHeader("X-Correlation-ID");
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        return UUID.randomUUID().toString();
    }
}
