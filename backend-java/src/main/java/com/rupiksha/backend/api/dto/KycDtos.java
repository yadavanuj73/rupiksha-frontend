package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public class KycDtos {
    public record SubmitKycRequest(
            // Section 1: Personal Details
            @NotBlank String fullName,
            String fatherName,
            String email,
            String dob,
            String gender,

            // Section 2: Business Details
            String shopName,
            String businessName,
            String businessType,
            String gstNumber,

            // Section 3: Shop Address
            String shopAddress,
            String shopLandmark,
            String shopState,
            String shopDistrict,
            String shopCity,
            String shopPincode,

            // Section 4: Permanent Address
            String permanentAddress,
            String permState,
            String permDistrict,
            String permCity,
            String permPincode,

            // Section 5: Identity Details
            @NotBlank @Pattern(regexp = "\\d{12}", message = "Aadhaar must be 12 digits") String aadhaarNumber,
            @NotBlank @Pattern(regexp = "[A-Z]{5}[0-9]{4}[A-Z]{1}", message = "PAN format invalid") String panNumber,

            // Section 6: Bank Details
            String bankAccountHolder,
            String bankName,
            String bankAccountNumber,
            String bankIfsc,
            String bankBranch,

            // Section 7 & 9: Documents & Shop Photo
            @Size(max = 10_000_000) String photoUrl,
            @Size(max = 10_000_000) String aadhaarPhotoUrl,
            @Size(max = 10_000_000) String aadhaarBackPhotoUrl,
            @Size(max = 10_000_000) String panPhotoUrl,
            @Size(max = 10_000_000) String bankPassbookUrl,
            @Size(max = 10_000_000) String shopPhotoUrl,
            @Size(max = 10_000_000) String drivingLicenceUrl,
            @Size(max = 10_000_000) String voterIdUrl,
            @Size(max = 10_000_000) String passportUrl,

            // Section 8: Live Verification & GPS
            @Size(max = 10_000_000) String liveSelfieUrl,
            String gpsLat,
            String gpsLong,
            String gpsTimestamp,
            String deviceInfo,

            // Compatibility fallback fields
            String addressLine1,
            String city,
            String state,
            String pincode
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
