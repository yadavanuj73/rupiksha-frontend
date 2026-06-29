package com.rupiksha.aeps.dto;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import org.springframework.context.ApplicationEvent;

/**
 * Event published after an AEPS transaction completes.
 * Hook extension points exist for: Wallet, Commission, Settlement, Reports, Analytics, Notifications.
 */
public class AepsTransactionEvent extends ApplicationEvent {

    private final AepsTransactionEngine transaction;

    public AepsTransactionEvent(Object source, AepsTransactionEngine transaction) {
        super(source);
        this.transaction = transaction;
    }

    public AepsTransactionEngine getTransaction() {
        return transaction;
    }
}
