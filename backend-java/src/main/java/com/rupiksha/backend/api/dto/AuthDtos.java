package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class AuthDtos {
    public record LoginRequest(
            @NotBlank String username,
            @NotBlank String password,
            String pin,
            String role
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
            @NotBlank @Size(min = 6, max = 100) String password,
            String pin,
            String otp,
            String role,
            String state,
            String city,
            String pincode,
            String address,
            String businessName,
            String parentUserId,
            String addedByUserRef,
            String addedByName,
            String addedByRole,
            String addedByPartyCode,
            String firstName,
            String lastName,
            String dob,
            String fatherName,
            String gender,
            String businessType,
            String gstNumber,
            String shopLandmark,
            String shopAddress,
            String shopState,
            String shopDistrict,
            String shopCity,
            String shopPincode,
            String permState,
            String permDistrict,
            String permCity,
            String permPincode,
            String permanentAddress,
            String aadhaarNumber,
            String panNumber,
            String bankAccountHolder,
            String bankName,
            String bankAccountNumber,
            String bankIfsc,
            String bankBranch,
            String photoUrl,
            String aadhaarPhotoUrl,
            String aadhaarBackPhotoUrl,
            String panPhotoUrl,
            String shopPhotoUrl,
            String bankPassbookUrl,
            String liveSelfieUrl,
            String drivingLicenceUrl,
            String voterIdUrl,
            String passportUrl,
            String gpsLat,
            String gpsLong,
            String deviceInfo
    ) {}

    public record UserView(
            String id,
            String username,
            String mobile,
            String email,
            String fullName,
            String partyCode,
            String status,
            String registrationStatus,
            String kycStatus,
            boolean pinConfigured,
            List<String> roles,
            String parentName,
            String parentPartyCode,
            Instant createdAt
    ) {}

    public record ForgotPasswordRequest(
            @NotBlank String mobile
    ) {}

    public record ResetPasswordRequest(
            @NotBlank String mobile,
            @NotBlank String otp,
            @NotBlank @Size(min = 6, max = 100) String newPassword
    ) {}

    public record ForgotPinRequest(
            @NotBlank String mobile
    ) {}

    public record ResetPinRequest(
            @NotBlank String mobile,
            @NotBlank String otp,
            @NotBlank String newPin
    ) {}
}
