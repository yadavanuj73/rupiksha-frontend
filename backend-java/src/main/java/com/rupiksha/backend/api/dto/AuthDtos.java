package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class AuthDtos {
    public record LoginRequest(
            @NotBlank String username,
            @NotBlank String password
    ) {}

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record AuthResponse(
            String accessToken,
            String refreshToken,
            String tokenType,
            long expiresInSeconds,
            UserView user
    ) {}

    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 80) String username,
            @NotBlank @Size(min = 10, max = 20) String mobile,
            @NotBlank String email,
            @NotBlank String fullName,
            @NotBlank @Size(min = 8, max = 100) String password,
            // Optional: "RETAILER" | "DISTRIBUTOR" | "SUPER_DISTRIBUTOR".
            // Anything else (including "ADMIN") is silently downgraded to RETAILER.
            // Regardless of role, the account is created in PENDING status and must
            // be approved by an admin via /admin/approvals before the user can log in.
            String role,
            // Optional profile attributes collected by the public/portal registration
            // form. They are persisted so the admin approval screen can auto-generate
            // a state-coded party code (e.g. RPRBR######) without a second round-trip.
            String state,
            String city,
            String pincode,
            String address,
            String businessName,
            String addedByUserRef,
            String addedByName,
            String addedByRole,
            String addedByPartyCode
    ) {}

    public record UserView(
            String id,
            String username,
            String fullName,
            String status,
            String kycStatus,
            List<String> roles,
            Instant createdAt
    ) {}
}

