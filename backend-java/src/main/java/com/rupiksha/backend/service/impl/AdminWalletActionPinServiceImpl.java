package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.exception.AdminWalletPinLockedException;
import com.rupiksha.backend.exception.AdminWalletPinSecretUnavailableException;
import com.rupiksha.backend.exception.AdminWalletPinValidationException;
import com.rupiksha.backend.repository.AdminWalletPinAuditLogRepository;
import com.rupiksha.backend.repository.AdminWalletPinIpStateRepository;
import com.rupiksha.backend.repository.AdminWalletPinSecurityStateRepository;
import com.rupiksha.backend.service.AdminWalletActionPinService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminWalletActionPinServiceImpl implements AdminWalletActionPinService {

    public static final int MAX_CONSECUTIVE_ATTEMPTS = 5;
    public static final int MAX_IP_ATTEMPTS = 15;
    public static final int FIRST_LOCKOUT_MINUTES = 15;
    public static final int SECOND_LOCKOUT_MINUTES = 30;
    public static final int ESCALATED_LOCKOUT_MINUTES = 60;

    private final AdminWalletPinSecurityStateRepository securityStateRepository;
    private final AdminWalletPinIpStateRepository ipStateRepository;
    private final AdminWalletPinAuditLogRepository auditLogRepository;

    @Value("${ADMIN_WALLET_ACTION_PIN:#{null}}")
    private String configuredPinProperty;

    /**
     * Resolves the configured PIN securely from environment or system properties.
     * Fails closed if not set or invalid.
     */
    private String resolveConfiguredPin() {
        String pin = System.getenv("ADMIN_WALLET_ACTION_PIN");
        if (pin == null || pin.isBlank()) {
            pin = configuredPinProperty;
        }
        if (pin == null || pin.isBlank() || !pin.trim().matches("^\\d{6}$")) {
            return null; // Signals configuration failure
        }
        return pin.trim();
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void verifyActionPin(
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
    ) {
        String cleanIp = (clientIp != null && !clientIp.isBlank()) ? clientIp.trim() : "unknown";
        String cleanAdminName = (adminUsername != null && !adminUsername.isBlank()) ? adminUsername.trim() : "admin";
        String corrId = (correlationId != null && !correlationId.isBlank()) ? correlationId.trim() : UUID.randomUUID().toString();

        // 1. Lock and load admin security state for atomic serial attempt checking
        AdminWalletPinSecurityState securityState = securityStateRepository
                .findByAdminUserIdForUpdate(adminUserId)
                .orElseGet(() -> {
                    AdminWalletPinSecurityState newState = new AdminWalletPinSecurityState();
                    newState.setAdminUserId(adminUserId);
                    newState.setAdminUsername(cleanAdminName);
                    return securityStateRepository.saveAndFlush(newState);
                });

        // 2. Load or create IP tracking state
        AdminWalletPinIpState ipState = ipStateRepository
                .findByIdForUpdate(cleanIp)
                .orElseGet(() -> {
                    AdminWalletPinIpState newIp = new AdminWalletPinIpState();
                    newIp.setIpAddress(cleanIp);
                    return ipStateRepository.saveAndFlush(newIp);
                });

        // 3. Check Account Lockout
        if (securityState.isCurrentlyLocked()) {
            saveAuditLog(
                    adminUserId, cleanAdminName, targetUserId, targetUsername, operationType,
                    amount, fundRequestId, AdminWalletPinAuditOutcome.RATE_LIMITED_LOCKED,
                    null, "ACCOUNT_LOCKED",
                    "Account is temporarily locked until " + securityState.getLockedUntil(),
                    corrId, cleanIp, userAgent, null
            );
            throw new AdminWalletPinLockedException("Account temporarily locked due to multiple failed PIN attempts. Please try again later.");
        }

        // 4. Check IP Lockout
        if (ipState.isCurrentlyLocked()) {
            saveAuditLog(
                    adminUserId, cleanAdminName, targetUserId, targetUsername, operationType,
                    amount, fundRequestId, AdminWalletPinAuditOutcome.IP_LOCKED_OUT,
                    null, "IP_LOCKED",
                    "IP address is temporarily locked until " + ipState.getLockedUntil(),
                    corrId, cleanIp, userAgent, null
            );
            throw new AdminWalletPinLockedException("Request rate limit exceeded. IP temporarily locked. Please try again later.");
        }

        // 5. Submitted PIN Format Validation
        if (submittedPin == null || submittedPin.isBlank()) {
            saveAuditLog(
                    adminUserId, cleanAdminName, targetUserId, targetUsername, operationType,
                    amount, fundRequestId, AdminWalletPinAuditOutcome.REJECTED_MISSING_PIN,
                    null, "MISSING_PIN",
                    "PIN is required for protected wallet operations",
                    corrId, cleanIp, userAgent, null
            );
            throw new AdminWalletPinValidationException("Admin wallet transaction PIN is required.");
        }

        String trimmedSubmittedPin = submittedPin.trim();
        if (!trimmedSubmittedPin.matches("^\\d{6}$")) {
            saveAuditLog(
                    adminUserId, cleanAdminName, targetUserId, targetUsername, operationType,
                    amount, fundRequestId, AdminWalletPinAuditOutcome.REJECTED_MALFORMED_PIN,
                    null, "MALFORMED_PIN",
                    "PIN must be exactly 6 numeric digits",
                    corrId, cleanIp, userAgent, null
            );
            throw new AdminWalletPinValidationException("Invalid PIN format. PIN must be exactly 6 numeric digits.");
        }

        // 6. Configured PIN Validation (Fail Closed)
        String configuredPin = resolveConfiguredPin();
        if (configuredPin == null) {
            log.error("[SECURITY_CRITICAL] ADMIN_WALLET_ACTION_PIN secret is missing, blank, or invalid. Protected operation {} aborted.", operationType);
            saveAuditLog(
                    adminUserId, cleanAdminName, targetUserId, targetUsername, operationType,
                    amount, fundRequestId, AdminWalletPinAuditOutcome.FAILED_CONFIG_UNAVAILABLE,
                    null, "CONFIG_UNAVAILABLE",
                    "Admin wallet PIN secret is unavailable or misconfigured in environment",
                    corrId, cleanIp, userAgent, null
            );
            throw new AdminWalletPinSecretUnavailableException("Admin wallet transaction PIN service is currently unavailable.");
        }

        // 7. Constant-Time Comparison (MessageDigest.isEqual)
        byte[] submittedBytes = trimmedSubmittedPin.getBytes(StandardCharsets.UTF_8);
        byte[] configuredBytes = configuredPin.getBytes(StandardCharsets.UTF_8);
        boolean isMatch = MessageDigest.isEqual(submittedBytes, configuredBytes);

        if (!isMatch) {
            int newConsecutive = securityState.getConsecutiveFailedAttempts() + 1;
            securityState.setConsecutiveFailedAttempts(newConsecutive);
            securityState.setTotalFailedAttempts(securityState.getTotalFailedAttempts() + 1);
            securityState.setLastFailedAt(Instant.now());
            securityState.setUpdatedAt(Instant.now());

            ipState.setFailedAttempts(ipState.getFailedAttempts() + 1);
            ipState.setLastAttemptAt(Instant.now());
            ipState.setUpdatedAt(Instant.now());

            if (newConsecutive >= MAX_CONSECUTIVE_ATTEMPTS) {
                // Apply escalating cooldown
                int cooldownMinutes = FIRST_LOCKOUT_MINUTES;
                if (securityState.getLockoutCount() == 1) {
                    cooldownMinutes = SECOND_LOCKOUT_MINUTES;
                } else if (securityState.getLockoutCount() >= 2) {
                    cooldownMinutes = ESCALATED_LOCKOUT_MINUTES;
                }

                Instant lockUntil = Instant.now().plus(cooldownMinutes, ChronoUnit.MINUTES);
                securityState.setLockedUntil(lockUntil);
                securityState.setLockoutCount(securityState.getLockoutCount() + 1);

                if (ipState.getFailedAttempts() >= MAX_IP_ATTEMPTS) {
                    ipState.setLockedUntil(lockUntil);
                }

                securityStateRepository.saveAndFlush(securityState);
                ipStateRepository.saveAndFlush(ipState);

                log.warn("[SECURITY_ALERT] Admin account {} locked out for {} minutes after {} failed PIN attempts.",
                        cleanAdminName, cooldownMinutes, newConsecutive);

                saveAuditLog(
                        adminUserId, cleanAdminName, targetUserId, targetUsername, operationType,
                        amount, fundRequestId, AdminWalletPinAuditOutcome.ACCOUNT_LOCKED_OUT,
                        null, "MAX_ATTEMPTS_EXCEEDED",
                        "Consecutive failed PIN attempts threshold reached. Locked for " + cooldownMinutes + " minutes",
                        corrId, cleanIp, userAgent, null
                );

                throw new AdminWalletPinLockedException("Account temporarily locked due to multiple failed PIN attempts. Please try again later.");
            } else {
                securityStateRepository.saveAndFlush(securityState);
                ipStateRepository.saveAndFlush(ipState);

                saveAuditLog(
                        adminUserId, cleanAdminName, targetUserId, targetUsername, operationType,
                        amount, fundRequestId, AdminWalletPinAuditOutcome.FAILED_INCORRECT_PIN,
                        null, "INCORRECT_PIN",
                        "Incorrect PIN submitted (attempt " + newConsecutive + " of " + MAX_CONSECUTIVE_ATTEMPTS + ")",
                        corrId, cleanIp, userAgent, null
                );

                throw new AdminWalletPinValidationException("Invalid PIN. Operation rejected.");
            }
        }

        // 8. Successful PIN Verification
        securityState.setConsecutiveFailedAttempts(0);
        securityState.setLastSuccessfulAt(Instant.now());
        securityState.setUpdatedAt(Instant.now());
        securityStateRepository.saveAndFlush(securityState);

        saveAuditLog(
                adminUserId, cleanAdminName, targetUserId, targetUsername, operationType,
                amount, fundRequestId, AdminWalletPinAuditOutcome.VERIFIED_SUCCESS,
                null, null, null, corrId, cleanIp, userAgent, null
        );
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordOperationSuccess(
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
    ) {
        String cleanIp = (clientIp != null && !clientIp.isBlank()) ? clientIp.trim() : "unknown";
        String cleanAdminName = (adminUsername != null && !adminUsername.isBlank()) ? adminUsername.trim() : "admin";
        saveAuditLog(
                adminUserId, cleanAdminName, targetUserId, targetUsername, operationType,
                amount, fundRequestId, AdminWalletPinAuditOutcome.OPERATION_COMPLETED,
                transactionRefId, null, null, correlationId, cleanIp, null, metadata
        );
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordOperationFailure(
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
    ) {
        String cleanIp = (clientIp != null && !clientIp.isBlank()) ? clientIp.trim() : "unknown";
        String cleanAdminName = (adminUsername != null && !adminUsername.isBlank()) ? adminUsername.trim() : "admin";
        saveAuditLog(
                adminUserId, cleanAdminName, targetUserId, targetUsername, operationType,
                amount, fundRequestId, AdminWalletPinAuditOutcome.OPERATION_FAILED,
                null, "EXECUTION_FAILURE", failureReason, correlationId, cleanIp, null, null
        );
    }

    private void saveAuditLog(
            UUID adminUserId,
            String adminUsername,
            UUID targetUserId,
            String targetUsername,
            AdminWalletOperationType operationType,
            BigDecimal amount,
            String fundRequestId,
            AdminWalletPinAuditOutcome outcome,
            String transactionRefId,
            String failureCategory,
            String failureReason,
            String correlationId,
            String sourceIp,
            String userAgent,
            String metadata
    ) {
        try {
            AdminWalletPinAuditLog auditLog = new AdminWalletPinAuditLog();
            auditLog.setEventId(UUID.randomUUID().toString());
            auditLog.setAdminUserId(adminUserId);
            auditLog.setAdminUsername(adminUsername);
            auditLog.setTargetUserId(targetUserId);
            auditLog.setTargetUsername(targetUsername);
            auditLog.setOperationType(operationType);
            auditLog.setAmount(amount);
            auditLog.setFundRequestId(fundRequestId);
            auditLog.setTimestamp(Instant.now());
            auditLog.setOutcome(outcome);
            auditLog.setTransactionReferenceId(transactionRefId);
            auditLog.setFailureCategory(failureCategory);
            auditLog.setFailureReason(failureReason);
            auditLog.setCorrelationId(correlationId);
            auditLog.setSourceIp(sourceIp);
            auditLog.setUserAgent(userAgent);
            auditLog.setMetadata(metadata);
            auditLogRepository.saveAndFlush(auditLog);
        } catch (Exception e) {
            log.error("[AUDIT_FAILURE] Failed to persist Admin Wallet PIN audit record: {}", e.getMessage(), e);
        }
    }
}
