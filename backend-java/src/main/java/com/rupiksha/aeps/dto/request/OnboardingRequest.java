package com.rupiksha.aeps.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class OnboardingRequest extends BaseRequest {

    @NotBlank(message = "First name is required")
    private String fname;

    private String middlename;

    @NotBlank(message = "Last name is required")
    private String lname;

    @NotBlank(message = "PAN card is required")
    private String panCard;

    @NotBlank(message = "Aadhaar number is required")
    private String aadharNumber;

    @NotBlank(message = "Mobile number is required")
    private String aepsMobile;

    @NotBlank(message = "Email is required")
    private String email;

    @NotBlank(message = "Shop name is required")
    private String shopName;

    @NotBlank(message = "Pincode is required")
    private String pinCode;

    @NotBlank(message = "Address is required")
    private String address;

    @NotBlank(message = "City is required")
    private String city;

    @NotBlank(message = "State code is required")
    private String state;

    // Optional — GPS coordinates are best-effort from browser geolocation
    private String latitude;

    private String longitude;

    private String provider;

    // Bank Settlement Details
    private String bankAccountNumber;
    private String ifscCode;
    private String bankName;
    private String bankAccountName;

    // KYC Document Payloads / Optional Metadata
    private Integer companyType;
    private String gstinNumber;
    private String panImage;
    private String shopImage;
    private String tradeBusinessProof;
    private String cancelledCheque;
    private String physicalVerificationImage;
    private String videoKycData;
}

