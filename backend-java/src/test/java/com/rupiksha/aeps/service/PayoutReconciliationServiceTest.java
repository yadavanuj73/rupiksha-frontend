package com.rupiksha.aeps.service;

import com.rupiksha.aeps.dto.PayoutResponse;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.aeps.service.impl.PayoutReconciliationServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayoutReconciliationServiceTest {

    @Mock
    private PayoutTransactionRepository payoutTransactionRepository;

    @Mock
    private PayoutService payoutService;

    private PayoutReconciliationServiceImpl reconciliationService;

    @BeforeEach
    void setUp() {
        reconciliationService = new PayoutReconciliationServiceImpl(payoutTransactionRepository, payoutService);
    }

    @Test
    @DisplayName("Batch reconciliation should process pending transactions and collect summary")
    void testReconcileAllPending() {
        PayoutTransaction txn1 = PayoutTransaction.builder()
                .id(1L)
                .orderId("PO_BATCH_001")
                .status("PENDING")
                .createdAt(LocalDateTime.now().minusMinutes(5))
                .build();

        PayoutTransaction txn2 = PayoutTransaction.builder()
                .id(2L)
                .orderId("PO_BATCH_002")
                .status("PENDING")
                .createdAt(LocalDateTime.now().minusMinutes(10))
                .build();

        when(payoutTransactionRepository.findPendingForReconciliation(anyList(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of(txn1, txn2));

        when(payoutService.checkPayoutStatus(eq("PO_BATCH_001"), eq("SYSTEM_CRON")))
                .thenReturn(PayoutResponse.builder().orderId("PO_BATCH_001").status("SUCCESS").success(true).build());

        when(payoutService.checkPayoutStatus(eq("PO_BATCH_002"), eq("SYSTEM_CRON")))
                .thenReturn(PayoutResponse.builder().orderId("PO_BATCH_002").status("FAILED").success(false).build());

        Map<String, Object> result = reconciliationService.reconcileAllPending(20, "SYSTEM_CRON");

        assertNotNull(result);
        assertEquals(2, result.get("totalFound"));
        assertEquals(2, result.get("processed"));
        assertEquals(1, result.get("resolvedSuccess"));
        assertEquals(1, result.get("resolvedFailed"));
        assertEquals(0, result.get("stillPending"));
    }
}
