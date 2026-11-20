package com.rupiksha.aeps.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.config.PayoutProperties;
import com.rupiksha.aeps.dto.PayoutRequest;
import com.rupiksha.aeps.dto.PayoutResponse;
import com.rupiksha.aeps.entity.PayoutBeneficiary;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.repository.PayoutBeneficiaryRepository;
import com.rupiksha.aeps.repository.PayoutChargeSlabRepository;
import com.rupiksha.aeps.repository.PayoutStatusHistoryRepository;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.UserServiceRepository;
import com.rupiksha.backend.service.WalletService;
import com.rupiksha.backend.service.impl.PayoutRateLimiter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayoutServiceTest {

    @Mock
    private PayoutProperties payoutProperties;
    @Mock
    private PayoutTransactionRepository payoutTransactionRepository;
    @Mock
    private PayoutBeneficiaryRepository payoutBeneficiaryRepository;
    @Mock
    private PayoutChargeSlabRepository payoutChargeSlabRepository;
    @Mock
    private WalletService walletService;
    @Mock
    private UserRepository userRepository;
    @Mock
    private UserServiceRepository userServiceRepository;
    @Mock
    private PayoutRateLimiter payoutRateLimiter;
    @Mock
    private PayoutAuditService payoutAuditService;
    @Mock
    private PayoutStatusHistoryRepository payoutStatusHistoryRepository;
    @Mock
    private PayoutOtpService payoutOtpService;
    @Mock
    private PayoutLimitConfigurationService payoutLimitConfigurationService;
    @Mock
    private RestTemplate mockRestTemplate;

    private ObjectMapper objectMapper;
    private PayoutService payoutService;

    private final UUID testUserUuid = UUID.fromString("ecf4d499-1b8a-4db7-8325-95a874fbae8e");
    private final String testUserId = testUserUuid.toString();
    private User testUser;
    private PayoutBeneficiary approvedBeneficiary;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        payoutService = new PayoutService(
                objectMapper,
                payoutProperties,
                payoutTransactionRepository,
                payoutBeneficiaryRepository,
                payoutChargeSlabRepository,
                walletService,
                userRepository,
                userServiceRepository,
                payoutRateLimiter,
                payoutAuditService,
                payoutStatusHistoryRepository,
                payoutOtpService,
                payoutLimitConfigurationService
        );
        ReflectionTestUtils.setField(payoutService, "restTemplate", mockRestTemplate);

        lenient().when(payoutOtpService.validateAndConsumeAuthorization(any(), any(), any(), any()))
                .thenReturn(mock(com.rupiksha.aeps.entity.PayoutOtpChallenge.class));

        lenient().doAnswer(inv -> {
            BigDecimal amt = inv.getArgument(0);
            if (amt == null || amt.compareTo(new BigDecimal("100.00")) < 0) {
                throw new IllegalArgumentException("Payout amount must be at least ₹100.00. Minimum payout amount is ₹100.");
            }
            if (amt.compareTo(new BigDecimal("100000.00")) > 0) {
                throw new IllegalArgumentException("Maximum payout amount per transaction is ₹1,00,000. Please initiate a separate payout for any additional amount.");
            }
            return null;
        }).when(payoutLimitConfigurationService).validatePayoutAmount(any());

        lenient().when(payoutProperties.getFullPayoutUrl()).thenReturn("https://api.provider.com/payout");
        lenient().when(payoutProperties.isEncryptionEnabled()).thenReturn(false);
        lenient().when(payoutProperties.getApiKey()).thenReturn("test-api-key");
        lenient().when(payoutProperties.getJwtSecret()).thenReturn("12345678901234567890123456789012");
        lenient().when(payoutProperties.getMerchantId()).thenReturn("MERCH001");

        Role retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);

        testUser = new User();
        testUser.setId(testUserUuid);
        testUser.setUsername("testretailer");
        testUser.setFullName("Test Retailer");
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setRoles(Set.of(retailerRole));
        testUser.setMobile("9876543210");

        approvedBeneficiary = PayoutBeneficiary.builder()
                .id(1L)
                .userId(testUserId)
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .beneficiaryName("John Doe")
                .status("APPROVED")
                .isVerified(true)
                .build();
    }

    private PayoutRequest createValidPayoutRequest() {
        return PayoutRequest.builder()
                .amount(new BigDecimal("1000.00"))
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .beneficiaryName("John Doe")
                .bankName("State Bank of India")
                .transferMode("IMPS")
                .remarks("Vendor payment")
                .authorizationReference("AUTH_TEST_VALID_REF")
                .build();
    }

    private void mockUserAndPermissions(boolean serviceEnabled) {
        when(userRepository.findById(testUserUuid)).thenReturn(Optional.of(testUser));
        com.rupiksha.backend.domain.UserService mockService = new com.rupiksha.backend.domain.UserService();
        mockService.setServiceType(ServiceType.PAYOUT);
        mockService.setIsEnabled(serviceEnabled);
        when(userServiceRepository.findByUserIdAndServiceType(testUserUuid, ServiceType.PAYOUT))
                .thenReturn(Optional.of(mockService));
    }

    @Test
    @DisplayName("PHASE 1 FIX: Provider response INITIATED must map to PENDING, never to SUCCESS")
    void testProviderInitiatedMapsToPending() {
        mockUserAndPermissions(true);
        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.of(approvedBeneficiary));

        when(payoutTransactionRepository.save(any(PayoutTransaction.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        // Provider response with statusCode = 0 but bbTransactionStatus = INITIATED without UTR
        String providerResponse = """
            {
                "bbStatusCode": 0,
                "bbStatusMsg": "Transaction Initiated",
                "TransactionData": {
                    "bbTransactionId": "BBTXN1001",
                    "bbTransactionStatus": "INITIATED",
                    "bbUtrNumber": "",
                    "bbReason": "Transaction initiated with banking rail"
                }
            }
            """;
        ResponseEntity<String> responseEntity = new ResponseEntity<>(providerResponse, HttpStatus.OK);
        when(mockRestTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(responseEntity);

        PayoutRequest req = createValidPayoutRequest();
        PayoutResponse res = payoutService.initiatePayout(req, testUserId, "test-idem-key-01", "127.0.0.1");

        assertNotNull(res);
        assertEquals("PENDING", res.getStatus(), "Status must be PENDING when provider reports INITIATED");
        assertTrue(res.isSuccess()); // request acknowledged

        // Verify transaction saved as PENDING
        ArgumentCaptor<PayoutTransaction> captor = ArgumentCaptor.forClass(PayoutTransaction.class);
        verify(payoutTransactionRepository, atLeastOnce()).save(captor.capture());
        PayoutTransaction savedTxn = captor.getValue();
        assertEquals("PENDING", savedTxn.getStatus());

        // Verify NO refund was triggered
        verify(walletService, never()).refundForService(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("PHASE 1 FIX: Confirmed provider SUCCESS with UTR maps to SUCCESS")
    void testConfirmedSuccessMapsToSuccess() {
        mockUserAndPermissions(true);
        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.of(approvedBeneficiary));

        when(payoutTransactionRepository.save(any(PayoutTransaction.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        String providerResponse = """
            {
                "bbStatusCode": 0,
                "bbStatusMsg": "SUCCESS",
                "TransactionData": {
                    "bbTransactionId": "BBTXN9999",
                    "bbTransactionStatus": "SUCCESS",
                    "bbUtrNumber": "CMS1234567890",
                    "bbReason": "Transfer completed successfully"
                }
            }
            """;
        ResponseEntity<String> responseEntity = new ResponseEntity<>(providerResponse, HttpStatus.OK);
        when(mockRestTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(responseEntity);

        PayoutRequest req = createValidPayoutRequest();
        PayoutResponse res = payoutService.initiatePayout(req, testUserId, "test-idem-key-success", "127.0.0.1");

        assertNotNull(res);
        assertEquals("SUCCESS", res.getStatus());
        assertEquals("CMS1234567890", res.getUtr());
        verify(walletService, never()).refundForService(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("PHASE 1 FIX: Confirmed provider FAILURE triggers refund and marks FAILED")
    void testConfirmedFailureTriggersRefund() {
        mockUserAndPermissions(true);
        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.of(approvedBeneficiary));

        when(payoutTransactionRepository.save(any(PayoutTransaction.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        String providerResponse = """
            {
                "bbStatusCode": 1,
                "bbStatusMsg": "Failed",
                "TransactionData": {
                    "bbTransactionId": "BBTXN5555",
                    "bbTransactionStatus": "FAILED",
                    "bbUtrNumber": "",
                    "bbReason": "Beneficiary bank down"
                }
            }
            """;
        ResponseEntity<String> responseEntity = new ResponseEntity<>(providerResponse, HttpStatus.OK);
        when(mockRestTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(responseEntity);

        PayoutRequest req = createValidPayoutRequest();
        PayoutResponse res = payoutService.initiatePayout(req, testUserId, "test-idem-key-fail", "127.0.0.1");

        assertNotNull(res);
        assertEquals("FAILED", res.getStatus());
        assertFalse(res.isSuccess());

        // Verify refund was executed atomically
        verify(walletService, times(1)).refundForService(
                eq(testUserUuid),
                any(BigDecimal.class),
                contains("Payout rejected"),
                anyString(),
                eq(WalletTransactionContext.PAYOUT_REFUND),
                eq("PAYOUT"),
                anyString(),
                anyString()
        );
    }

    @Test
    @DisplayName("PHASE 1 FIX: Ambiguous provider timeout keeps PENDING and prevents premature refund")
    void testAmbiguousTimeoutKeepsPendingWithoutPrematureRefund() {
        mockUserAndPermissions(true);
        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.of(approvedBeneficiary));

        when(payoutTransactionRepository.save(any(PayoutTransaction.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        when(mockRestTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new ResourceAccessException("Connection timed out waiting for provider"));

        PayoutRequest req = createValidPayoutRequest();
        PayoutResponse res = payoutService.initiatePayout(req, testUserId, "test-idem-key-timeout", "127.0.0.1");

        assertNotNull(res);
        assertEquals("PENDING", res.getStatus());

        // Must NOT refund prematurely on network timeout!
        verify(walletService, never()).refundForService(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("PHASE 2 FIX: Idempotent replay with same key returns cached transaction without second debit or provider call")
    void testIdempotencyReplayReturnsCachedTransaction() {
        mockUserAndPermissions(true);
        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.of(approvedBeneficiary));

        PayoutRequest req = createValidPayoutRequest();
        String expectedHash = payoutService.computePayloadHash(testUserId, "123456789012", "SBIN0001234", req.getAmount(), req.getTransferMode());

        PayoutTransaction existingTxn = PayoutTransaction.builder()
                .id(99L)
                .orderId("PO_EXISTING_123")
                .userId(testUserId)
                .amount(req.getAmount())
                .accountNumber(req.getAccountNumber())
                .ifsc(req.getIfsc())
                .transferMode("IMPS")
                .idempotencyKey("idem-key-duplicate")
                .requestPayloadHash(expectedHash)
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .build();

        when(payoutTransactionRepository.findByIdempotencyKey("idem-key-duplicate"))
                .thenReturn(Optional.of(existingTxn));

        PayoutResponse res = payoutService.initiatePayout(req, testUserId, "idem-key-duplicate", "127.0.0.1");

        assertNotNull(res);
        assertEquals("PO_EXISTING_123", res.getOrderId());
        assertEquals("PENDING", res.getStatus());

        // Zero wallet debits and zero provider HTTP calls for replay!
        verify(walletService, never()).debitForService(any(), any(), any(), any(), any(), any(), any());
        verify(mockRestTemplate, never()).exchange(anyString(), any(), any(), eq(String.class));
    }

    @Test
    @DisplayName("PHASE 2 FIX: Reusing idempotency key with different payload throws IllegalArgumentException")
    void testIdempotencyKeyConflictThrowsException() {
        mockUserAndPermissions(true);
        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.of(approvedBeneficiary));

        PayoutTransaction existingTxn = PayoutTransaction.builder()
                .id(100L)
                .orderId("PO_DIFFERENT_PAYLOAD")
                .userId(testUserId)
                .amount(new BigDecimal("5000.00")) // different amount!
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .idempotencyKey("shared-key")
                .requestPayloadHash("different-hash-value")
                .status("SUCCESS")
                .build();

        when(payoutTransactionRepository.findByIdempotencyKey("shared-key"))
                .thenReturn(Optional.of(existingTxn));

        PayoutRequest req = createValidPayoutRequest(); // amount = 1000.00
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                payoutService.initiatePayout(req, testUserId, "shared-key", "127.0.0.1"));

        assertTrue(ex.getMessage().contains("already used for a different payout request"));
    }

    @Test
    @DisplayName("PHASE 1 & 2 FIX: Duplicate refund is strictly prevented when refundStatus is REFUNDED")
    void testDuplicateRefundPrevented() {
        PayoutTransaction txn = PayoutTransaction.builder()
                .orderId("PO_REFUND_TEST")
                .userId(testUserId)
                .amount(new BigDecimal("1000.00"))
                .refundStatus("REFUNDED")
                .refundReference("PO_REFUND_TEST_REFUND")
                .status("FAILED")
                .build();

        payoutService.executeRefund(txn, new BigDecimal("1000.00"), "Second refund attempt");

        // Verify wallet refund is NOT called when already REFUNDED
        verify(walletService, never()).refundForService(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("PHASE 3 FIX: Disabled PAYOUT service in database user_services throws AccessDeniedException")
    void testDisabledPayoutServiceThrowsAccessDenied() {
        mockUserAndPermissions(false); // isEnabled = false

        PayoutRequest req = createValidPayoutRequest();
        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                payoutService.initiatePayout(req, testUserId, "any-key", "127.0.0.1"));

        assertTrue(ex.getMessage().contains("Payout service is disabled"));
    }

    @Test
    @DisplayName("PHASE 3 FIX: Inactive user account throws AccessDeniedException")
    void testInactiveUserThrowsAccessDenied() {
        testUser.setStatus(UserStatus.INACTIVE);
        when(userRepository.findById(testUserUuid)).thenReturn(Optional.of(testUser));

        PayoutRequest req = createValidPayoutRequest();
        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                payoutService.initiatePayout(req, testUserId, "any-key", "127.0.0.1"));

        assertTrue(ex.getMessage().contains("User account is not active"));
    }

    @Test
    @DisplayName("PHASE 3 FIX: Unapproved beneficiary throws IllegalArgumentException")
    void testUnapprovedBeneficiaryThrowsException() {
        mockUserAndPermissions(true);
        // Beneficiary not found or status != APPROVED
        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.empty());

        PayoutRequest req = createValidPayoutRequest();
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                payoutService.initiatePayout(req, testUserId, "any-key", "127.0.0.1"));

        assertTrue(ex.getMessage().contains("Admin-Approved bank beneficiary"));
    }

    @Test
    @DisplayName("MINIMUM PAYOUT LIMIT: Amount below ₹100.00 throws IllegalArgumentException")
    void testAmountBelow100ThrowsException() {
        mockUserAndPermissions(true);

        PayoutRequest req = createValidPayoutRequest();
        req.setAmount(new BigDecimal("99.99"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                payoutService.initiatePayout(req, testUserId, "test-idem-min-fail", "127.0.0.1"));

        assertTrue(ex.getMessage().contains("Payout amount must be at least ₹100.00"));
    }

    @Test
    @DisplayName("MINIMUM PAYOUT LIMIT: Amount of ₹100.00 is allowed and proceeds to provider")
    void testAmount100IsAllowed() throws Exception {
        mockUserAndPermissions(true);
        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.of(approvedBeneficiary));

        when(payoutTransactionRepository.save(any(PayoutTransaction.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        String providerResponse = """
            {
                "bbStatusCode": 0,
                "bbStatusMsg": "SUCCESS",
                "TransactionData": {
                    "bbTransactionId": "BBTXN100_MIN",
                    "bbTransactionStatus": "SUCCESS",
                    "bbUtrNumber": "UTR100MIN",
                    "bbReason": "Transfer completed"
                }
            }
            """;
        ResponseEntity<String> entity = new ResponseEntity<>(providerResponse, HttpStatus.OK);
        when(mockRestTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(String.class)))
                .thenReturn(entity);

        PayoutRequest req = createValidPayoutRequest();
        req.setAmount(new BigDecimal("100.00"));

        PayoutResponse res = payoutService.initiatePayout(req, testUserId, "test-idem-min-100", "127.0.0.1");

        assertNotNull(res);
        assertEquals("SUCCESS", res.getStatus());
        assertEquals("UTR100MIN", res.getUtr());
    }

    @Test
    @DisplayName("SECURITY ENFORCEMENT: Payout initiation without OTP authorization reference is strictly rejected")
    void testInitiatePayoutWithoutOtpAuthorization_ThrowsAccessDeniedException() {
        mockUserAndPermissions(true);
        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.of(approvedBeneficiary));

        doThrow(new AccessDeniedException("Mandatory payout OTP authorization required. Please verify OTP before initiating payout."))
                .when(payoutOtpService).validateAndConsumeAuthorization(isNull(), any(), any(), any());

        PayoutRequest req = createValidPayoutRequest();
        req.setAuthorizationReference(null);

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                payoutService.initiatePayout(req, testUserId, "test-idem-no-otp", "127.0.0.1"));

        assertTrue(ex.getMessage().contains("Mandatory payout OTP authorization required"));
        verify(walletService, never()).debitForService(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("SECURITY ENFORCEMENT: Payout initiation with tampered details after OTP verification is strictly rejected")
    void testInitiatePayoutWithTamperedDetails_ThrowsAccessDeniedException() {
        mockUserAndPermissions(true);
        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.of(approvedBeneficiary));

        doThrow(new AccessDeniedException("Payout parameters do not match the OTP-authorized transaction. Transaction rejected."))
                .when(payoutOtpService).validateAndConsumeAuthorization(eq("AUTH_TAMPERED"), any(), any(), any());

        PayoutRequest req = createValidPayoutRequest();
        req.setAuthorizationReference("AUTH_TAMPERED");
        req.setAmount(new BigDecimal("5000.00")); // Amount tampered

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                payoutService.initiatePayout(req, testUserId, "test-idem-tampered", "127.0.0.1"));

        assertTrue(ex.getMessage().contains("Payout parameters do not match"));
        verify(walletService, never()).debitForService(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("SECURITY ENFORCEMENT: Payout initiation with already consumed authorization reference is strictly rejected")
    void testInitiatePayoutWithConsumedAuthorization_ThrowsAccessDeniedException() {
        mockUserAndPermissions(true);
        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.of(approvedBeneficiary));

        doThrow(new AccessDeniedException("This payout authorization has already been consumed. Replay is strictly blocked."))
                .when(payoutOtpService).validateAndConsumeAuthorization(eq("AUTH_ALREADY_USED"), any(), any(), any());

        PayoutRequest req = createValidPayoutRequest();
        req.setAuthorizationReference("AUTH_ALREADY_USED");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                payoutService.initiatePayout(req, testUserId, "test-idem-replay", "127.0.0.1"));

        assertTrue(ex.getMessage().contains("already been consumed"));
        verify(walletService, never()).debitForService(any(), any(), any(), any(), any(), any(), any());
    }
}
