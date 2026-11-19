package com.rupiksha.backend.service;

import com.rupiksha.backend.domain.AdminWalletOperationType;

import java.math.BigDecimal;
import java.util.UUID;

public interface AdminWalletActionPinService {

    /**
     * Verifies the 6-digit transaction PIN for an admin wallet action.
     * Enforces format validation, fail-closed environment check, constant-time comparison,
     * persistent brute-force tracking and escalating account/IP lockouts.
     * Logs the audit event with outcome and metadata.
     *
     * @param adminUserId authenticated admin's UUID
     * @param adminUsername admin's username
     * @param operationType one of the 8 protected wallet operations
     * @param targetUserId target user receiving the fund, status change, or lock
     * @param targetUsername target user's username
     * @param amount operation amount if applicable
     * @param fundRequestId fund request ID if applicable
     * @param submittedPin the submitted 6-digit PIN
     * @param clientIp client IP address
     * @param userAgent client User-Agent
     * @param correlationId request correlation ID
     */
    void verifyActionPin(
            UUID adminUserId,
            String adminUsername,
            AdminWalletOperationType operationType,
            UUID targetUserId,
            String targetUsername,
            BigDecimal amount,
            String fundRequestId,
            String submittedPin,
            String clientIp,
            String userAgent,
            String correlationId
    );

    /**
     * Records the final completion of the wallet operation in the audit trail.
     */
    void recordOperationSuccess(
            UUID adminUserId,
            String adminUsername,
            AdminWalletOperationType operationType,
            UUID targetUserId,
            String targetUsername,
            BigDecimal amount,
            String fundRequestId,
            String transactionRefId,
            String clientIp,
            String correlationId,
            String metadata
    );

    /**
     * Records an operation failure in the audit trail.
     */
    void recordOperationFailure(
            UUID adminUserId,
            String adminUsername,
            AdminWalletOperationType operationType,
            UUID targetUserId,
            String targetUsername,
            BigDecimal amount,
            String fundRequestId,
            String failureReason,
            String clientIp,
            String correlationId
    );
}
