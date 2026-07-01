package com.rupiksha.backend.domain;

public enum WalletTransactionStatus {
    INITIATED,
    PENDING,
    PROCESSING,
    SUCCESS,
    FAILED,
    REFUNDED,
    REVERSED,
    CANCELLED,
    EXPIRED
}
