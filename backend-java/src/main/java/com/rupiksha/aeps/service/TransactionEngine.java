package com.rupiksha.aeps.service;

import com.rupiksha.aeps.dto.TransactionContext;
import com.rupiksha.aeps.dto.TransactionResult;
import com.rupiksha.aeps.enums.TransactionWorkflowState;
import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.aeps.entity.AepsTransactionHistory;
import com.rupiksha.aeps.repository.AepsTransactionEngineRepository;
import com.rupiksha.aeps.repository.AepsTransactionHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class TransactionEngine {

    private final ProviderTransactionExecutor providerExecutor;
    private final AepsTransactionHistoryRepository historyRepository;
    private final AepsTransactionEngineRepository transactionRepository;

    /**
     * Orchestrates transaction execution across standard state transitions and persists states to DB.
     */
    public TransactionResult execute(TransactionContext context, AepsTransactionEngine transaction) {
        String transactionId = transaction.getTransactionId();
        log.info("TransactionEngine starting orchestration for transaction ID: {}", transactionId);
        
        // 1. STARTED State (already persisted in service layer)
        recordTransition(transaction, TransactionWorkflowState.STARTED, "STARTED", "Transaction execution initiated.");

        // 2. VALIDATING State
        context.setWorkflowState(TransactionWorkflowState.VALIDATING);
        recordTransition(transaction, TransactionWorkflowState.VALIDATING, "VALIDATING", "Performing request and security validations.");

        // 3. PROVIDER_PROCESSING State
        context.setWorkflowState(TransactionWorkflowState.PROVIDER_PROCESSING);
        recordTransition(transaction, TransactionWorkflowState.PROVIDER_PROCESSING, "PROVIDER_PROCESSING", "Forwarding transaction payload to provider.");

        // 4. Execute via provider strategy
        TransactionResult result;
        try {
            result = providerExecutor.execute(context);
        } catch (Exception e) {
            log.error("Provider execution failed with exception: {}", e.getMessage(), e);
            result = TransactionResult.builder()
                    .transactionId(transactionId)
                    .referenceNumber(transaction.getReferenceNumber())
                    .status("FAILED")
                    .workflowState(TransactionWorkflowState.FAILED)
                    .responseCode("99")
                    .responseMessage("Provider error: " + e.getMessage())
                    .amount(transaction.getAmount())
                    .providerName(context.getProvider())
                    .completedTime(LocalDateTime.now())
                    .build();
        }

        // 5. Update final transaction result in DB
        transaction.setProviderReference(result.getProviderReference());
        transaction.setProviderStatus(result.getStatus());
        transaction.setProviderMessage(result.getResponseMessage());
        transaction.setCompletedAt(LocalDateTime.now());
        
        TransactionWorkflowState finalState = result.getWorkflowState();
        recordTransition(transaction, finalState, result.getStatus(), result.getResponseMessage());

        // 6. Record COMPLETE
        recordTransition(transaction, finalState, "COMPLETE", "Transaction orchestration cycle finished.");

        return result;
    }

    private void recordTransition(AepsTransactionEngine transaction, TransactionWorkflowState workflowState, String status, String remarks) {
        log.info("Transaction Audit - TxnId: {}, WorkflowState: {}, Status: {}, Remarks: {}", 
                transaction.getTransactionId(), workflowState, status, remarks);
        
        // Update core record status/workflowState (if not COMPLETE log)
        if (!"COMPLETE".equals(status)) {
            transaction.setWorkflowState(workflowState.name());
            transaction.setStatus(status);
            transactionRepository.save(transaction);
        }

        // Write state to audit history table
        AepsTransactionHistory history = AepsTransactionHistory.builder()
                .transactionId(transaction.getTransactionId())
                .workflowState(workflowState.name())
                .status(status)
                .remarks(remarks)
                .createdBy("SYSTEM")
                .build();
        historyRepository.save(history);
    }
}
