package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonPropertyOrder({
    "PayoutPipe", "OrderId", "Amount", "BeneficiaryName",
    "AccountNumber", "Ifsc", "BankName", "TransferMode",
    "Remarks", "MobileNumber", "AccountType"
})
public class PayoutRequest {

    @JsonProperty("PayoutPipe")
    @NotBlank(message = "PayoutPipe is required")
    private String payoutPipe;

    @JsonProperty("OrderId")
    @NotBlank(message = "OrderId is required")
    private String orderId;

    @JsonProperty("Amount")
    @NotNull(message = "Amount is required")
    @Positive(message = "Amount must be positive")
    @DecimalMin(value = "1.0", message = "Minimum amount is 1")
    @DecimalMax(value = "200000.0", message = "Maximum amount is 200000")
    private Double amount;

    @JsonProperty("BeneficiaryName")
    @NotBlank(message = "Beneficiary name is required")
    @Size(min = 3, max = 100, message = "Beneficiary name must be between 3 and 100 characters")
    private String beneficiaryName;

    @JsonProperty("AccountNumber")
    @NotBlank(message = "Account number is required")
    @Pattern(regexp = "^[0-9]{9,18}$", message = "Invalid account number")
    private String accountNumber;

    @JsonProperty("Ifsc")
    @NotBlank(message = "IFSC code is required")
    @Pattern(regexp = "^[A-Z]{4}0[A-Z0-9]{6}$", message = "Invalid IFSC code")
    private String ifsc;

    @JsonProperty("BankName")
    private String bankName;

    @JsonProperty("TransferMode")
    @NotBlank(message = "Transfer mode is required")
    @Pattern(regexp = "^(IMPS|NEFT|RTGS)$", message = "Transfer mode must be IMPS, NEFT, or RTGS")
    private String transferMode;

    @JsonProperty("Remarks")
    @Size(max = 200, message = "Remarks cannot exceed 200 characters")
    private String remarks;

    @JsonProperty("MobileNumber")
    @Pattern(regexp = "^[6-9][0-9]{9}$", message = "Invalid mobile number")
    private String mobileNumber;

    @JsonProperty("AccountType")
    @Pattern(regexp = "^(Savings|Current)$", message = "Account type must be Savings or Current")
    private String accountType;
}

// Made with Bob
