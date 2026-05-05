package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

public class OtpDtos {
    public record SendOtpRequest(@NotBlank String mobile) {}
    public record VerifyOtpRequest(@NotBlank String mobile, @NotBlank String otp) {}
    public record OtpResponse(boolean success, String message) {}
}

