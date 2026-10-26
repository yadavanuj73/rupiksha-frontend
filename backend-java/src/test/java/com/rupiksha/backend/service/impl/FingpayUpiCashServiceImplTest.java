package com.rupiksha.backend.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.provider.fingpay.entity.AepsKyc;
import com.rupiksha.aeps.provider.fingpay.repository.AepsKycRepository;
import com.rupiksha.aeps.repository.AepsUserRepository;
import com.rupiksha.backend.api.dto.FingpayUpiCashDtos.*;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.FingpayUpiCashTransactionRepository;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.UserServiceRepository;
import com.rupiksha.backend.service.WalletService;
import com.rupiksha.backend.util.FingpayUpiCashCryptoUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class FingpayUpiCashServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserServiceRepository userServiceRepository;

    @Mock
    private AepsKycRepository aepsKycRepository;

    @Mock
    private AepsUserRepository aepsUserRepository;

    @Mock
    private TxnRepository txnRepository;

    @Mock
    private FingpayUpiCashTransactionRepository upiTransactionRepository;

    @Mock
    private WalletService walletService;

    @Mock
    private FingpayUpiCashCryptoUtil cryptoUtil;

    @Mock
    private RestTemplate restTemplate;

    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private FingpayUpiCashServiceImpl upiCashService;

    private User testUser;
    private UUID testUserId;

    @BeforeEach
    void setUp() {
        testUserId = UUID.randomUUID();
        testUser = new User();
        testUser.setId(testUserId);
        testUser.setUsername("retailer1");
        testUser.setMobile("9876543210");
        testUser.setFullName("Test Retailer");
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setAepsAgentId("AGENT123");
        testUser.setPartyCode("PC123");

        ReflectionTestUtils.setField(upiCashService, "objectMapper", objectMapper);
        ReflectionTestUtils.setField(upiCashService, "initiateUrl", "https://fingpayap.tapits.in/fpaepsservice/api/upicw/partner/initiate/payment");
        ReflectionTestUtils.setField(upiCashService, "statusUrl", "https://fingpayap.tapits.in/fpaepsservice/api/upicw/partner/check/status");
        ReflectionTestUtils.setField(upiCashService, "superMerchantId", "1407");
        ReflectionTestUtils.setField(upiCashService, "secretKey", "secret123");
        ReflectionTestUtils.setField(upiCashService, "configuredDailyLimit", new BigDecimal("30000"));
        ReflectionTestUtils.setField(upiCashService, "useUat", false);
    }

    @Test
    @DisplayName("Verify merchant login ID resolution reuses existing Fingpay onboarding from aepskyc")
    void testMerchantIdResolution() {
        // 1. Authoritative Fingpay KYC outlet takes highest precedence over core partyCode/agentId
        long uidLong = testUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
        AepsKyc kyc = new AepsKyc();
        kyc.setUid(uidLong);
        kyc.setOutlet("FP_OUTLET_99");
        when(aepsKycRepository.findByUid(uidLong)).thenReturn(Optional.of(kyc));

        String id1 = upiCashService.resolveMerchantId(testUser);
        assertEquals("FP_OUTLET_99", id1);

        // 2. Custom UPICW override takes precedence over everything if set
        testUser.setUpicwMerchantId("CUSTOM_UPI_ID");
        String id2 = upiCashService.resolveMerchantId(testUser);
        assertEquals("CUSTOM_UPI_ID", id2);

        // 3. When no UPICW override and no AepsKyc, fallback to aepsAgentId
        testUser.setUpicwMerchantId(null);
        when(aepsKycRepository.findByUid(uidLong)).thenReturn(Optional.empty());
        String id3 = upiCashService.resolveMerchantId(testUser);
        assertEquals("AGENT123", id3);

        // 4. Fallback to partyCode if aepsAgentId is missing
        testUser.setAepsAgentId(null);
        String id4 = upiCashService.resolveMerchantId(testUser);
        assertEquals("PC123", id4);
    }



    @Test
    @DisplayName("Verify merchant PIN resolution reuses existing Fingpay MPIN from aepskyc")
    void testMerchantPinResolution() {
        long uidLong = testUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
        AepsKyc kyc = new AepsKyc();
        kyc.setUid(uidLong);
        kyc.setMpin("4321");
        when(aepsKycRepository.findByUid(uidLong)).thenReturn(Optional.of(kyc));

        String pin = upiCashService.resolveMerchantPin(testUser);
        assertEquals("4321", pin);
    }

    @Test
    @DisplayName("Verify amount validation rules: min 100, max 5000, multiple of 100, no paise")
    void testAmountValidationRules() {
        when(userRepository.findById(testUserId)).thenReturn(Optional.of(testUser));

        // Amount below 100 rejected
        InitiateRequest reqBelow100 = new InitiateRequest(new BigDecimal("50.00"), 19.0760, 72.8777, "Test");
        Exception ex1 = assertThrows(IllegalArgumentException.class, () ->
                upiCashService.initiatePayment(testUserId, reqBelow100, "127.0.0.1"));
        assertTrue(ex1.getMessage().contains("FP029"));

        // Amount above 5000 rejected
        InitiateRequest reqAbove5000 = new InitiateRequest(new BigDecimal("6000.00"), 19.0760, 72.8777, "Test");
        Exception ex2 = assertThrows(IllegalArgumentException.class, () ->
                upiCashService.initiatePayment(testUserId, reqAbove5000, "127.0.0.1"));
        assertTrue(ex2.getMessage().contains("FP002"));

        // Amount with paise rejected (e.g. 150.50)
        InitiateRequest reqPaise = new InitiateRequest(new BigDecimal("150.50"), 19.0760, 72.8777, "Test");
        Exception ex3 = assertThrows(IllegalArgumentException.class, () ->
                upiCashService.initiatePayment(testUserId, reqPaise, "127.0.0.1"));
        assertTrue(ex3.getMessage().contains("FP027"));

        // Amount not multiple of 100 rejected (e.g. 150.00)
        InitiateRequest reqNonMultiple = new InitiateRequest(new BigDecimal("150.00"), 19.0760, 72.8777, "Test");
        Exception ex4 = assertThrows(IllegalArgumentException.class, () ->
                upiCashService.initiatePayment(testUserId, reqNonMultiple, "127.0.0.1"));
        assertTrue(ex4.getMessage().contains("FP079"));
    }

    @Test
    @DisplayName("Verify callback idempotency: repeated SUCCESS callback does not double-credit wallet")
    void testCallbackIdempotency() {
        FingpayUpiCashTransaction existingTxn = new FingpayUpiCashTransaction();
        existingTxn.setUser(testUser);
        existingTxn.setPartnerRequestId("RXUPI12345");
        existingTxn.setFpTransactionId("FP999888");
        existingTxn.setAmount(new BigDecimal("500.00"));
        existingTxn.setInternalStatus("SUCCESS"); // Already confirmed
        existingTxn.setBankRrn("RRN123456");

        when(upiTransactionRepository.findByPartnerRequestId("RXUPI12345")).thenReturn(Optional.of(existingTxn));

        String callbackJson = "{\"responseCode\":\"00\",\"payerAmount\":\"500.00\",\"fingpayTransactionId\":\"FP999888\",\"txnStatus\":\"SUCCESS\",\"bankRrn\":\"RRN123456\",\"partnerRequestId\":\"RXUPI12345\",\"merchantLoginId\":\"AGENT123\",\"superMerchantId\":\"1407\",\"responseMessage\":\"Success\"}";

        CallbackResponse response = upiCashService.processCallback(callbackJson, "sampleHash", "127.0.0.1");

        assertTrue(response.isStatus());
        assertEquals(10000, response.getStatusCode());

        // Verify walletService.creditForService was NOT called since transaction was already in SUCCESS status
        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Verify transition to SUCCESS credits merchant wallet exactly once")
    void testTransitionToSuccessCreditsWallet() {
        FingpayUpiCashTransaction pendingTxn = new FingpayUpiCashTransaction();
        pendingTxn.setUser(testUser);
        pendingTxn.setPartnerRequestId("RXUPI54321");
        pendingTxn.setFpTransactionId("FP111222");
        pendingTxn.setAmount(new BigDecimal("1000.00"));
        pendingTxn.setInternalStatus("QR_GENERATED");

        Txn coreTxn = new Txn();
        coreTxn.setStatus(TransactionStatus.INITIATED);
        pendingTxn.setTxn(coreTxn);

        when(upiTransactionRepository.findByPartnerRequestId("RXUPI54321")).thenReturn(Optional.of(pendingTxn));
        when(walletService.creditForService(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new WalletDtos.WalletBalanceResponse("1", "Retailer", "retailer1", "9876543210", "RETAILER", new BigDecimal("5000.00"), BigDecimal.ZERO, new BigDecimal("5000.00"), BigDecimal.ZERO, "ACTIVE", "PC123"));

        String callbackJson = "{\"responseCode\":\"00\",\"payerAmount\":\"1000.00\",\"fingpayTransactionId\":\"FP111222\",\"txnStatus\":\"SUCCESS\",\"bankRrn\":\"RRN987654\",\"partnerRequestId\":\"RXUPI54321\",\"merchantLoginId\":\"AGENT123\",\"superMerchantId\":\"1407\",\"responseMessage\":\"Payment Successful\"}";

        CallbackResponse response = upiCashService.processCallback(callbackJson, "sampleHash", "127.0.0.1");

        assertTrue(response.isStatus());
        assertEquals(10000, response.getStatusCode());
        assertEquals("SUCCESS", pendingTxn.getInternalStatus());
        assertEquals("RRN987654", pendingTxn.getBankRrn());

        // Verify walletService.creditForService was called exactly once with UPICW context
        verify(walletService, times(1)).creditForService(
                eq(testUserId),
                eq(new BigDecimal("1000.00")),
                contains("RXUPI54321"),
                eq(WalletTransactionContext.UPI_CASH_WITHDRAWAL),
                eq("UPI_CASH_WITHDRAWAL"),
                anyString(),
                eq("UPICW-CREDIT-RXUPI54321")
        );
    }
}
