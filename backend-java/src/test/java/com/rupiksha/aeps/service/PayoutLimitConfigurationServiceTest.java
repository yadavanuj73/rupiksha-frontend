package com.rupiksha.aeps.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.dto.PayoutLimitSettingsDto;
import com.rupiksha.aeps.dto.PayoutLimitUpdateRequest;
import com.rupiksha.aeps.entity.PayoutLimitSettings;
import com.rupiksha.aeps.entity.PayoutLimitSettingsAuditLog;
import com.rupiksha.aeps.repository.PayoutLimitSettingsAuditLogRepository;
import com.rupiksha.aeps.repository.PayoutLimitSettingsRepository;
import com.rupiksha.aeps.service.impl.PayoutLimitConfigurationServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayoutLimitConfigurationServiceTest {

    @Mock
    private PayoutLimitSettingsRepository settingsRepository;

    @Mock
    private PayoutLimitSettingsAuditLogRepository auditLogRepository;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private ObjectMapper objectMapper;
    private PayoutLimitConfigurationServiceImpl service;

    private PayoutLimitSettings defaultEntity;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new PayoutLimitConfigurationServiceImpl(settingsRepository, auditLogRepository, objectMapper);

        defaultEntity = PayoutLimitSettings.builder()
                .id(1L)
                .minimumPayoutAmount(new BigDecimal("100.00"))
                .maximumPayoutAmount(new BigDecimal("100000.00"))
                .updatedBy("SYSTEM")
                .version(0L)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("Admin: Fetch active limits returns saved configuration")
    void testGetActiveLimits_Success() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(defaultEntity));

        PayoutLimitSettingsDto limits = service.getActiveLimits();

        assertNotNull(limits);
        assertEquals(0, new BigDecimal("100.00").compareTo(limits.getMinimumPayoutAmount()));
        assertEquals(0, new BigDecimal("100000.00").compareTo(limits.getMaximumPayoutAmount()));
        assertEquals("SYSTEM", limits.getUpdatedBy());
        assertEquals(0L, limits.getVersion());
    }

    @Test
    @DisplayName("Admin: Fail-closed if database configuration record is missing")
    void testGetActiveLimits_FailClosedWhenMissing() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.empty());

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.getActiveLimits());
        assertTrue(ex.getMessage().contains("fails closed"));
    }

    @Test
    @DisplayName("Admin: Successfully update payout limits with atomic save and audit log")
    void testUpdateLimits_Success() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(defaultEntity));

        PayoutLimitSettings savedEntity = PayoutLimitSettings.builder()
                .id(1L)
                .minimumPayoutAmount(new BigDecimal("200.00"))
                .maximumPayoutAmount(new BigDecimal("200000.00"))
                .updatedBy("admin-uuid-123")
                .version(1L)
                .createdAt(defaultEntity.getCreatedAt())
                .updatedAt(LocalDateTime.now())
                .build();

        when(settingsRepository.saveAndFlush(any(PayoutLimitSettings.class))).thenReturn(savedEntity);

        PayoutLimitUpdateRequest updateReq = PayoutLimitUpdateRequest.builder()
                .minimumPayoutAmount(new BigDecimal("200.00"))
                .maximumPayoutAmount(new BigDecimal("200000.00"))
                .build();

        PayoutLimitSettingsDto result = service.updateLimits(
                updateReq, "admin-uuid-123", "admin_super", "corr-456", "192.168.1.1", "Chrome"
        );

        assertNotNull(result);
        assertEquals(0, new BigDecimal("200.00").compareTo(result.getMinimumPayoutAmount()));
        assertEquals(0, new BigDecimal("200000.00").compareTo(result.getMaximumPayoutAmount()));
        assertEquals("admin-uuid-123", result.getUpdatedBy());

        // Verify audit log captured previous and new values
        ArgumentCaptor<PayoutLimitSettingsAuditLog> auditCaptor = ArgumentCaptor.forClass(PayoutLimitSettingsAuditLog.class);
        verify(auditLogRepository, times(1)).save(auditCaptor.capture());
        PayoutLimitSettingsAuditLog audit = auditCaptor.getValue();
        assertEquals("admin-uuid-123", audit.getAdminUserId());
        assertEquals("admin_super", audit.getAdminUsername());
        assertEquals(0, new BigDecimal("100.00").compareTo(audit.getPreviousMinimumAmount()));
        assertEquals(0, new BigDecimal("200.00").compareTo(audit.getNewMinimumAmount()));
        assertEquals(0, new BigDecimal("100000.00").compareTo(audit.getPreviousMaximumAmount()));
        assertEquals(0, new BigDecimal("200000.00").compareTo(audit.getNewMaximumAmount()));
        assertEquals("SUCCESS", audit.getOperationResult());
        assertEquals("corr-456", audit.getCorrelationId());
        assertEquals("192.168.1.1", audit.getSourceIp());
    }

    @Test
    @DisplayName("Validation: Reject null request or missing fields")
    void testUpdateLimits_NullAndMissingValidation() {
        assertThrows(IllegalArgumentException.class, () ->
                service.updateLimits(null, "admin", "admin", "c", "ip", "ua"));

        PayoutLimitUpdateRequest missingMin = PayoutLimitUpdateRequest.builder()
                .maximumPayoutAmount(new BigDecimal("50000.00"))
                .build();
        assertThrows(IllegalArgumentException.class, () ->
                service.updateLimits(missingMin, "admin", "admin", "c", "ip", "ua"));

        PayoutLimitUpdateRequest missingMax = PayoutLimitUpdateRequest.builder()
                .minimumPayoutAmount(new BigDecimal("100.00"))
                .build();
        assertThrows(IllegalArgumentException.class, () ->
                service.updateLimits(missingMax, "admin", "admin", "c", "ip", "ua"));
    }

    @Test
    @DisplayName("Validation: Reject zero and negative amounts")
    void testUpdateLimits_RejectZeroAndNegative() {
        PayoutLimitUpdateRequest zeroMin = PayoutLimitUpdateRequest.builder()
                .minimumPayoutAmount(BigDecimal.ZERO)
                .maximumPayoutAmount(new BigDecimal("100000.00"))
                .build();
        IllegalArgumentException ex1 = assertThrows(IllegalArgumentException.class, () ->
                service.updateLimits(zeroMin, "admin", "admin", "c", "ip", "ua"));
        assertTrue(ex1.getMessage().contains("Minimum payout amount must be greater than zero"));

        PayoutLimitUpdateRequest negativeMax = PayoutLimitUpdateRequest.builder()
                .minimumPayoutAmount(new BigDecimal("100.00"))
                .maximumPayoutAmount(new BigDecimal("-500.00"))
                .build();
        IllegalArgumentException ex2 = assertThrows(IllegalArgumentException.class, () ->
                service.updateLimits(negativeMax, "admin", "admin", "c", "ip", "ua"));
        assertTrue(ex2.getMessage().contains("Maximum payout amount must be greater than zero"));
    }

    @Test
    @DisplayName("Validation: Reject minimum greater than maximum")
    void testUpdateLimits_RejectMinGreaterThanMax() {
        PayoutLimitUpdateRequest invalidReq = PayoutLimitUpdateRequest.builder()
                .minimumPayoutAmount(new BigDecimal("50000.00"))
                .maximumPayoutAmount(new BigDecimal("10000.00"))
                .build();
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.updateLimits(invalidReq, "admin", "admin", "c", "ip", "ua"));
        assertTrue(ex.getMessage().contains("cannot exceed maximum"));
    }

    @Test
    @DisplayName("Validation: Reject amounts with more than 2 decimal places")
    void testUpdateLimits_RejectInvalidDecimalPrecision() {
        PayoutLimitUpdateRequest invalidPrecision = PayoutLimitUpdateRequest.builder()
                .minimumPayoutAmount(new BigDecimal("100.555"))
                .maximumPayoutAmount(new BigDecimal("100000.00"))
                .build();
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.updateLimits(invalidPrecision, "admin", "admin", "c", "ip", "ua"));
        assertTrue(ex.getMessage().contains("cannot exceed 2 decimal places"));
    }

    // ─── CRITICAL PER-TRANSACTION VALIDATION TESTS ────────────────────────────

    @Test
    @DisplayName("Transaction: ₹50 in one transaction is rejected (below min ₹100)")
    void testValidatePayoutAmount_BelowMinRejected() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(defaultEntity));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.validatePayoutAmount(new BigDecimal("50.00")));
        assertTrue(ex.getMessage().contains("Minimum payout amount is ₹100"));
    }

    @Test
    @DisplayName("Transaction: ₹100 in one transaction is allowed (boundary exact min)")
    void testValidatePayoutAmount_ExactMinAllowed() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(defaultEntity));

        assertDoesNotThrow(() -> service.validatePayoutAmount(new BigDecimal("100.00")));
    }

    @Test
    @DisplayName("Transaction: ₹25,000 in one transaction is allowed (within range)")
    void testValidatePayoutAmount_WithinRangeAllowed() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(defaultEntity));

        assertDoesNotThrow(() -> service.validatePayoutAmount(new BigDecimal("25000.00")));
    }

    @Test
    @DisplayName("Transaction: ₹1,00,000 in one transaction is allowed (boundary exact max)")
    void testValidatePayoutAmount_ExactMaxAllowed() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(defaultEntity));

        assertDoesNotThrow(() -> service.validatePayoutAmount(new BigDecimal("100000.00")));
    }

    @Test
    @DisplayName("Transaction: ₹1,00,001 in one transaction is rejected (above max ₹1,00,000)")
    void testValidatePayoutAmount_AboveMaxRejected() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(defaultEntity));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.validatePayoutAmount(new BigDecimal("100001.00")));
        assertTrue(ex.getMessage().contains("Maximum payout amount per transaction is ₹1,00,000"));
        assertTrue(ex.getMessage().contains("Please initiate a separate payout for any additional amount"));
    }

    @Test
    @DisplayName("Transaction: ₹2,00,000 in one single transaction is rejected")
    void testValidatePayoutAmount_Single2LakhRejected() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(defaultEntity));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.validatePayoutAmount(new BigDecimal("200000.00")));
        assertTrue(ex.getMessage().contains("Maximum payout amount per transaction is ₹1,00,000"));
    }

    @Test
    @DisplayName("Transaction: Multiple sequential transactions (₹1,00,000 followed by ₹50,000) are BOTH allowed independently")
    void testValidatePayoutAmount_MultipleSequentialAllowed_NotCumulative() {
        when(settingsRepository.findById(1L)).thenReturn(Optional.of(defaultEntity));

        // First transaction: ₹1,00,000 (reaches max)
        assertDoesNotThrow(() -> service.validatePayoutAmount(new BigDecimal("100000.00")));

        // Second transaction: ₹50,000 (combined total ₹1,50,000 exceeds max, but each is <= max)
        assertDoesNotThrow(() -> service.validatePayoutAmount(new BigDecimal("50000.00")));

        // Third transaction: another ₹1,00,000 (combined total ₹2,50,000)
        assertDoesNotThrow(() -> service.validatePayoutAmount(new BigDecimal("100000.00")));

        // Proves NO cumulative, daily, weekly, or monthly total tracking occurs!
    }
}
