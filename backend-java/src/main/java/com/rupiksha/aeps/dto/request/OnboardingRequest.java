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

    @NotBlank(message = "Latitude is required")
    private String latitude;

    @NotBlank(message = "Longitude is required")
    private String longitude;
}
