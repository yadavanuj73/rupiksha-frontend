package com.rupiksha.aeps.enums;

/**
 * Lifecycle states of an AEPS transaction.
 */
public enum TransactionWorkflowState {
    STARTED,
    VALIDATING,
    PROVIDER_PROCESSING,
    SUCCESS,
    FAILED,
    TIMEOUT,
    PENDING,
    RETRY,
    REVERSAL_REQUIRED
}
