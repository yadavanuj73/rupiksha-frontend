package com.rupiksha.aeps.listener;

import com.rupiksha.aeps.dto.AepsTransactionEvent;
import com.rupiksha.aeps.entity.AepsTransactionEngine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class AepsTransactionEventListener {

    @EventListener
    public void onTransactionComplete(AepsTransactionEvent event) {
        AepsTransactionEngine txn = event.getTransaction();
        log.info("AepsTransactionEvent received for transaction ID: {}, status: {}", txn.getTransactionId(), txn.getStatus());

        // 1. Extension Point: Wallet Deduction / Credit
        log.info("[EXTENSION POINT] Wallet handler: Skipped in this phase. Target transaction: {}", txn.getTransactionId());

        // 2. Extension Point: Commission Calculation
        log.info("[EXTENSION POINT] Commission calculator: Skipped in this phase. Target transaction: {}", txn.getTransactionId());

        // 3. Extension Point: Settlement Processor
        log.info("[EXTENSION POINT] Settlement: Skipped in this phase. Target transaction: {}", txn.getTransactionId());

        // 4. Extension Point: Reports & Analytics
        log.info("[EXTENSION POINT] Reports & Analytics: Logging transaction telemetry metrics.");

        // 5. Extension Point: Notifications
        log.info("[EXTENSION POINT] Notifications: Sending transaction alerts to merchant: {}", txn.getMerchantId());
    }
}
