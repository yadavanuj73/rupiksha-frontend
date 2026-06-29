package com.rupiksha.aeps.dto;

import com.rupiksha.aeps.dto.request.AepsTransactionRequest;
import com.rupiksha.aeps.enums.TransactionWorkflowState;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionContext {
    private com.rupiksha.backend.domain.User user; // Core user profile
    private com.rupiksha.aeps.entity.User merchant; // AEPS merchant profile
    private String provider; // Active provider resolved (e.g., "levin")
    private AepsTransactionRequest request; // The input request
    private TransactionWorkflowState workflowState;
    private String correlationId;
    private LocalDateTime timestamp;
    private String serviceType;
}
