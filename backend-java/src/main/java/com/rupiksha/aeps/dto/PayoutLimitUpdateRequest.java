package com.rupiksha.aeps.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayoutLimitUpdateRequest {

    @NotNull(message = "Minimum payout amount is required")
    @DecimalMin(value = "1.00", message = "Minimum payout amount must be at least ₹1.00")
    @Digits(integer = 10, fraction = 2, message = "Minimum payout amount cannot exceed 2 decimal places")
    private BigDecimal minimumPayoutAmount;

    @NotNull(message = "Maximum payout amount is required")
    @DecimalMin(value = "1.00", message = "Maximum payout amount must be at least ₹1.00")
    @Digits(integer = 10, fraction = 2, message = "Maximum payout amount cannot exceed 2 decimal places")
    private BigDecimal maximumPayoutAmount;
}
