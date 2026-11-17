package com.rupiksha.aeps.scheduler;

import com.rupiksha.aeps.service.PayoutReconciliationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class PayoutReconciliationScheduler {

    private final PayoutReconciliationService payoutReconciliationService;

    @Value("${payout.reconciliation.enabled:true}")
    private boolean reconciliationEnabled;

    /**
     * Periodic background reconciliation for pending payout transactions.
     * Runs every 3 minutes with an initial delay of 1 minute.
     */
    @Scheduled(fixedDelayString = "${payout.reconciliation.interval-ms:180000}", initialDelay = 60000)
    public void reconcilePendingPayouts() {
        if (!reconciliationEnabled) {
            log.debug("Payout reconciliation scheduler is disabled by configuration");
            return;
        }

        try {
            log.info("[FINANCIAL_AUDIT] Running scheduled payout reconciliation...");
            Map<String, Object> result = payoutReconciliationService.reconcileAllPending(20, "SYSTEM_RECONCILER");
            int processed = (int) result.getOrDefault("processed", 0);
            if (processed > 0) {
                log.info("[FINANCIAL_AUDIT] Scheduled payout reconciliation completed: {}", result);
            }
        } catch (Exception e) {
            log.error("[FINANCIAL_ALERT] Payout reconciliation scheduler encountered an unexpected error: {}", e.getMessage(), e);
        }
    }
}
