package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayoutBeneficiaryDto {

    private Long id;

    @NotBlank(message = "Beneficiary legal name is required")
    @Size(min = 2, max = 100, message = "Beneficiary name must be between 2 and 100 characters")
    private String beneficiaryName;

    @NotBlank(message = "Account number is required")
    @Pattern(regexp = "^[0-9]{9,18}$", message = "Invalid bank account number (9 to 18 digits)")
    private String accountNumber;

    @NotBlank(message = "IFSC code is required")
    @Pattern(regexp = "^[A-Z]{4}0[A-Z0-9]{6}$", message = "Invalid IFSC code format (e.g. SBIN0001234)")
    private String ifsc;

    private String bankName;

    @Size(max = 50, message = "Nickname cannot exceed 50 characters")
    private String nickName;

    private Boolean isVerified;

    private String status; // PENDING, APPROVED, REJECTED

    private String rejectionReason;

    private LocalDateTime actionedAt;

    private String actionedBy;

    private String userId;

    // User metadata for admin reviews
    private String userPartyCode;
    private String userFullName;
    private String userEmail;
    private String userMobile;

    private LocalDateTime createdAt;
}
