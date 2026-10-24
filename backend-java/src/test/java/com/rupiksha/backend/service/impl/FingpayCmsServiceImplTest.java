package com.rupiksha.backend.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.backend.api.dto.FingpayCmsDtos;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class FingpayCmsServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserServiceRepository userServiceRepository;

    @Mock
    private com.rupiksha.backend.service.WalletService walletService;

    @Mock
    private WalletRepository walletRepository;

    @Mock
    private TxnRepository txnRepository;

    @Mock
    private FingpayCmsTransactionRepository cmsTransactionRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private FingpayCmsServiceImpl fingpayCmsService;

    private User testUser;
    private final UUID testUserId = UUID.randomUUID();
    private final String testSecretKey = "1234567890;";

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(fingpayCmsService, "launchUrl", "https://fpcorp.tapits.in/UberCMSBC/#/login");
        ReflectionTestUtils.setField(fingpayCmsService, "supermerchantId", "1407");
        ReflectionTestUtils.setField(fingpayCmsService, "supermerchantSkey", "1234567891011121");
        ReflectionTestUtils.setField(fingpayCmsService, "skey", "1b271b5bb9d119e6004d588f80737bf5fbb9bb3bbe40834839e26bb93d2e6a");
        ReflectionTestUtils.setField(fingpayCmsService, "securityKey", testSecretKey);
        ReflectionTestUtils.setField(fingpayCmsService, "fundingMode", "RUPIKSHA_WALLET");
        ReflectionTestUtils.setField(fingpayCmsService, "loginType", "2");

        testUser = new User();
        testUser.setId(testUserId);
        testUser.setUsername("RPRBR176901");
        testUser.setMobile("9679729762");
        testUser.setPartyCode("RPRBR176901");
        testUser.setCmsMerchantId("RPRBR176901");
        testUser.setCmsMerchantPin("1234");
    }

    @Test
    @DisplayName("Generate Launch URL success for eligible retailer")
    void testGenerateLaunchUrlSuccess() {
        when(userRepository.findById(testUserId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(testUserId, ServiceType.CMS))
                .thenReturn(Optional.empty()); // Defaults to enabled

        FingpayCmsDtos.LaunchRequest req = new FingpayCmsDtos.LaunchRequest("19.0760", "72.8777");
        FingpayCmsDtos.LaunchResponse resp = fingpayCmsService.generateLaunchUrl(testUserId, req, "127.0.0.1");

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertNotNull(resp.getLaunchUrl());
        assertTrue(resp.getLaunchUrl().contains("https://fpcorp.tapits.in/UberCMSBC/#/login?data="));
        assertTrue(resp.getLaunchUrl().contains("&skey=1b271b5bb9d119e6004d588f80737bf5fbb9bb3bbe40834839e26bb93d2e6a"));
        assertEquals("RPRBR176901", resp.getMerchantId());
        assertEquals("9679729762", resp.getMobileNumber());
    }

    @Test
    @DisplayName("Generate Launch URL throws exception when CMS service is disabled")
    void testGenerateLaunchUrlDisabledService() {
        when(userRepository.findById(testUserId)).thenReturn(Optional.of(testUser));
        UserService disabledService = new UserService();
        disabledService.setIsEnabled(false);
        when(userServiceRepository.findByUserIdAndServiceType(testUserId, ServiceType.CMS))
                .thenReturn(Optional.of(disabledService));

        assertThrows(IllegalStateException.class, () ->
                fingpayCmsService.generateLaunchUrl(testUserId, new FingpayCmsDtos.LaunchRequest(), "127.0.0.1"));
    }

    @Test
    @DisplayName("Debit callback rejects invalid signature")
    void testDebitCallbackInvalidSignature() {
        String rawBody = "{\"amount\":100.0,\"transactionStatus\":\"I\",\"fpTransactionId\":\"FP001\"}";
        FingpayCmsDtos.DebitCallbackResponse resp = fingpayCmsService.processDebitCallback(rawBody, "invalid-hash", "127.0.0.1");

        assertNotNull(resp);
        assertFalse(resp.getStatus());
        assertEquals("Invalid authentication signature", resp.getErrorMessage());
    }

    @Test
    @DisplayName("Debit callback Initiation success with sufficient wallet balance")
    void testDebitCallbackInitiationSuccess() {
        String fpTxnId = "FP00187352S";
        String rawBody = "{\"amount\":100.0,\"transactionStatus\":\"I\",\"fpTransactionId\":\"" + fpTxnId +
                "\",\"typeOfTransaction\":\"CDC\",\"bcLoginId\":\"RPRBR176901\",\"transactionTimestamp\":\"2026-10-24 12:23:56\",\"errorMessage\":\"Transaction initiated\",\"remarks\":\"\"}";

        String validHash = fingpayCmsService.computeHash(rawBody + testSecretKey);

        when(cmsTransactionRepository.findByFpTransactionId(fpTxnId)).thenReturn(Optional.empty());
        when(userRepository.findByCmsMerchantId("RPRBR176901")).thenReturn(Optional.of(testUser));

        WalletDtos.WalletBalanceResponse balResp = new WalletDtos.WalletBalanceResponse(
                testUserId.toString(), "Test User", "RPRBR176901", "9679729762", "RETAILER",
                BigDecimal.valueOf(5000.00), BigDecimal.ZERO, BigDecimal.valueOf(5000.00), BigDecimal.ZERO, "ACTIVE", "RPRBR176901");
        when(walletService.getBalance(testUserId.toString())).thenReturn(balResp);

        when(walletService.debitForService(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(balResp);

        FingpayCmsDtos.DebitCallbackResponse resp = fingpayCmsService.processDebitCallback(rawBody, validHash, "127.0.0.1");

        assertNotNull(resp);
        assertTrue(resp.getStatus());
        assertNotNull(resp.getMerchantTransactionId());
        assertTrue(resp.getMerchantTransactionId().startsWith("RXCMS"));

        verify(walletService, times(1)).debitForService(
                eq(testUserId), eq(BigDecimal.valueOf(100.0)), anyString(), eq(WalletTransactionContext.CMS_DEBIT), eq("CMS"), anyString(), eq(fpTxnId));
        verify(txnRepository, times(1)).save(any(Txn.class));
        verify(cmsTransactionRepository, times(1)).save(any(FingpayCmsTransaction.class));
    }

    @Test
    @DisplayName("Debit callback Initiation rejected when insufficient balance")
    void testDebitCallbackInitiationInsufficientBalance() {
        String fpTxnId = "FP00187353S";
        String rawBody = "{\"amount\":1000.0,\"transactionStatus\":\"I\",\"fpTransactionId\":\"" + fpTxnId +
                "\",\"typeOfTransaction\":\"CDC\",\"bcLoginId\":\"RPRBR176901\",\"transactionTimestamp\":\"2026-10-24 12:23:56\",\"errorMessage\":\"Transaction initiated\",\"remarks\":\"\"}";

        String validHash = fingpayCmsService.computeHash(rawBody + testSecretKey);

        when(cmsTransactionRepository.findByFpTransactionId(fpTxnId)).thenReturn(Optional.empty());
        when(userRepository.findByCmsMerchantId("RPRBR176901")).thenReturn(Optional.of(testUser));

        WalletDtos.WalletBalanceResponse balResp = new WalletDtos.WalletBalanceResponse(
                testUserId.toString(), "Test User", "RPRBR176901", "9679729762", "RETAILER",
                BigDecimal.valueOf(50.00), BigDecimal.ZERO, BigDecimal.valueOf(50.00), BigDecimal.ZERO, "ACTIVE", "RPRBR176901");
        when(walletService.getBalance(testUserId.toString())).thenReturn(balResp);

        FingpayCmsDtos.DebitCallbackResponse resp = fingpayCmsService.processDebitCallback(rawBody, validHash, "127.0.0.1");

        assertNotNull(resp);
        assertFalse(resp.getStatus());
        assertEquals("Insufficient BC wallet balance", resp.getErrorMessage());

        // Wallet must NOT be debited
        verify(walletService, never()).debitForService(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Debit callback idempotent on duplicate initiation")
    void testDebitCallbackDuplicateInitiation() {
        String fpTxnId = "FP00187354S";
        String rawBody = "{\"amount\":100.0,\"transactionStatus\":\"I\",\"fpTransactionId\":\"" + fpTxnId +
                "\",\"typeOfTransaction\":\"CDC\",\"bcLoginId\":\"RPRBR176901\",\"transactionTimestamp\":\"2026-10-24 12:23:56\",\"errorMessage\":\"Transaction initiated\",\"remarks\":\"\"}";

        String validHash = fingpayCmsService.computeHash(rawBody + testSecretKey);

        FingpayCmsTransaction existing = new FingpayCmsTransaction();
        existing.setFpTransactionId(fpTxnId);
        existing.setMerchantTransactionId("RXCMS_PREV_123");
        existing.setInternalStatus("INITIATED");
        existing.setUser(testUser);

        when(cmsTransactionRepository.findByFpTransactionId(fpTxnId)).thenReturn(Optional.of(existing));

        FingpayCmsDtos.DebitCallbackResponse resp = fingpayCmsService.processDebitCallback(rawBody, validHash, "127.0.0.1");

        assertNotNull(resp);
        assertTrue(resp.getStatus());
        assertEquals("RXCMS_PREV_123", resp.getMerchantTransactionId());

        // Zero additional debits performed
        verify(walletService, never()).debitForService(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Debit callback failure triggers idempotent refund if previously debited")
    void testDebitCallbackFailureRefundsWallet() {
        String fpTxnId = "FP00187355S";
        String rawBody = "{\"amount\":100.0,\"transactionStatus\":\"F\",\"fpTransactionId\":\"" + fpTxnId +
                "\",\"merchantTransactionId\":\"RXCMS_123\",\"typeOfTransaction\":\"CDC\",\"bcLoginId\":\"RPRBR176901\",\"transactionTimestamp\":\"2026-10-24 12:23:56\",\"errorMessage\":\"Provider error\",\"remarks\":\"\"}";

        String validHash = fingpayCmsService.computeHash(rawBody + testSecretKey);

        FingpayCmsTransaction existing = new FingpayCmsTransaction();
        existing.setFpTransactionId(fpTxnId);
        existing.setMerchantTransactionId("RXCMS_123");
        existing.setInternalStatus("INITIATED");
        existing.setAmount(BigDecimal.valueOf(100.0));
        existing.setWalletEntryId(UUID.randomUUID()); // was debited
        existing.setUser(testUser);

        when(cmsTransactionRepository.findByFpTransactionId(fpTxnId)).thenReturn(Optional.of(existing));

        FingpayCmsDtos.DebitCallbackResponse resp = fingpayCmsService.processDebitCallback(rawBody, validHash, "127.0.0.1");

        assertNotNull(resp);
        assertTrue(resp.getStatus());
        assertEquals("received", resp.getErrorMessage());
        assertEquals("FAILED", existing.getInternalStatus());

        // Verify refund was dispatched idempotently
        verify(walletService, times(1)).refundForService(
                eq(testUserId), eq(BigDecimal.valueOf(100.0)), anyString(), eq(fpTxnId), eq(WalletTransactionContext.CMS_REFUND), eq("CMS"), anyString(), anyString());
    }

    @Test
    @DisplayName("Balance check callback returns authoritative user balance")
    void testBalanceCheckCallbackSuccess() {
        String rawBody = "{\"bcLoginIds\":[\"RPRBR176901\",\"UNKNOWN_BC\"]}";
        String validHash = fingpayCmsService.computeHash(rawBody + testSecretKey);

        when(userRepository.findByCmsMerchantId("RPRBR176901")).thenReturn(Optional.of(testUser));
        when(userRepository.findByCmsMerchantId("UNKNOWN_BC")).thenReturn(Optional.empty());

        Wallet wallet = new Wallet();
        wallet.setBalance(BigDecimal.valueOf(12500.50));
        when(walletRepository.findByUserId(testUserId)).thenReturn(Optional.of(wallet));

        FingpayCmsDtos.BalanceCheckResponse resp = fingpayCmsService.processBalanceCheck(rawBody, validHash, "127.0.0.1");

        assertNotNull(resp);
        assertTrue(resp.getStatus());
        assertEquals(2, resp.getBcBalances().size());

        FingpayCmsDtos.BcBalanceItem item1 = resp.getBcBalances().get(0);
        assertEquals("RPRBR176901", item1.getBcLoginId());
        assertEquals(12500.50, item1.getBalance());

        FingpayCmsDtos.BcBalanceItem item2 = resp.getBcBalances().get(1);
        assertEquals("UNKNOWN_BC", item2.getBcLoginId());
        assertEquals(0.00, item2.getBalance());
    }
}
