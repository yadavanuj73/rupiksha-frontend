package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayoutRequest {

    private String orderId;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "500.0", message = "Minimum payout amount is ₹500")
    @DecimalMax(value = "500000.0", message = "Maximum payout amount is ₹5,00,000")
    private BigDecimal amount;

    @NotBlank(message = "Beneficiary name is required")
    @Size(min = 2, max = 100, message = "Beneficiary name must be between 2 and 100 characters")
    private String beneficiaryName;

    @NotBlank(message = "Account number is required")
    @Pattern(regexp = "^[0-9]{9,18}$", message = "Invalid bank account number (9 to 18 digits)")
    private String accountNumber;

    @NotBlank(message = "IFSC code is required")
    @Pattern(regexp = "^[A-Z]{4}0[A-Z0-9]{6}$", message = "Invalid IFSC code format (e.g. SBIN0001234)")
    private String ifsc;

    private String bankName;
    private String branchName;
    private String address;

    @Builder.Default
    @Pattern(regexp = "^(IMPS|NEFT|RTGS|IFT)$", message = "Transfer mode must be IMPS, NEFT, RTGS or IFT")
    private String transferMode = "IMPS";

    @Size(max = 200, message = "Remarks cannot exceed 200 characters")
    private String remarks;

    @Pattern(regexp = "^[0-9]{10}$", message = "Invalid 10-digit mobile number")
    private String mobileNumber;

    private Boolean saveBeneficiary;
}
