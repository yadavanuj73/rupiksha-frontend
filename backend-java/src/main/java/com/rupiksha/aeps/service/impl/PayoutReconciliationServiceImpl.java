package com.rupiksha.aeps.service.impl;

import com.rupiksha.aeps.dto.PayoutResponse;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.aeps.service.PayoutReconciliationService;
import com.rupiksha.aeps.service.PayoutService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutReconciliationServiceImpl implements PayoutReconciliationService {

    private final PayoutTransactionRepository payoutTransactionRepository;
    private final PayoutService payoutService;

    @Override
    @Transactional
    public PayoutResponse reconcileTransaction(String orderId, String actorPrincipal) {
        if (orderId == null || orderId.isBlank()) {
            throw new IllegalArgumentException("Order ID is required for reconciliation");
        }
        log.info("[FINANCIAL_AUDIT] Reconciling payout transaction {} requested by {}", orderId, actorPrincipal);
        return payoutService.checkPayoutStatus(orderId, actorPrincipal);
    }

    @Override
    public Map<String, Object> reconcileAllPending(int maxRecords, String actorPrincipal) {
        int limit = Math.min(Math.max(maxRecords, 1), 50);
        LocalDateTime now = LocalDateTime.now();
        // Look for PENDING or INITIATED transactions older than 2 minutes and newer than 7 days
        LocalDateTime afterDate = now.minusDays(7);
        LocalDateTime beforeDate = now.minusMinutes(2);

        List<PayoutTransaction> pendingTxns = payoutTransactionRepository.findPendingForReconciliation(
                List.of("PENDING", "INITIATED", "PROCESSING"),
                afterDate,
                beforeDate
        );

        int totalFound = pendingTxns.size();
        int processedCount = 0;
        int successCount = 0;
        int failedCount = 0;
        int pendingCount = 0;
        List<String> errors = new ArrayList<>();

        log.info("[FINANCIAL_AUDIT] Payout reconciliation batch started: found {} pending transactions (processing limit: {})",
                totalFound, limit);

        for (PayoutTransaction txn : pendingTxns) {
            if (processedCount >= limit) {
                break;
            }
            try {
                PayoutResponse res = reconcileTransaction(txn.getOrderId(), actorPrincipal);
                processedCount++;
                if ("SUCCESS".equalsIgnoreCase(res.getStatus())) {
                    successCount++;
                } else if ("FAILED".equalsIgnoreCase(res.getStatus())) {
                    failedCount++;
                } else {
                    pendingCount++;
                }
            } catch (Exception e) {
                log.error("[FINANCIAL_ALERT] Failed to reconcile payout orderId {}: {}", txn.getOrderId(), e.getMessage());
                errors.add(txn.getOrderId() + ": " + e.getMessage());
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("timestamp", now.toString());
        summary.put("actor", actorPrincipal);
        summary.put("totalFound", totalFound);
        summary.put("processed", processedCount);
        summary.put("resolvedSuccess", successCount);
        summary.put("resolvedFailed", failedCount);
        summary.put("stillPending", pendingCount);
        summary.put("errors", errors);

        log.info("[FINANCIAL_AUDIT] Payout reconciliation batch finished: processed={}, success={}, failed={}, stillPending={}",
                processedCount, successCount, failedCount, pendingCount);

        return summary;
    }
}
