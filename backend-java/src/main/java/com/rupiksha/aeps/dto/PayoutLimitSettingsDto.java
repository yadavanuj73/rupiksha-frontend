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
public class PayoutLimitSettingsDto {
    private BigDecimal minimumPayoutAmount;
    private BigDecimal maximumPayoutAmount;
    private String updatedBy;
    private String updatedAt;
    private Long version;
}
