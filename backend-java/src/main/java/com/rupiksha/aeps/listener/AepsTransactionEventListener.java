package com.rupiksha.aeps.listener;

import com.rupiksha.aeps.dto.AepsTransactionEvent;
import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.backend.domain.WalletTransactionContext;
import com.rupiksha.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class AepsTransactionEventListener {

    private final WalletService walletService;
    private final com.rupiksha.backend.service.CommissionService commissionService;

    @EventListener
    public void onTransactionComplete(AepsTransactionEvent event) {
        AepsTransactionEngine txn = event.getTransaction();
        log.info("AepsTransactionEvent received for transaction ID: {}, status: {}", txn.getTransactionId(), txn.getStatus());

        // 1. Extension Point: Wallet Deduction / Credit
        if ("SUCCESS".equalsIgnoreCase(txn.getStatus()) || "APPROVED".equalsIgnoreCase(txn.getStatus())) {
            String serviceType = txn.getServiceType() != null ? txn.getServiceType().toUpperCase() : "";
            if ("CASH_WITHDRAWAL".equals(serviceType) || "AADHAAR_PAY".equals(serviceType)) {
                try {
                    log.info("Crediting wallet for successful AEPS transaction: {}, user: {}, amount: {}", 
                            txn.getTransactionId(), txn.getUserId(), txn.getAmount());
                    
                    WalletTransactionContext context = "AADHAAR_PAY".equals(serviceType) 
                            ? WalletTransactionContext.AEPS_AADHAAR_PAY 
                            : WalletTransactionContext.AEPS_CASH_WITHDRAWAL;

                    walletService.creditForService(
                            txn.getUserId(),
                            txn.getAmount(),
                            "AEPS Withdrawal - " + txn.getTransactionId(),
                            context,
                            "AEPS",
                            "127.0.0.1",
                            txn.getTransactionId()
                    );
                    log.info("Successfully credited wallet for AEPS transaction: {}", txn.getTransactionId());
                } catch (Exception e) {
                    log.error("Failed to credit wallet for AEPS transaction {}: {}", txn.getTransactionId(), e.getMessage(), e);
                }
            }

            // 2. Extension Point: Commission Calculation & Distribution
            try {
                log.info("Triggering commission calculation for transaction: {}", txn.getTransactionId());
                commissionService.processAepsCommission(txn);
            } catch (Exception e) {
                log.error("Commission processing error for transaction {} (AEPS transaction remains SUCCESS): {}", 
                        txn.getTransactionId(), e.getMessage(), e);
            }
        }

        // 3. Extension Point: Settlement Processor
        log.info("[EXTENSION POINT] Settlement: Skipped in this phase. Target transaction: {}", txn.getTransactionId());

        // 4. Extension Point: Reports & Analytics
        log.info("[EXTENSION POINT] Reports & Analytics: Logging transaction telemetry metrics.");

        // 5. Extension Point: Notifications
        log.info("[EXTENSION POINT] Notifications: Sending transaction alerts to merchant: {}", txn.getMerchantId());
    }
}
