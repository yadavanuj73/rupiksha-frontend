package com.rupiksha.aeps.service;

import com.rupiksha.aeps.dto.TransactionContext;
import com.rupiksha.aeps.dto.TransactionResult;
import com.rupiksha.aeps.enums.TransactionWorkflowState;
import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.aeps.entity.AepsTransactionHistory;
import com.rupiksha.aeps.repository.AepsTransactionEngineRepository;
import com.rupiksha.aeps.repository.AepsTransactionHistoryRepository;
import com.rupiksha.backend.service.WalletService;
import com.rupiksha.backend.domain.WalletTransactionContext;
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
    private final WalletService walletService;

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

        // Debit wallet before provider call for CASH_DEPOSIT
        boolean isDeposit = "CASH_DEPOSIT".equalsIgnoreCase(transaction.getServiceType());
        TransactionResult result = null;
        if (isDeposit) {
            try {
                log.info("Debiting wallet for AEPS Cash Deposit: {}, user: {}, amount: {}", 
                        transaction.getTransactionId(), transaction.getUserId(), transaction.getAmount());
                walletService.debitForService(
                        transaction.getUserId(),
                        transaction.getAmount(),
                        "AEPS Cash Deposit - " + transaction.getTransactionId(),
                        WalletTransactionContext.AEPS_DEPOSIT,
                        "AEPS",
                        context.getRequest().getIpAddress() != null ? context.getRequest().getIpAddress() : "127.0.0.1",
                        transaction.getTransactionId()
                );
                log.info("Successfully debited wallet for AEPS Cash Deposit: {}", transaction.getTransactionId());
            } catch (Exception e) {
                log.error("Failed to debit wallet for AEPS Cash Deposit: {}", e.getMessage());
                result = TransactionResult.builder()
                        .transactionId(transactionId)
                        .referenceNumber(transaction.getReferenceNumber())
                        .status("FAILED")
                        .workflowState(TransactionWorkflowState.FAILED)
                        .responseCode("91")
                        .responseMessage("Insufficient wallet balance or ledger debit failed: " + e.getMessage())
                        .amount(transaction.getAmount())
                        .providerName(context.getProvider())
                        .completedTime(LocalDateTime.now())
                        .build();
                
                transaction.setCompletedAt(LocalDateTime.now());
                recordTransition(transaction, TransactionWorkflowState.FAILED, result.getStatus(), result.getResponseMessage());
                recordTransition(transaction, TransactionWorkflowState.FAILED, "COMPLETE", "Transaction orchestration cycle finished.");
                return result;
            }
        }

        // 4. Execute via provider strategy
        if (result == null) {
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
        }

        // 5. Update final transaction result in DB
        transaction.setProviderReference(result.getProviderReference());
        transaction.setProviderStatus(result.getStatus());
        transaction.setProviderMessage(result.getResponseMessage());
        transaction.setCompletedAt(LocalDateTime.now());
        
        TransactionWorkflowState finalState = result.getWorkflowState();
        recordTransition(transaction, finalState, result.getStatus(), result.getResponseMessage());

        // Refund/reverse wallet if CASH_DEPOSIT failed
        if (isDeposit && (TransactionWorkflowState.FAILED == finalState || "FAILED".equalsIgnoreCase(result.getStatus()))) {
            try {
                log.info("Refunding wallet for failed AEPS Cash Deposit: {}, user: {}, amount: {}", 
                        transaction.getTransactionId(), transaction.getUserId(), transaction.getAmount());
                walletService.refundForService(
                        transaction.getUserId(),
                        transaction.getAmount(),
                        "AEPS Cash Deposit Reversal - " + transaction.getTransactionId(),
                        transaction.getTransactionId(),
                        WalletTransactionContext.REVERSAL,
                        "AEPS",
                        context.getRequest().getIpAddress() != null ? context.getRequest().getIpAddress() : "127.0.0.1",
                        "REF-" + transaction.getTransactionId()
                );
                log.info("Successfully refunded wallet for failed AEPS Cash Deposit: {}", transaction.getTransactionId());
            } catch (Exception e) {
                log.error("Failed to refund wallet for failed AEPS Cash Deposit {}: {}", transaction.getTransactionId(), e.getMessage(), e);
            }
        }

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
