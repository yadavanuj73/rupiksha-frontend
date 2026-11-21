package com.rupiksha.backend.api.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;
import java.util.UUID;

public class AdminBankAccountDtos {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CreateBankAccountRequest(
            @NotBlank(message = "Account holder name is required")
            String accountHolderName,

            @NotBlank(message = "Account number is required")
            @Pattern(regexp = "^[0-9]{8,24}$", message = "Account number must be 8-24 digits")
            String accountNumber,

            @NotBlank(message = "IFSC code is required")
            @Pattern(regexp = "^[A-Z]{4}0[A-Z0-9]{6}$", message = "Invalid IFSC code format")
            String ifscCode,

            @NotBlank(message = "Bank name is required")
            String bankName,

            @NotBlank(message = "Branch is required")
            String branch
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UpdateBankAccountRequest(
            @NotBlank(message = "Account holder name is required")
            String accountHolderName,

            @Pattern(regexp = "^$|^[0-9]{8,24}$", message = "Account number must be 8-24 digits")
            String accountNumber,

            @NotBlank(message = "IFSC code is required")
            @Pattern(regexp = "^[A-Z]{4}0[A-Z0-9]{6}$", message = "Invalid IFSC code format")
            String ifscCode,

            @NotBlank(message = "Bank name is required")
            String bankName,

            @NotBlank(message = "Branch is required")
            String branch
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record BankAccountStatusUpdateRequest(
            @NotNull(message = "Status is required")
            Boolean isActive
    ) {}

    public record BankAccountResponse(
            UUID id,
            String accountHolderName,
            String accountNumberMasked,
            String ifscCode,
            String bankName,
            String branch,
            Boolean isActive,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record ActiveBankAccountResponse(
            UUID id,
            String accountHolderName,
            String accountNumberMasked,
            String ifscCode,
            String bankName,
            String branch
    ) {}
}
