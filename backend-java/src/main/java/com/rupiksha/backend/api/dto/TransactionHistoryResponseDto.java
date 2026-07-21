package com.rupiksha.backend.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionHistoryResponseDto {
    private String transactionId;
    private String providerReference;
    private String providerTransactionId;
    private String bankReference;
    private String retailerId;
    private String serviceType;
    private String provider;
    private BigDecimal amount;
    private BigDecimal commission;
    private BigDecimal openingBalance;
    private BigDecimal closingBalance;
    private String status;
    private String remarks;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
