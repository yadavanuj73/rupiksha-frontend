package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.BbpsDtos;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.integration.bbps.BillAvenueClient;
import com.rupiksha.backend.integration.bbps.BillAvenueTimeoutException;
import com.rupiksha.backend.integration.bbps.dto.BillAvenueDtos;
import com.rupiksha.backend.repository.BbpsTransactionRepository;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.UserServiceRepository;
import com.rupiksha.backend.service.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BbpsServiceImplTest {

    @Mock
    private BillAvenueClient billAvenueClient;

    @Mock
    private BbpsTransactionRepository bbpsTransactionRepository;

    @Mock
    private TxnRepository txnRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserServiceRepository userServiceRepository;

    @Mock
    private WalletService walletService;

    @Mock
    private com.rupiksha.backend.service.CommissionService commissionService;

    @org.mockito.Spy
    private com.rupiksha.backend.integration.bbps.ElectricityBillerRegistry electricityBillerRegistry =
            new com.rupiksha.backend.integration.bbps.ElectricityBillerRegistry();

    @org.mockito.Spy
    private com.rupiksha.backend.integration.bbps.LoanBillerRegistry loanBillerRegistry =
            new com.rupiksha.backend.integration.bbps.LoanBillerRegistry();

    @org.mockito.Spy
    private com.rupiksha.backend.integration.bbps.CreditCardBillerRegistry creditCardBillerRegistry =
            new com.rupiksha.backend.integration.bbps.CreditCardBillerRegistry();

    @org.mockito.Spy
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper =
            new com.fasterxml.jackson.databind.ObjectMapper();

    @InjectMocks
    private BbpsServiceImpl bbpsService;

    private UUID userId;
    private User testUser;
    private BbpsDtos.RechargeRequest validRequest;

    private WalletDtos.WalletBalanceResponse mockBalance(BigDecimal balance, BigDecimal available) {
        return new WalletDtos.WalletBalanceResponse(
                userId.toString(),
                "Test Retailer",
                "testretailer",
                "9876543210",
                "RETAILER",
                balance,
                BigDecimal.ZERO,
                available,
                BigDecimal.ZERO,
                "ACTIVE"
        );
    }

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        testUser = new User();
        testUser.setId(userId);
        testUser.setMobile("9876543210");
        testUser.setFullName("Test Retailer");

        validRequest = new BbpsDtos.RechargeRequest();
        validRequest.setMobileNumber("9876543210");
        validRequest.setBillerId("BILAVAIRTEL001");
        validRequest.setCircle("Bihar & Jharkhand");
        validRequest.setAmount(new BigDecimal("299.00"));
        validRequest.setIdempotencyKey("IDEM-TEST-123");
    }

    @Test
    @DisplayName("Successful Mobile Prepaid Recharge with sufficient balance and provider confirmation")
    void testSuccessfulRecharge() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty()); // default enabled
        when(bbpsTransactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        // Balance check: user has ₹1,000 available
        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("1000.00"), new BigDecimal("1000.00")));

        when(txnRepository.save(any(Txn.class))).thenAnswer(i -> {
            Txn t = i.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        when(bbpsTransactionRepository.save(any(BbpsTransaction.class))).thenAnswer(i -> {
            BbpsTransaction b = i.getArgument(0);
            if (b.getId() == null) b.setId(UUID.randomUUID());
            return b;
        });

        when(walletService.debitForService(eq(userId), eq(new BigDecimal("299.00")), anyString(), eq(WalletTransactionContext.BBPS_PAYMENT), eq("BBPS"), anyString(), anyString()))
                .thenReturn(mockBalance(new BigDecimal("701.00"), new BigDecimal("701.00")));

        // Provider response: 000 Successful
        BillAvenueDtos.BillPayResponse payResp = new BillAvenueDtos.BillPayResponse();
        payResp.setResponseCode("000");
        payResp.setResponseReason("Successful");
        payResp.setTxnRefId("CC013194BAAE00044817");
        payResp.setApprovalRefNumber("AB123456");

        when(billAvenueClient.payBillXml(any())).thenReturn(payResp);

        BbpsDtos.RechargeResponse result = bbpsService.recharge(userId, validRequest, "127.0.0.1");

        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals("SUCCESS", result.getStatus());
        assertEquals("CC013194BAAE00044817", result.getProviderTxnId());
        assertEquals("AB123456", result.getApprovalRefNo());

        // Verify debit happened and no refund was triggered
        verify(walletService, times(1)).debitForService(eq(userId), eq(new BigDecimal("299.00")), anyString(), any(), anyString(), anyString(), anyString());
        verify(walletService, never()).refundForService(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Jio recharge resolves to 14-char billerId and excludes Location input parameter")
    void testJioRechargeParameters() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());
        when(bbpsTransactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("1000.00"), new BigDecimal("1000.00")));

        when(txnRepository.save(any(Txn.class))).thenAnswer(i -> {
            Txn t = i.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        when(bbpsTransactionRepository.save(any(BbpsTransaction.class))).thenAnswer(i -> {
            BbpsTransaction b = i.getArgument(0);
            if (b.getId() == null) b.setId(UUID.randomUUID());
            return b;
        });

        when(walletService.debitForService(eq(userId), eq(new BigDecimal("198.00")), anyString(), eq(WalletTransactionContext.BBPS_PAYMENT), eq("BBPS"), anyString(), anyString()))
                .thenReturn(mockBalance(new BigDecimal("802.00"), new BigDecimal("802.00")));

        BillAvenueDtos.BillPayResponse payResp = new BillAvenueDtos.BillPayResponse();
        payResp.setResponseCode("000");
        payResp.setResponseReason("Successful");
        payResp.setTxnRefId("CC015062BAAE00071903");
        payResp.setApprovalRefNumber("AB123456");

        org.mockito.ArgumentCaptor<BillAvenueDtos.BillPayXmlRequest> captor =
                org.mockito.ArgumentCaptor.forClass(BillAvenueDtos.BillPayXmlRequest.class);
        when(billAvenueClient.payBillXml(captor.capture())).thenReturn(payResp);

        BbpsDtos.RechargeRequest jioRequest = new BbpsDtos.RechargeRequest();
        jioRequest.setBillerId("JIO");
        jioRequest.setMobileNumber("8459824211");
        jioRequest.setAmount(new BigDecimal("198.00"));
        jioRequest.setCircle("Maharashtra & Goa");
        jioRequest.setIdempotencyKey("JIO-TEST-198");

        BbpsDtos.RechargeResponse result = bbpsService.recharge(userId, jioRequest, "103.108.7.127");

        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals("SUCCESS", result.getStatus());

        BillAvenueDtos.BillPayXmlRequest captured = captor.getValue();
        assertEquals("BILAVJIO000001", captured.getBillerId(), "Jio billerId must resolve to BILAVJIO000001");
        assertEquals(19800L, captured.getAmountPaise(), "Amount in paise must be 19800");
        // Verify input params contains Mobile Number and NOT Location
        assertNotNull(captured.getInputParams());
        boolean hasLocation = captured.getInputParams().stream().anyMatch(p -> "Location".equalsIgnoreCase(p.getParamName()));
        assertFalse(hasLocation, "Jio must NOT have Location param to prevent Code 202 error");
        boolean hasMobile = captured.getInputParams().stream().anyMatch(p -> "Mobile Number".equalsIgnoreCase(p.getParamName()) && "8459824211".equals(p.getParamValue()));
        assertTrue(hasMobile, "Jio must have Mobile Number param");
    }

    @Test
    @DisplayName("Insufficient balance blocks wallet debit and prevents calling provider")
    void testInsufficientBalance() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());
        when(bbpsTransactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        // Balance is only ₹50, while requested amount is ₹299
        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("50.00"), new BigDecimal("50.00")));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> bbpsService.recharge(userId, validRequest, "127.0.0.1"));

        assertTrue(ex.getMessage().contains("Insufficient wallet balance"));

        // Provider must NEVER be called, wallet must NEVER be debited
        verify(billAvenueClient, never()).payBillXml(any());
        verify(walletService, never()).debitForService(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Confirmed provider failure triggers single idempotent refund")
    void testProviderFailureTriggersRefund() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());
        when(bbpsTransactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("1000.00"), new BigDecimal("1000.00")));

        when(txnRepository.save(any(Txn.class))).thenAnswer(i -> {
            Txn t = i.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        when(bbpsTransactionRepository.save(any(BbpsTransaction.class))).thenAnswer(i -> {
            BbpsTransaction b = i.getArgument(0);
            if (b.getId() == null) b.setId(UUID.randomUUID());
            return b;
        });

        // Provider returns error code E031
        BillAvenueDtos.BillPayResponse failResp = new BillAvenueDtos.BillPayResponse();
        failResp.setResponseCode("001");
        failResp.setResponseReason("Failure");
        BillAvenueDtos.ErrorInfo err = new BillAvenueDtos.ErrorInfo();
        err.setErrorCode("E031");
        err.setErrorMessage("Invalid subscriber or operator down");
        failResp.setErrorInfo(List.of(err));

        when(billAvenueClient.payBillXml(any())).thenReturn(failResp);

        BbpsDtos.RechargeResponse result = bbpsService.recharge(userId, validRequest, "127.0.0.1");

        assertNotNull(result);
        assertFalse(result.isSuccess());
        assertEquals("FAILED", result.getStatus());
        assertTrue(result.getMessage().contains("refunded"));

        // Verify exactly one debit and exactly one refund
        verify(walletService, times(1)).debitForService(eq(userId), eq(new BigDecimal("299.00")), anyString(), any(), anyString(), anyString(), anyString());
        verify(walletService, times(1)).refundForService(eq(userId), eq(new BigDecimal("299.00")), anyString(), anyString(), eq(WalletTransactionContext.REVERSAL), eq("BBPS"), anyString(), anyString());
    }

    @Test
    @DisplayName("Provider timeout keeps transaction PENDING and does NOT immediately refund")
    void testProviderTimeoutKeepsPending() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());
        when(bbpsTransactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("1000.00"), new BigDecimal("1000.00")));

        when(txnRepository.save(any(Txn.class))).thenAnswer(i -> {
            Txn t = i.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        when(bbpsTransactionRepository.save(any(BbpsTransaction.class))).thenAnswer(i -> {
            BbpsTransaction b = i.getArgument(0);
            if (b.getId() == null) b.setId(UUID.randomUUID());
            return b;
        });

        // Provider times out
        when(billAvenueClient.payBillXml(any())).thenThrow(new BillAvenueTimeoutException("Read timed out", new RuntimeException()));

        BbpsDtos.RechargeResponse result = bbpsService.recharge(userId, validRequest, "127.0.0.1");

        assertNotNull(result);
        assertFalse(result.isSuccess());
        assertEquals("PENDING", result.getStatus());

        // Must NOT issue refund on timeout
        verify(walletService, never()).refundForService(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Idempotency key duplicate returns existing transaction without second debit or provider call")
    void testIdempotencyDuplicateHandling() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());

        BbpsTransaction existing = new BbpsTransaction();
        existing.setId(UUID.randomUUID());
        existing.setMerchantRefNo("BBPS-MP-EXISTING");
        existing.setProviderTxnId("CC019999");
        existing.setStatus("SUCCESS");
        existing.setAmount(new BigDecimal("299.00"));
        existing.setMobileNumber("9876543210");
        existing.setBillerName("Airtel");
        existing.setCreatedAt(Instant.now());

        when(bbpsTransactionRepository.findByIdempotencyKey("IDEM-TEST-123")).thenReturn(Optional.of(existing));
        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("701.00"), new BigDecimal("701.00")));

        BbpsDtos.RechargeResponse result = bbpsService.recharge(userId, validRequest, "127.0.0.1");

        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals("SUCCESS", result.getStatus());
        assertEquals("CC019999", result.getProviderTxnId());

        // Zero additional debits and zero provider calls
        verify(walletService, never()).debitForService(any(), any(), any(), any(), any(), any(), any());
        verify(billAvenueClient, never()).payBillXml(any());
    }

    @Test
    @DisplayName("Electricity DISCOM catalogue is accessible and filters by state")
    void testElectricityBillerList() {
        List<BbpsDtos.ElectricityBillerInfo> allBillers = bbpsService.getElectricityBillers(null);
        assertNotNull(allBillers);
        assertTrue(allBillers.size() >= 30, "Should have 30+ DISCOMs configured");

        List<BbpsDtos.ElectricityBillerInfo> mhBillers = bbpsService.getElectricityBillers("Maharashtra");
        assertNotNull(mhBillers);
        assertFalse(mhBillers.isEmpty());
        assertTrue(mhBillers.stream().anyMatch(b -> b.getBillerId().equals("MSED00000MAH01")));
        assertTrue(mhBillers.stream().allMatch(b -> "Maharashtra".equalsIgnoreCase(b.getState())));
    }

    @Test
    @DisplayName("Fetch electricity bill succeeds and extracts bill amount and customer details")
    void testElectricityFetchBillSuccess() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());

        BillAvenueDtos.BillFetchResponse fetchResponse = new BillAvenueDtos.BillFetchResponse();
        fetchResponse.setResponseCode("000");
        fetchResponse.setFetchRequestId("REQ-FETCH-998877");
        fetchResponse.setBillAmountPaise(157700L); // ₹1,577.00
        fetchResponse.setCustomerName("Ramesh Agrawal");
        fetchResponse.setBillNumber("BILL-2026-9088");
        fetchResponse.setBillDate("2026-10-10");
        fetchResponse.setDueDate("2026-10-25");
        fetchResponse.setBillPeriod("Monthly");

        when(billAvenueClient.fetchBill(any(), any(), any(), any())).thenReturn(fetchResponse);

        BbpsDtos.ElectricityFetchRequest request = new BbpsDtos.ElectricityFetchRequest();
        request.setBillerId("MSED00000MAH01");
        request.setCustomerMobile("9892506507");
        request.setCustomerParams(java.util.Map.of(
                "Consumer Number", "053000020111",
                "Billing Unit (BU)", "4102"
        ));

        BbpsDtos.BillFetchResult result = bbpsService.fetchElectricityBill(userId, request, "127.0.0.1");

        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals("053000020111", result.getConsumerNumber());
        assertEquals("Ramesh Agrawal", result.getCustomerName());
        assertEquals(new BigDecimal("1577.00"), result.getBillAmount());
        assertEquals("BILL-2026-9088", result.getBillNumber());
        assertEquals("2026-10-25", result.getDueDate());
        assertNotNull(result.getFetchRequestId());
    }

    @Test
    @DisplayName("Electricity bill fetch handles BFR004 (Payment received / no bill due) as verified zero-due state")
    void testElectricityFetchNoBillDueBFR004() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());

        BillAvenueDtos.BillFetchResponse fetchResponse = new BillAvenueDtos.BillFetchResponse();
        fetchResponse.setResponseCode("001");
        fetchResponse.setFetchRequestId("REQ-FETCH-BFR004-123");
        fetchResponse.setBillAmountPaise(0L);
        fetchResponse.setCustomerName("RABINDRA PRASAD YADAV");
        fetchResponse.setErrorInfo(java.util.List.of(
                new BillAvenueDtos.ErrorInfo("BFR004", "Payment received for the billing period - no bill due")
        ));

        when(billAvenueClient.fetchBill(any(), any(), any(), any())).thenReturn(fetchResponse);

        BbpsDtos.ElectricityFetchRequest request = new BbpsDtos.ElectricityFetchRequest();
        request.setBillerId("NBPDCL000BHI01");
        request.setCustomerMobile("8004480444");
        request.setCustomerParams(java.util.Map.of("CA Number", "12720113063"));

        BbpsDtos.BillFetchResult result = bbpsService.fetchElectricityBill(userId, request, "127.0.0.1");

        assertNotNull(result);
        assertTrue(result.isSuccess(), "Result should be marked successful when no bill is due");
        assertTrue(result.isNoBillDue(), "noBillDue should be true");
        assertEquals("12720113063", result.getConsumerNumber());
        assertEquals("RABINDRA PRASAD YADAV", result.getCustomerName(), "Must return real electricity connection holder name, not the retailer's name");
        assertEquals(BigDecimal.ZERO, result.getBillAmount());
        assertEquals("Payment received for the billing period - no bill due", result.getMessage());
        assertNull(result.getErrorCode());
    }

    @Test
    @DisplayName("Electricity bill payment succeeds with wallet debit and fetchRequestId binding")
    void testElectricityPaySuccess() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());
        when(bbpsTransactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("2000.00"), new BigDecimal("2000.00")));

        when(txnRepository.save(any(Txn.class))).thenAnswer(i -> {
            Txn t = i.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        when(bbpsTransactionRepository.save(any(BbpsTransaction.class))).thenAnswer(i -> {
            BbpsTransaction b = i.getArgument(0);
            if (b.getId() == null) b.setId(UUID.randomUUID());
            return b;
        });

        when(walletService.debitForService(eq(userId), eq(new BigDecimal("1577.00")), anyString(), eq(WalletTransactionContext.BBPS_PAYMENT), eq("BBPS"), anyString(), anyString()))
                .thenReturn(mockBalance(new BigDecimal("423.00"), new BigDecimal("423.00")));

        BillAvenueDtos.BillPayResponse payResp = new BillAvenueDtos.BillPayResponse();
        payResp.setResponseCode("000");
        payResp.setResponseReason("Successful");
        payResp.setTxnRefId("CC015267CBAA49221245");
        payResp.setApprovalRefNumber("AB123456");

        org.mockito.ArgumentCaptor<BillAvenueDtos.BillPayXmlRequest> captor =
                org.mockito.ArgumentCaptor.forClass(BillAvenueDtos.BillPayXmlRequest.class);
        when(billAvenueClient.payBillXml(captor.capture())).thenReturn(payResp);

        BbpsDtos.ElectricityPayRequest payRequest = new BbpsDtos.ElectricityPayRequest();
        payRequest.setBillerId("MSED00000MAH01");
        payRequest.setCustomerMobile("9892506507");
        payRequest.setAmount(new BigDecimal("1577.00"));
        payRequest.setFetchRequestId("REQ-FETCH-998877");
        payRequest.setIdempotencyKey("ELEC-IDEM-001");
        payRequest.setCustomerName("Ramesh Agrawal");
        payRequest.setBillNumber("BILL-2026-9088");
        payRequest.setDueDate("2026-10-25");
        payRequest.setCustomerParams(java.util.Map.of(
                "Consumer Number", "053000020111",
                "Billing Unit (BU)", "4102"
        ));

        BbpsDtos.ElectricityPayResponse response = bbpsService.payElectricityBill(userId, payRequest, "192.168.1.100");

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals("SUCCESS", response.getStatus());
        assertEquals("CC015267CBAA49221245", response.getProviderTxnId());
        assertEquals("AB123456", response.getApprovalRefNo());
        assertEquals("053000020111", response.getConsumerNumber());
        assertEquals("Ramesh Agrawal", response.getCustomerName());

        // Verify request payload sent to BillAvenue
        BillAvenueDtos.BillPayXmlRequest captured = captor.getValue();
        assertEquals("MSED00000MAH01", captured.getBillerId());
        assertEquals(157700L, captured.getAmountPaise());
        assertEquals("REQ-FETCH-998877", captured.getFetchRequestId(), "Must bind same requestId from bill fetch as required by doc");
        assertEquals("Cash", captured.getPaymentMode());

        verify(walletService, times(1)).debitForService(eq(userId), eq(new BigDecimal("1577.00")), anyString(), any(), anyString(), anyString(), anyString());
        verify(walletService, never()).refundForService(any(), any(), any(), any(), any(), any(), any(), any());
        verify(commissionService, times(1)).processBbpsCommission(any(BbpsTransaction.class));
    }

    @Test
    @DisplayName("Electricity payment fails pre-check when wallet balance is insufficient")
    void testElectricityPayInsufficientBalance() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());
        when(bbpsTransactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        // Balance is ₹500, bill is ₹1,577
        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("500.00"), new BigDecimal("500.00")));

        BbpsDtos.ElectricityPayRequest payRequest = new BbpsDtos.ElectricityPayRequest();
        payRequest.setBillerId("MSED00000MAH01");
        payRequest.setCustomerMobile("9892506507");
        payRequest.setAmount(new BigDecimal("1577.00"));
        payRequest.setIdempotencyKey("ELEC-INSUFF-001");
        payRequest.setCustomerParams(java.util.Map.of("Consumer Number", "053000020111", "Billing Unit (BU)", "4102"));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> bbpsService.payElectricityBill(userId, payRequest, "127.0.0.1"));

        assertTrue(ex.getMessage().contains("Insufficient wallet balance"));

        verify(walletService, never()).debitForService(any(), any(), any(), any(), any(), any(), any());
        verify(billAvenueClient, never()).payBillXml(any());
    }

    @Test
    @DisplayName("Electricity payment confirmed failure triggers single refund to wallet")
    void testElectricityPayFailureRefund() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());
        when(bbpsTransactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("2000.00"), new BigDecimal("2000.00")));

        when(txnRepository.save(any(Txn.class))).thenAnswer(i -> {
            Txn t = i.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        when(bbpsTransactionRepository.save(any(BbpsTransaction.class))).thenAnswer(i -> {
            BbpsTransaction b = i.getArgument(0);
            if (b.getId() == null) b.setId(UUID.randomUUID());
            return b;
        });

        BillAvenueDtos.BillPayResponse failResp = new BillAvenueDtos.BillPayResponse();
        failResp.setResponseCode("001");
        failResp.setResponseReason("Failure");
        BillAvenueDtos.ErrorInfo err = new BillAvenueDtos.ErrorInfo();
        err.setErrorCode("E049");
        err.setErrorMessage("Biller system unavailable");
        failResp.setErrorInfo(List.of(err));

        when(billAvenueClient.payBillXml(any())).thenReturn(failResp);

        BbpsDtos.ElectricityPayRequest payRequest = new BbpsDtos.ElectricityPayRequest();
        payRequest.setBillerId("MSED00000MAH01");
        payRequest.setCustomerMobile("9892506507");
        payRequest.setAmount(new BigDecimal("1577.00"));
        payRequest.setIdempotencyKey("ELEC-FAIL-001");
        payRequest.setCustomerParams(java.util.Map.of("Consumer Number", "053000020111", "Billing Unit (BU)", "4102"));

        BbpsDtos.ElectricityPayResponse response = bbpsService.payElectricityBill(userId, payRequest, "127.0.0.1");

        assertNotNull(response);
        assertFalse(response.isSuccess());
        assertEquals("FAILED", response.getStatus());
        assertTrue(response.getMessage().contains("refunded"));

        verify(walletService, times(1)).debitForService(eq(userId), eq(new BigDecimal("1577.00")), anyString(), any(), anyString(), anyString(), anyString());
        verify(walletService, times(1)).refundForService(eq(userId), eq(new BigDecimal("1577.00")), anyString(), anyString(), eq(WalletTransactionContext.REVERSAL), eq("BBPS"), anyString(), anyString());
    }

    @Test
    @DisplayName("Electricity payment timeout keeps transaction PENDING and does NOT refund immediately")
    void testElectricityPayTimeoutKeepsPending() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());
        when(bbpsTransactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("2000.00"), new BigDecimal("2000.00")));

        when(txnRepository.save(any(Txn.class))).thenAnswer(i -> {
            Txn t = i.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        when(bbpsTransactionRepository.save(any(BbpsTransaction.class))).thenAnswer(i -> {
            BbpsTransaction b = i.getArgument(0);
            if (b.getId() == null) b.setId(UUID.randomUUID());
            return b;
        });

        when(billAvenueClient.payBillXml(any())).thenThrow(new BillAvenueTimeoutException("Read timed out", new RuntimeException()));

        BbpsDtos.ElectricityPayRequest payRequest = new BbpsDtos.ElectricityPayRequest();
        payRequest.setBillerId("MSED00000MAH01");
        payRequest.setCustomerMobile("9892506507");
        payRequest.setAmount(new BigDecimal("1577.00"));
        payRequest.setIdempotencyKey("ELEC-TIMEOUT-001");
        payRequest.setCustomerParams(java.util.Map.of("Consumer Number", "053000020111", "Billing Unit (BU)", "4102"));

        BbpsDtos.ElectricityPayResponse response = bbpsService.payElectricityBill(userId, payRequest, "127.0.0.1");

        assertNotNull(response);
        assertFalse(response.isSuccess());
        assertEquals("PENDING", response.getStatus());

        // Zero refunds on ambiguous timeout
        verify(walletService, never()).refundForService(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Loan lenders catalogue is accessible and filters by search")
    void testLoanBillerList() {
        List<BbpsDtos.LoanBillerInfo> allBillers = bbpsService.getLoanBillers(null);
        assertNotNull(allBillers);
        assertTrue(allBillers.size() >= 30, "Should have 30+ lenders/NBFCs configured");

        List<BbpsDtos.LoanBillerInfo> bajajBillers = bbpsService.getLoanBillers("Bajaj");
        assertNotNull(bajajBillers);
        assertFalse(bajajBillers.isEmpty());
        assertTrue(bajajBillers.stream().anyMatch(b -> b.getBillerId().equals("BFL000000NAT01")));

        List<BbpsDtos.LoanBillerInfo> muthoot = bbpsService.getLoanBillers("Muthoot");
        assertNotNull(muthoot);
        assertFalse(muthoot.isEmpty());
        assertTrue(muthoot.stream().anyMatch(b -> b.getBillerId().equals("MUTH00000NATX8")));

        // Search for DMI Finance
        List<BbpsDtos.LoanBillerInfo> dmi = bbpsService.getLoanBillers("DMI");
        assertNotNull(dmi);
        assertFalse(dmi.isEmpty(), "DMI Finance must be found");
        assertTrue(dmi.stream().anyMatch(b -> b.getBillerId().equals("DMIF00000NATMN")));

        // Search for Annapurna Finance Private Limited-MFI exactly as typed by user
        List<BbpsDtos.LoanBillerInfo> annapurnaExact = bbpsService.getLoanBillers("Annapurna Finance Private Limited-MFI");
        assertNotNull(annapurnaExact);
        assertFalse(annapurnaExact.isEmpty(), "Annapurna Finance Private Limited-MFI must be found");
        assertTrue(annapurnaExact.stream().anyMatch(b -> b.getBillerId().equals("ANNA00000NATUO")));

        // Search by partial text
        List<BbpsDtos.LoanBillerInfo> annapurnaPartial = bbpsService.getLoanBillers("Annapurna");
        assertNotNull(annapurnaPartial);
        assertFalse(annapurnaPartial.isEmpty());
        assertTrue(annapurnaPartial.stream().anyMatch(b -> b.getBillerId().equals("ANNA00000NATUO")));
    }

    @Test
    @DisplayName("Fetch loan bill succeeds and extracts bill amount, loan account, and borrower name")
    void testLoanFetchBillSuccess() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());

        BillAvenueDtos.BillFetchResponse fetchResponse = new BillAvenueDtos.BillFetchResponse();
        fetchResponse.setResponseCode("000");
        fetchResponse.setFetchRequestId("REQ-LOAN-FETCH-1122");
        fetchResponse.setBillAmountPaise(450000L); // ₹4,500.00
        fetchResponse.setCustomerName("Sunil Sharma");
        fetchResponse.setBillNumber("EMI-OCT-2026");
        fetchResponse.setBillDate("2026-10-05");
        fetchResponse.setDueDate("2026-10-25");
        fetchResponse.setBillPeriod("Monthly EMI");

        when(billAvenueClient.fetchBill(any(), any(), any(), any())).thenReturn(fetchResponse);

        BbpsDtos.LoanFetchRequest request = new BbpsDtos.LoanFetchRequest();
        request.setBillerId("BFL000000NAT01");
        request.setCustomerMobile("9892506507");
        request.setCustomerParams(java.util.Map.of("Loan Account Number", "LAN9988776655"));

        BbpsDtos.BillFetchResult result = bbpsService.fetchLoanBill(userId, request, "127.0.0.1");

        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertFalse(result.isNoBillDue());
        assertEquals("BFL000000NAT01", result.getBillerId());
        assertEquals("Bajaj Finance Limited", result.getBillerName());
        assertEquals(new BigDecimal("4500.00"), result.getBillAmount());
        assertEquals("Sunil Sharma", result.getCustomerName());
        assertEquals("LAN9988776655", result.getConsumerNumber());
        assertEquals("REQ-LOAN-FETCH-1122", result.getFetchRequestId());
    }

    @Test
    @DisplayName("Loan repayment payment succeeds with wallet debit and fetchRequestId binding")
    void testLoanPaySuccess() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());
        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("10000.00"), new BigDecimal("10000.00")));

        when(txnRepository.save(any(Txn.class))).thenAnswer(invocation -> {
            Txn t = invocation.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        when(bbpsTransactionRepository.save(any(BbpsTransaction.class))).thenAnswer(invocation -> {
            BbpsTransaction b = invocation.getArgument(0);
            if (b.getId() == null) b.setId(UUID.randomUUID());
            if (b.getCreatedAt() == null) b.setCreatedAt(java.time.Instant.now());
            return b;
        });

        BillAvenueDtos.BillPayResponse payResponse = new BillAvenueDtos.BillPayResponse();
        payResponse.setResponseCode("000");
        payResponse.setResponseReason("Successful");
        payResponse.setTxnRefId("BA-LOAN-REF-100200");
        payResponse.setApprovalRefNumber("APR-LN-999");

        when(billAvenueClient.payBillXml(any())).thenReturn(payResponse);

        BbpsDtos.LoanPayRequest payRequest = new BbpsDtos.LoanPayRequest();
        payRequest.setBillerId("BFL000000NAT01");
        payRequest.setCustomerMobile("9892506507");
        payRequest.setAmount(new BigDecimal("4500.00"));
        payRequest.setFetchRequestId("REQ-LOAN-FETCH-1122");
        payRequest.setIdempotencyKey("LOAN-IDEMP-001");
        payRequest.setCustomerParams(java.util.Map.of("Loan Account Number", "LAN9988776655"));
        payRequest.setCustomerName("Sunil Sharma");
        payRequest.setBillNumber("EMI-OCT-2026");
        payRequest.setDueDate("2026-10-25");

        BbpsDtos.LoanPayResponse response = bbpsService.payLoan(userId, payRequest, "192.168.1.100");

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals("SUCCESS", response.getStatus());
        assertEquals("BA-LOAN-REF-100200", response.getProviderTxnId());
        assertEquals("APR-LN-999", response.getApprovalRefNo());
        assertEquals(new BigDecimal("4500.00"), response.getAmount());
        assertEquals("LAN9988776655", response.getLoanAccountNumber());

        // Verify debit happened with correct amount
        verify(walletService, times(1)).debitForService(
                eq(userId),
                eq(new BigDecimal("4500.00")),
                contains("LAN9988776655"),
                any(), any(), any(), any()
        );

        // Verify XML payment request bound the fetchRequestId
        verify(billAvenueClient, times(1)).payBillXml(argThat(req ->
                "REQ-LOAN-FETCH-1122".equals(req.getFetchRequestId()) &&
                "BFL000000NAT01".equals(req.getBillerId()) &&
                req.getAmountPaise() == 450000L &&
                "Cash".equals(req.getPaymentMode())
        ));
    }

    @Test
    @DisplayName("Loan payment fails pre-check when wallet balance is insufficient")
    void testLoanPayInsufficientBalance() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());
        // Available balance is only ₹100, while loan payment requires ₹5,000
        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("100.00"), new BigDecimal("100.00")));

        BbpsDtos.LoanPayRequest payRequest = new BbpsDtos.LoanPayRequest();
        payRequest.setBillerId("BAJA00000NAT01");
        payRequest.setCustomerMobile("9892506507");
        payRequest.setAmount(new BigDecimal("5000.00"));
        payRequest.setIdempotencyKey("LOAN-INSUFF-001");
        payRequest.setCustomerParams(java.util.Map.of("Loan Account Number", "LAN9988776655"));

        assertThrows(IllegalStateException.class,
                () -> bbpsService.payLoan(userId, payRequest, "127.0.0.1"));

        // Verify zero wallet debits and zero provider calls occurred
        verify(walletService, never()).debitForService(any(), any(), any(), any(), any(), any(), any());
        verify(billAvenueClient, never()).payBillXml(any());
    }

    @Test
    @DisplayName("Loan payment confirmed failure triggers single refund to wallet")
    void testLoanPayFailureRefund() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());
        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("10000.00"), new BigDecimal("10000.00")));

        when(txnRepository.save(any(Txn.class))).thenAnswer(invocation -> {
            Txn t = invocation.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        when(bbpsTransactionRepository.save(any(BbpsTransaction.class))).thenAnswer(invocation -> {
            BbpsTransaction b = invocation.getArgument(0);
            if (b.getId() == null) b.setId(UUID.randomUUID());
            if (b.getCreatedAt() == null) b.setCreatedAt(java.time.Instant.now());
            return b;
        });

        BillAvenueDtos.BillPayResponse failResp = new BillAvenueDtos.BillPayResponse();
        failResp.setResponseCode("201");
        failResp.setResponseReason("FAILURE");
        failResp.setErrorMessage("Loan account closed or invalid");

        when(billAvenueClient.payBillXml(any())).thenReturn(failResp);

        BbpsDtos.LoanPayRequest payRequest = new BbpsDtos.LoanPayRequest();
        payRequest.setBillerId("BAJA00000NAT01");
        payRequest.setCustomerMobile("9892506507");
        payRequest.setAmount(new BigDecimal("2000.00"));
        payRequest.setIdempotencyKey("LOAN-FAIL-001");
        payRequest.setCustomerParams(java.util.Map.of("Loan Account Number", "LAN9988776655"));

        BbpsDtos.LoanPayResponse response = bbpsService.payLoan(userId, payRequest, "127.0.0.1");

        assertNotNull(response);
        assertFalse(response.isSuccess());
        assertEquals("FAILED", response.getStatus());

        // Verify debit AND refund occurred exactly once
        verify(walletService, times(1)).debitForService(eq(userId), eq(new BigDecimal("2000.00")), any(), any(), any(), any(), any());
        verify(walletService, times(1)).refundForService(
                eq(userId),
                eq(new BigDecimal("2000.00")),
                contains("BBPS Recharge Failed Refund"),
                any(), any(), any(), any(), any()
        );
    }

    @Test
    @DisplayName("Annapurna Finance BFR008 (Unable to get bill details) is recognized as noBillDue with active session")
    void testAnnapurnaFinanceBFR008NoBillDue() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());

        BillAvenueDtos.BillFetchResponse bfr008Resp = new BillAvenueDtos.BillFetchResponse();
        bfr008Resp.setResponseCode("001");
        bfr008Resp.setFetchRequestId("REQ-ANNA-25735642");
        bfr008Resp.setErrorInfo(List.of(new BillAvenueDtos.ErrorInfo("BFR008", "Unable to get bill details from Biller")));

        when(billAvenueClient.fetchBill(eq("ANNA00000NATUO"), any(), any(), any())).thenReturn(bfr008Resp);

        BbpsDtos.LoanFetchRequest request = new BbpsDtos.LoanFetchRequest();
        request.setBillerId("ANNA00000NATUO");
        request.setCustomerMobile("9892506507");
        request.setCustomerParams(java.util.Map.of("Loan Account Number", "25735642"));

        BbpsDtos.BillFetchResult result = bbpsService.fetchLoanBill(userId, request, "127.0.0.1");

        assertNotNull(result);
        assertTrue(result.isSuccess(), "BFR008 must be treated as successful account fetch with no bill due");
        assertTrue(result.isNoBillDue(), "noBillDue must be true for BFR008");
        assertEquals("ANNA00000NATUO", result.getBillerId());
        assertEquals("25735642", result.getConsumerNumber());
        assertEquals(BigDecimal.ZERO, result.getBillAmount());
        assertEquals("REQ-ANNA-25735642", result.getFetchRequestId());
    }

    @Test
    @DisplayName("DMI Finance automatically adapts Loan Account Number to Loan ID to satisfy BBPS schema")
    void testDmiFinanceParameterAdaptation() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());

        BillAvenueDtos.BillFetchResponse dmiSuccess = new BillAvenueDtos.BillFetchResponse();
        dmiSuccess.setResponseCode("000");
        dmiSuccess.setFetchRequestId("REQ-DMI-57662896");
        dmiSuccess.setBillAmountPaise(325000L); // ₹3,250.00
        dmiSuccess.setCustomerName("DMI Borrower");

        when(billAvenueClient.fetchBill(eq("DMIF00000NATMN"), any(), any(), any())).thenReturn(dmiSuccess);

        BbpsDtos.LoanFetchRequest request = new BbpsDtos.LoanFetchRequest();
        request.setBillerId("DMIF00000NATMN");
        request.setCustomerMobile("9892506507");
        // User entered "Loan Account Number", which should be mapped to "Loan ID"
        request.setCustomerParams(java.util.Map.of("Loan Account Number", "DMI0057662896"));

        BbpsDtos.BillFetchResult result = bbpsService.fetchLoanBill(userId, request, "127.0.0.1");

        assertNotNull(result);
        assertTrue(result.isSuccess());
        assertEquals("DMIF00000NATMN", result.getBillerId());
        assertEquals("DMI0057662896", result.getConsumerNumber());
        assertEquals(new BigDecimal("3250.00"), result.getBillAmount());

        // Verify that billAvenueClient received "Loan ID" parameter name, not raw "Loan Account Number"
        verify(billAvenueClient).fetchBill(
                eq("DMIF00000NATMN"),
                argThat(inputs -> inputs.stream().anyMatch(i -> "Loan ID".equals(i.getParamName()) && "DMI0057662896".equals(i.getParamValue()))),
                eq("9892506507"),
                any()
        );
    }

    @Test
    @DisplayName("Credit card fetch adapts 16-digit card number and mobile to Last 4 Digits of Credit Card and Registered Mobile No")
    void testCreditCardBillFetchParameterAdaptation() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());

        BillAvenueDtos.BillFetchResponse axisSuccess = new BillAvenueDtos.BillFetchResponse();
        axisSuccess.setResponseCode("000");
        axisSuccess.setFetchRequestId("REQ-AXIS-998877");
        axisSuccess.setBillAmountPaise(1577000L); // ₹15,770.00
        axisSuccess.setCustomerName("Srinivas");
        axisSuccess.setDueDate("2026-11-15");
        axisSuccess.setBillNumber("BILL-AXIS-01");

        when(billAvenueClient.fetchBill(eq("AXIS00000NATKF"), any(), any(), any(), eq("MOB"), any())).thenReturn(axisSuccess);

        BbpsDtos.CreditCardFetchRequest request = new BbpsDtos.CreditCardFetchRequest();
        request.setBillerId("AXIS00000NATKF");
        request.setCustomerMobile("7292987918");
        // User/client supplied "Credit Card Number" and "Mobile Number"
        request.setCustomerParams(java.util.Map.of(
                "Credit Card Number", "6529570000390998",
                "Mobile Number", "7292987918"
        ));

        BbpsDtos.BillFetchResult result = bbpsService.fetchCreditCardBill(userId, request, "127.0.0.1");

        assertNotNull(result);
        assertTrue(result.isSuccess(), "Credit card bill fetch should succeed");
        assertEquals("AXIS00000NATKF", result.getBillerId());
        assertEquals("•••• 0998", result.getConsumerNumber());
        assertEquals(new BigDecimal("15770.00"), result.getBillAmount());
        assertEquals("Srinivas", result.getCustomerName());

        // Verify that BillAvenue received the exact official BBPS parameters:
        // "Last 4 Digits of Credit Card" with value "0998"
        // "Registered Mobile No" with value "7292987918"
        verify(billAvenueClient).fetchBill(
                eq("AXIS00000NATKF"),
                argThat(inputs -> inputs.stream().anyMatch(i -> "Last 4 Digits of Credit Card".equals(i.getParamName()) && "0998".equals(i.getParamValue()))
                        && inputs.stream().anyMatch(i -> "Registered Mobile No".equals(i.getParamName()) && "7292987918".equals(i.getParamValue()))),
                eq("7292987918"),
                any(),
                eq("MOB"),
                any()
        );
    }

    @Test
    @DisplayName("Credit card payment dispatches official Last 4 Digits of Credit Card and Registered Mobile No")
    void testCreditCardPaymentParameterMapping() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)).thenReturn(Optional.empty());
        when(walletService.getBalance(userId.toString())).thenReturn(mockBalance(new BigDecimal("20000.00"), new BigDecimal("20000.00")));

        when(txnRepository.save(any(Txn.class))).thenAnswer(invocation -> {
            Txn t = invocation.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        when(bbpsTransactionRepository.save(any(BbpsTransaction.class))).thenAnswer(invocation -> {
            BbpsTransaction b = invocation.getArgument(0);
            if (b.getId() == null) b.setId(UUID.randomUUID());
            if (b.getCreatedAt() == null) b.setCreatedAt(java.time.Instant.now());
            return b;
        });

        BillAvenueDtos.BillPayResponse payResp = new BillAvenueDtos.BillPayResponse();
        payResp.setResponseCode("000");
        payResp.setResponseReason("Successful");
        payResp.setTxnRefId("CC015062BAAE00071903");
        payResp.setApprovalRefNumber("AB123456");

        when(billAvenueClient.payBillXml(any())).thenReturn(payResp);

        BbpsDtos.CreditCardPayRequest payRequest = new BbpsDtos.CreditCardPayRequest();
        payRequest.setBillerId("AXIS00000NATKF");
        payRequest.setCustomerMobile("7292987918");
        payRequest.setAmount(new BigDecimal("1500.00"));
        payRequest.setIdempotencyKey("CC-PAY-TEST-001");
        payRequest.setFetchRequestId("REQ-AXIS-998877");
        payRequest.setCustomerParams(java.util.Map.of(
                "Credit Card Number", "6529570000390998",
                "Mobile Number", "7292987918"
        ));

        BbpsDtos.CreditCardPayResponse response = bbpsService.payCreditCardBill(userId, payRequest, "127.0.0.1");

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals("SUCCESS", response.getStatus());
        assertEquals("0998", response.getCardLastFour());

        // Verify that billAvenueClient payBillXml received "Last 4 Digits of Credit Card" = 0998
        verify(billAvenueClient).payBillXml(
                argThat(req -> req.getInputParams().stream().anyMatch(i -> "Last 4 Digits of Credit Card".equals(i.getParamName()) && "0998".equals(i.getParamValue()))
                        && req.getInputParams().stream().anyMatch(i -> "Registered Mobile No".equals(i.getParamName()) && "7292987918".equals(i.getParamValue())))
        );
    }
}

