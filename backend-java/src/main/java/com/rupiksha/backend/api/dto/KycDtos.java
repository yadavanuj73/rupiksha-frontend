package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public class KycDtos {
    public record SubmitKycRequest(
            @NotBlank @Pattern(regexp = "\\d{12}", message = "Aadhaar must be 12 digits") String aadhaarNumber,
            @NotBlank @Pattern(regexp = "[A-Z]{5}[0-9]{4}[A-Z]{1}", message = "PAN format invalid") String panNumber,
            @NotBlank @Size(max = 5_000_000, message = "Selfie image is too large (max ~3.5MB base64)") String photoUrl,
            @NotBlank @Size(max = 5_000_000, message = "Aadhaar image is too large (max ~3.5MB base64)") String aadhaarPhotoUrl,
            @NotBlank @Size(max = 5_000_000, message = "PAN image is too large (max ~3.5MB base64)") String panPhotoUrl,
            @NotBlank @Size(max = 200) String addressLine1,
            @NotBlank @Size(max = 100) String city,
            @NotBlank @Size(max = 100) String state,
            @NotBlank @Pattern(regexp = "\\d{6}", message = "Pincode must be 6 digits") String pincode,
            // Extended onboarding fields — optional, stored if provided
            String firstName,
            String lastName,
            String dob,
            String mobile,
            String shopAddress,
            String permanentAddress,
            @Size(max = 5_000_000) String shopPhotoUrl,
            @Size(max = 5_000_000) String bankPassbookUrl
    ) {}

    public record KycStatusResponse(
            String userId,
            String userStatus,
            String kycStatus,
            String rejectionReason,
            Instant submittedAt,
            Instant approvedAt
    ) {}

    public record KycDecisionRequest(
            @NotBlank String action,
            String remarks
    ) {}
}

