package com.rupiksha.aeps.dto;

import com.rupiksha.aeps.enums.TransactionWorkflowState;
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
public class TransactionResult {
    private String transactionId;
    private String referenceNumber;
    private String providerReference;
    private String status; // SUCCESS, FAILED, PENDING, etc.
    private TransactionWorkflowState workflowState;
    private String responseCode;
    private String responseMessage;
    private BigDecimal amount;
    private String providerName;
    private LocalDateTime completedTime;
}
