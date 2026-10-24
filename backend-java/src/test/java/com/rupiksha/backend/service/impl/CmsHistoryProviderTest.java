package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.api.dto.TransactionHistorySummaryDto;
import com.rupiksha.backend.domain.FingpayCmsTransaction;
import com.rupiksha.backend.domain.TransactionReportType;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.FingpayCmsTransactionRepository;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.WalletEntryRepository;
import com.rupiksha.backend.service.history.providers.CmsHistoryProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CmsHistoryProviderTest {

    @Mock
    private WalletEntryRepository walletEntryRepository;

    @Mock
    private TxnRepository txnRepository;

    @Mock
    private FingpayCmsTransactionRepository cmsTransactionRepository;

    @InjectMocks
    private CmsHistoryProvider cmsHistoryProvider;

    private User testUser;
    private final UUID testUserId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(testUserId);
        testUser.setUsername("RPRBR176901");
        testUser.setMobile("9679729762");
    }

    @Test
    @DisplayName("CmsHistoryProvider supports CMS_FINGPAY and CMS_AIRTEL")
    void testSupports() {
        assertTrue(cmsHistoryProvider.supports(TransactionReportType.CMS_FINGPAY));
        assertTrue(cmsHistoryProvider.supports(TransactionReportType.CMS_AIRTEL));
        assertFalse(cmsHistoryProvider.supports(TransactionReportType.AEPS_FINGPAY));
    }

    @Test
    @DisplayName("Fetch history for CMS_FINGPAY retrieves persisted FingpayCmsTransaction records")
    void testFetchHistoryFingpayCms() {
        FingpayCmsTransaction t1 = new FingpayCmsTransaction();
        t1.setId(UUID.randomUUID());
        t1.setUser(testUser);
        t1.setFpTransactionId("FP00187352S");
        t1.setMerchantTransactionId("RXCMS9281041");
        t1.setBcLoginId("RPRBR176901");
        t1.setTypeOfTransaction("CDC");
        t1.setAmount(BigDecimal.valueOf(8500.00));
        t1.setProviderStatus("S");
        t1.setInternalStatus("SUCCESS");
        t1.setRemarks("L&T Finance - Loan EMI Collection");
        t1.setCreatedAt(Instant.now());
        t1.setUpdatedAt(Instant.now());

        Page<FingpayCmsTransaction> page = new PageImpl<>(List.of(t1), PageRequest.of(0, 10), 1);
        when(cmsTransactionRepository.findWithFilters(eq(testUserId), any(), any(), any(), any(), any()))
                .thenReturn(page);

        Page<TransactionHistoryResponseDto> result = cmsHistoryProvider.fetchHistory(
                TransactionReportType.CMS_FINGPAY, testUserId, null, null, null, null, null, PageRequest.of(0, 10));

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        TransactionHistoryResponseDto dto = result.getContent().get(0);
        assertEquals("RXCMS9281041", dto.getTransactionId());
        assertEquals("FP00187352S", dto.getProviderReference());
        assertEquals(BigDecimal.valueOf(8500.00), dto.getAmount());
        assertEquals("SUCCESS", dto.getStatus());
        assertEquals("FINGPAY", dto.getProvider());
        assertEquals("CMS Collection", dto.getServiceType());
        assertEquals("L&T Finance - Loan EMI Collection", dto.getRemarks());
    }

    @Test
    @DisplayName("Fetch summary computes correct aggregates across all persisted records")
    void testFetchSummary() {
        FingpayCmsTransaction t1 = new FingpayCmsTransaction();
        t1.setUser(testUser);
        t1.setMerchantTransactionId("RXCMS1");
        t1.setFpTransactionId("FP1");
        t1.setBcLoginId("RPRBR176901");
        t1.setAmount(BigDecimal.valueOf(5000.00));
        t1.setInternalStatus("SUCCESS");
        t1.setCreatedAt(Instant.now());
        t1.setUpdatedAt(Instant.now());

        FingpayCmsTransaction t2 = new FingpayCmsTransaction();
        t2.setUser(testUser);
        t2.setMerchantTransactionId("RXCMS2");
        t2.setFpTransactionId("FP2");
        t2.setBcLoginId("RPRBR176901");
        t2.setAmount(BigDecimal.valueOf(3000.00));
        t2.setInternalStatus("FAILED");
        t2.setCreatedAt(Instant.now());
        t2.setUpdatedAt(Instant.now());

        when(cmsTransactionRepository.findAllWithFilters(eq(testUserId), any(), any(), any(), any(), any(Sort.class)))
                .thenReturn(List.of(t1, t2));

        TransactionHistorySummaryDto summary = cmsHistoryProvider.fetchSummary(
                TransactionReportType.CMS_FINGPAY, testUserId, null, null, null, null, null);

        assertNotNull(summary);
        assertEquals(2, summary.getTotalTransactions());
        assertEquals(1, summary.getSuccessCount());
        assertEquals(1, summary.getFailedCount());
        assertEquals(0, summary.getPendingCount());
        assertEquals(BigDecimal.valueOf(8000.00), summary.getTotalVolume());
    }
}
