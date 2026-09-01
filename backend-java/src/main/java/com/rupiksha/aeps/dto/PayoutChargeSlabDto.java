package com.rupiksha.aeps.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayoutChargeSlabDto {
    private Long id;
    private BigDecimal minAmount;
    private BigDecimal maxAmount;
    private BigDecimal baseCharge;
    private BigDecimal gstRate;
    private BigDecimal gstAmount;
    private BigDecimal totalCharge;
    private Boolean isActive;
}
