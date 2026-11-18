package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class AdminAuthDtos {

    public record AdminLoginRequest(
            @NotBlank(message = "Username or email is required")
            String username,

            @NotBlank(message = "Password is required")
            String password
    ) {}

    public record AdminDestinationDto(
            String id,
            String masked
    ) {}

    public record AdminLoginInitResponse(
            boolean success,
            String challengeId,
            String message,
            List<AdminDestinationDto> destinations,
            long expiresInSeconds,
            long resendCooldownSeconds
    ) {}

    public record AdminSendOtpRequest(
            @NotBlank(message = "Challenge ID is required")
            String challengeId,

            @NotBlank(message = "Destination selection is required")
            String destination
    ) {}

    public record AdminSendOtpResponse(
            boolean success,
            String challengeId,
            String maskedDestination,
            String message,
            long expiresInSeconds,
            long resendCooldownSeconds
    ) {}

    public record AdminVerifyOtpRequest(
            @NotBlank(message = "Challenge ID is required")
            String challengeId,

            @NotBlank(message = "OTP is required")
            @Pattern(regexp = "^\\d{6}$", message = "OTP must be exactly 6 digits")
            String otp
    ) {}

    public record AdminResendOtpRequest(
            @NotBlank(message = "Challenge ID is required")
            String challengeId
    ) {}

    public record AdminAuditLogView(
            String eventId,
            UUID adminUserId,
            String adminUsername,
            String adminRole,
            String eventType,
            Instant eventTimestamp,
            String maskedDestination,
            String challengeId,
            String sourceIp,
            String userAgent,
            String outcome,
            String failureReason,
            Integer authVersion
    ) {}
}
