package com.rupiksha.backend.listener;

import com.rupiksha.backend.event.WalletBalanceChangedInternalEvent;
import com.rupiksha.backend.service.WalletRealtimeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class WalletEventListener {

    private final WalletRealtimeService walletRealtimeService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onBalanceChanged(WalletBalanceChangedInternalEvent event) {
        if (event == null || event.userId() == null) {
            return;
        }
        log.info("Dispatching post-commit real-time wallet update for user {}, ref: {}, context: {}",
                event.userId(), event.reference(), event.context());
        walletRealtimeService.sendBalanceChangedEvent(
                event.userId(),
                event.reference(),
                event.context(),
                event.timestamp()
        );
    }
}
