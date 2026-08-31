package com.rupiksha.backend.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionHistorySummaryDto {
    private long totalTransactions;
    private long successCount;
    private long failedCount;
    private long pendingCount;
    private BigDecimal totalVolume;
    private BigDecimal commissionEarned;
    private BigDecimal cashWithdrawalVolume;
    private BigDecimal cashDepositVolume;
}
