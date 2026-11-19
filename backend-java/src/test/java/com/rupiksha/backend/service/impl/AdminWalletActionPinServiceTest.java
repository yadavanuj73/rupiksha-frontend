package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.exception.AdminWalletPinLockedException;
import com.rupiksha.backend.exception.AdminWalletPinSecretUnavailableException;
import com.rupiksha.backend.exception.AdminWalletPinValidationException;
import com.rupiksha.backend.repository.AdminWalletPinAuditLogRepository;
import com.rupiksha.backend.repository.AdminWalletPinIpStateRepository;
import com.rupiksha.backend.repository.AdminWalletPinSecurityStateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminWalletActionPinServiceTest {

    @Mock
    private AdminWalletPinSecurityStateRepository securityStateRepository;
    @Mock
    private AdminWalletPinIpStateRepository ipStateRepository;
    @Mock
    private AdminWalletPinAuditLogRepository auditLogRepository;

    @InjectMocks
    private AdminWalletActionPinServiceImpl pinService;

    private UUID adminId;
    private UUID targetUserId;
    private AdminWalletPinSecurityState securityState;
    private AdminWalletPinIpState ipState;

    @BeforeEach
    void setUp() {
        adminId = UUID.randomUUID();
        targetUserId = UUID.randomUUID();

        securityState = new AdminWalletPinSecurityState();
        securityState.setAdminUserId(adminId);
        securityState.setAdminUsername("admin1");
        securityState.setConsecutiveFailedAttempts(0);
        securityState.setTotalFailedAttempts(0);

        ipState = new AdminWalletPinIpState();
        ipState.setIpAddress("192.168.1.100");
        ipState.setFailedAttempts(0);

        lenient().when(securityStateRepository.findByAdminUserIdForUpdate(adminId))
                .thenReturn(Optional.of(securityState));
        lenient().when(securityStateRepository.saveAndFlush(any(AdminWalletPinSecurityState.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        lenient().when(ipStateRepository.findByIdForUpdate(anyString()))
                .thenReturn(Optional.of(ipState));
        lenient().when(ipStateRepository.saveAndFlush(any(AdminWalletPinIpState.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // Configure test secret property (simulating Secret Manager injected env var)
        ReflectionTestUtils.setField(pinService, "configuredPinProperty", "852963");
    }

    @Test
    @DisplayName("1. Correct PIN permits operation and resets failed attempt counters")
    void testCorrectPinSuccess() {
        securityState.setConsecutiveFailedAttempts(2);

        assertDoesNotThrow(() -> pinService.verifyActionPin(
                adminId, "admin1", AdminWalletOperationType.CREDIT_FUND,
                targetUserId, "retailer1", BigDecimal.valueOf(100.00), null,
                "852963", "192.168.1.100", "Mozilla/5.0", "corr-1"
        ));

        assertEquals(0, securityState.getConsecutiveFailedAttempts());
        assertNotNull(securityState.getLastSuccessfulAt());
        verify(securityStateRepository, atLeastOnce()).saveAndFlush(securityState);
        verify(auditLogRepository, atLeastOnce()).saveAndFlush(argThat(log ->
                log.getOutcome() == AdminWalletPinAuditOutcome.VERIFIED_SUCCESS &&
                        log.getOperationType() == AdminWalletOperationType.CREDIT_FUND
        ));
    }

    @Test
    @DisplayName("2. Missing (null or empty) PIN is rejected with HTTP 400 validation error")
    void testMissingPinRejected() {
        AdminWalletPinValidationException exNull = assertThrows(
                AdminWalletPinValidationException.class,
                () -> pinService.verifyActionPin(
                        adminId, "admin1", AdminWalletOperationType.CREDIT_FUND,
                        targetUserId, "retailer1", BigDecimal.valueOf(100.00), null,
                        null, "192.168.1.100", "Mozilla/5.0", "corr-2"
                )
        );
        assertTrue(exNull.getMessage().contains("PIN is required"));

        AdminWalletPinValidationException exEmpty = assertThrows(
                AdminWalletPinValidationException.class,
                () -> pinService.verifyActionPin(
                        adminId, "admin1", AdminWalletOperationType.DEBIT_FUND,
                        targetUserId, "retailer1", BigDecimal.valueOf(50.00), null,
                        "   ", "192.168.1.100", "Mozilla/5.0", "corr-3"
                )
        );
        assertTrue(exEmpty.getMessage().contains("PIN is required"));
    }

    @Test
    @DisplayName("3. Malformed PIN (fewer or more than 6 digits, or letters/symbols) is rejected")
    void testMalformedPinRejected() {
        // Fewer than 6 digits
        assertThrows(AdminWalletPinValidationException.class, () -> pinService.verifyActionPin(
                adminId, "admin1", AdminWalletOperationType.LOCK_AMOUNT,
                targetUserId, "retailer1", BigDecimal.valueOf(50.00), null,
                "12345", "192.168.1.100", "Mozilla/5.0", "corr-4"
        ));

        // More than 6 digits
        assertThrows(AdminWalletPinValidationException.class, () -> pinService.verifyActionPin(
                adminId, "admin1", AdminWalletOperationType.RELEASE_LOCK_AMOUNT,
                targetUserId, "retailer1", BigDecimal.valueOf(50.00), null,
                "1234567", "192.168.1.100", "Mozilla/5.0", "corr-5"
        ));

        // Letters or special characters
        assertThrows(AdminWalletPinValidationException.class, () -> pinService.verifyActionPin(
                adminId, "admin1", AdminWalletOperationType.FREEZE_WALLET,
                targetUserId, "retailer1", BigDecimal.ZERO, null,
                "12345A", "192.168.1.100", "Mozilla/5.0", "corr-6"
        ));
    }

    @Test
    @DisplayName("4. Incorrect PIN increments consecutive failed attempts and returns generic message")
    void testIncorrectPinIncrementsCounter() {
        AdminWalletPinValidationException ex = assertThrows(
                AdminWalletPinValidationException.class,
                () -> pinService.verifyActionPin(
                        adminId, "admin1", AdminWalletOperationType.CREDIT_FUND,
                        targetUserId, "retailer1", BigDecimal.valueOf(100.00), null,
                        "111111", "192.168.1.100", "Mozilla/5.0", "corr-7"
                )
        );

        assertEquals("Invalid PIN. Operation rejected.", ex.getMessage());
        assertEquals(1, securityState.getConsecutiveFailedAttempts());
        assertEquals(1, securityState.getTotalFailedAttempts());
        assertNotNull(securityState.getLastFailedAt());
    }

    @Test
    @DisplayName("5. Brute-force lockout triggered after 5 consecutive incorrect attempts")
    void testLockoutAfter5IncorrectAttempts() {
        securityState.setConsecutiveFailedAttempts(4);

        AdminWalletPinLockedException ex = assertThrows(
                AdminWalletPinLockedException.class,
                () -> pinService.verifyActionPin(
                        adminId, "admin1", AdminWalletOperationType.CREDIT_FUND,
                        targetUserId, "retailer1", BigDecimal.valueOf(100.00), null,
                        "999999", "192.168.1.100", "Mozilla/5.0", "corr-8"
                )
        );

        assertTrue(ex.getMessage().contains("temporarily locked"));
        assertEquals(5, securityState.getConsecutiveFailedAttempts());
        assertNotNull(securityState.getLockedUntil());
        assertTrue(securityState.getLockedUntil().isAfter(Instant.now()));
        assertEquals(1, securityState.getLockoutCount());
    }

    @Test
    @DisplayName("6. Locked account is immediately blocked before checking submitted PIN")
    void testLockedAccountFailsFast() {
        securityState.setLockedUntil(Instant.now().plus(15, ChronoUnit.MINUTES));

        AdminWalletPinLockedException ex = assertThrows(
                AdminWalletPinLockedException.class,
                () -> pinService.verifyActionPin(
                        adminId, "admin1", AdminWalletOperationType.APPROVE_FUND_REQUEST,
                        targetUserId, "retailer1", BigDecimal.valueOf(500.00), "req-1",
                        "852963", "192.168.1.100", "Mozilla/5.0", "corr-9"
                )
        );

        assertTrue(ex.getMessage().contains("temporarily locked"));
    }

    @Test
    @DisplayName("7. Escalating cooldown increases lockout time on repeated lockouts")
    void testEscalatingCooldown() {
        // Second lockout should apply 30-minute cooldown
        securityState.setConsecutiveFailedAttempts(4);
        securityState.setLockoutCount(1);

        assertThrows(AdminWalletPinLockedException.class, () -> pinService.verifyActionPin(
                adminId, "admin1", AdminWalletOperationType.UNFREEZE_WALLET,
                targetUserId, "retailer1", BigDecimal.ZERO, null,
                "000000", "192.168.1.100", "Mozilla/5.0", "corr-10"
        ));

        assertEquals(2, securityState.getLockoutCount());
        assertTrue(securityState.getLockedUntil().isAfter(Instant.now().plus(25, ChronoUnit.MINUTES)));

        // Third lockout should apply 60-minute cooldown (after previous lockout expires)
        securityState.setLockedUntil(null);
        securityState.setConsecutiveFailedAttempts(4);
        assertThrows(AdminWalletPinLockedException.class, () -> pinService.verifyActionPin(
                adminId, "admin1", AdminWalletOperationType.REJECT_FUND_REQUEST,
                targetUserId, "retailer1", BigDecimal.valueOf(200.00), "req-2",
                "000000", "192.168.1.100", "Mozilla/5.0", "corr-11"
        ));

        assertEquals(3, securityState.getLockoutCount());
        assertTrue(securityState.getLockedUntil().isAfter(Instant.now().plus(55, ChronoUnit.MINUTES)));
    }

    @Test
    @DisplayName("8. Missing environment secret causes service to fail closed (HTTP 503)")
    void testMissingSecretFailsClosed() {
        ReflectionTestUtils.setField(pinService, "configuredPinProperty", null);

        AdminWalletPinSecretUnavailableException ex = assertThrows(
                AdminWalletPinSecretUnavailableException.class,
                () -> pinService.verifyActionPin(
                        adminId, "admin1", AdminWalletOperationType.CREDIT_FUND,
                        targetUserId, "retailer1", BigDecimal.valueOf(100.00), null,
                        "852963", "192.168.1.100", "Mozilla/5.0", "corr-12"
                )
        );

        assertTrue(ex.getMessage().contains("currently unavailable"));
        verify(auditLogRepository, atLeastOnce()).saveAndFlush(argThat(log ->
                log.getOutcome() == AdminWalletPinAuditOutcome.FAILED_CONFIG_UNAVAILABLE
        ));
    }

    @Test
    @DisplayName("9. Secret rotation: new PIN works, old PIN immediately rejected")
    void testSecretRotation() {
        // Initially configured with 852963
        assertDoesNotThrow(() -> pinService.verifyActionPin(
                adminId, "admin1", AdminWalletOperationType.CREDIT_FUND,
                targetUserId, "retailer1", BigDecimal.valueOf(100.00), null,
                "852963", "192.168.1.100", "Mozilla/5.0", "corr-13"
        ));

        // Rotate secret to 147258
        ReflectionTestUtils.setField(pinService, "configuredPinProperty", "147258");

        // Old PIN must fail
        assertThrows(AdminWalletPinValidationException.class, () -> pinService.verifyActionPin(
                adminId, "admin1", AdminWalletOperationType.CREDIT_FUND,
                targetUserId, "retailer1", BigDecimal.valueOf(100.00), null,
                "852963", "192.168.1.100", "Mozilla/5.0", "corr-14"
        ));

        // New PIN must succeed
        assertDoesNotThrow(() -> pinService.verifyActionPin(
                adminId, "admin1", AdminWalletOperationType.CREDIT_FUND,
                targetUserId, "retailer1", BigDecimal.valueOf(100.00), null,
                "147258", "192.168.1.100", "Mozilla/5.0", "corr-15"
        ));
    }

    @Test
    @DisplayName("10. Audit log never contains the submitted or configured PIN")
    void testAuditLogContainsNoPinValues() {
        ArgumentCaptor<AdminWalletPinAuditLog> logCaptor = ArgumentCaptor.forClass(AdminWalletPinAuditLog.class);

        // Run an incorrect attempt
        assertThrows(AdminWalletPinValidationException.class, () -> pinService.verifyActionPin(
                adminId, "admin1", AdminWalletOperationType.CREDIT_FUND,
                targetUserId, "retailer1", BigDecimal.valueOf(100.00), null,
                "123456", "192.168.1.100", "Mozilla/5.0", "corr-16"
        ));

        verify(auditLogRepository, atLeastOnce()).saveAndFlush(logCaptor.capture());
        for (AdminWalletPinAuditLog logEntry : logCaptor.getAllValues()) {
            assertFalse(String.valueOf(logEntry.getMetadata()).contains("123456"));
            assertFalse(String.valueOf(logEntry.getMetadata()).contains("852963"));
            assertFalse(String.valueOf(logEntry.getFailureReason()).contains("123456"));
            assertFalse(String.valueOf(logEntry.getFailureReason()).contains("852963"));
        }
    }
}
