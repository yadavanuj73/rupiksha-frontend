package com.rupiksha.aeps.service.impl;

import com.rupiksha.aeps.dto.*;
import com.rupiksha.aeps.entity.PayoutBeneficiary;
import com.rupiksha.aeps.entity.PayoutOtpChallenge;
import com.rupiksha.aeps.entity.PayoutOtpStatus;
import com.rupiksha.aeps.repository.PayoutBeneficiaryRepository;
import com.rupiksha.aeps.repository.PayoutChargeSlabRepository;
import com.rupiksha.aeps.repository.PayoutOtpAuditLogRepository;
import com.rupiksha.aeps.repository.PayoutOtpChallengeRepository;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.integration.otp.OtpProvider;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.UserServiceRepository;
import com.rupiksha.backend.service.WalletService;
import com.rupiksha.backend.service.impl.OtpProviderRouter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayoutOtpServiceImplTest {

    @Mock
    private PayoutOtpChallengeRepository challengeRepository;
    @Mock
    private PayoutOtpAuditLogRepository auditLogRepository;
    @Mock
    private PayoutBeneficiaryRepository payoutBeneficiaryRepository;
    @Mock
    private PayoutChargeSlabRepository payoutChargeSlabRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private UserServiceRepository userServiceRepository;
    @Mock
    private WalletService walletService;
    @Mock
    private OtpProviderRouter otpProviderRouter;
    @Mock
    private OtpProvider mockOtpProvider;
    @Mock
    private AppProperties appProperties;

    private PayoutOtpServiceImpl payoutOtpService;

    private final UUID testUserUuid = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private final String testUserId = testUserUuid.toString();
    private User testUser;
    private PayoutBeneficiary approvedBeneficiary;

    @BeforeEach
    void setUp() {
        payoutOtpService = new PayoutOtpServiceImpl(
                challengeRepository,
                auditLogRepository,
                payoutBeneficiaryRepository,
                payoutChargeSlabRepository,
                userRepository,
                userServiceRepository,
                walletService,
                otpProviderRouter,
                appProperties
        );

        Role retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);

        testUser = new User();
        testUser.setId(testUserUuid);
        testUser.setUsername("retailer_test");
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setRoles(Set.of(retailerRole));
        testUser.setMobile("9876543210");

        approvedBeneficiary = PayoutBeneficiary.builder()
                .id(101L)
                .userId(testUserId)
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .beneficiaryName("Test Beneficiary")
                .status("APPROVED")
                .isVerified(true)
                .build();

        lenient().when(otpProviderRouter.current()).thenReturn(mockOtpProvider);
        lenient().when(mockOtpProvider.providerName()).thenReturn("dovesoft");
    }

    private PayoutOtpSendRequest createValidSendRequest() {
        return PayoutOtpSendRequest.builder()
                .amount(new BigDecimal("1000.00"))
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .beneficiaryName("Test Beneficiary")
                .transferMode("IMPS")
                .build();
    }

    private void mockActiveUserAndBeneficiary() {
        when(userRepository.findById(testUserUuid)).thenReturn(Optional.of(testUser));
        com.rupiksha.backend.domain.UserService userService = new com.rupiksha.backend.domain.UserService();
        userService.setServiceType(ServiceType.PAYOUT);
        userService.setIsEnabled(true);
        when(userServiceRepository.findByUserIdAndServiceType(testUserUuid, ServiceType.PAYOUT))
                .thenReturn(Optional.of(userService));

        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.of(approvedBeneficiary));

        WalletDtos.WalletBalanceResponse balanceResp = new WalletDtos.WalletBalanceResponse(
                testUserId, "Test User", "testuser", "9876543210", "RETAILER",
                new BigDecimal("50000.00"), BigDecimal.ZERO, new BigDecimal("50000.00"), new BigDecimal("18.00"), "ACTIVE"
        );
        when(walletService.getBalance(testUserId)).thenReturn(balanceResp);
    }

    @Test
    @DisplayName("Stage A: Send OTP succeeds and binds to exact payout details")
    void testSendOtp_Success() {
        mockActiveUserAndBeneficiary();
        when(mockOtpProvider.sendOtp(eq("9876543210"))).thenReturn("DOVE_SESSION_12345");

        PayoutOtpSendResponse resp = payoutOtpService.sendOtp(createValidSendRequest(), testUserId, "127.0.0.1", "Mozilla/5.0");

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertNotNull(resp.getChallengeId());
        assertNotNull(resp.getPayoutIntentId());
        assertEquals("******3210", resp.getMaskedMobile());
        assertEquals(new BigDecimal("1000.00"), resp.getAmount());
        assertEquals(new BigDecimal("6.49"), resp.getTotalCharges());
        assertEquals(new BigDecimal("1006.49"), resp.getTotalDeduction());

        verify(challengeRepository).save(any(PayoutOtpChallenge.class));
        verify(auditLogRepository, atLeastOnce()).save(any());
    }

    @Test
    @DisplayName("Security: Send OTP rejects non-approved beneficiary")
    void testSendOtp_RejectsUnapprovedBeneficiary() {
        when(userRepository.findById(testUserUuid)).thenReturn(Optional.of(testUser));
        com.rupiksha.backend.domain.UserService userService = new com.rupiksha.backend.domain.UserService();
        userService.setServiceType(ServiceType.PAYOUT);
        userService.setIsEnabled(true);
        when(userServiceRepository.findByUserIdAndServiceType(testUserUuid, ServiceType.PAYOUT))
                .thenReturn(Optional.of(userService));

        when(payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(eq(testUserId), anyString(), anyString()))
                .thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                payoutOtpService.sendOtp(createValidSendRequest(), testUserId, "127.0.0.1", "Mozilla/5.0"));

        assertTrue(ex.getMessage().contains("only allowed to an Admin-Approved bank beneficiary"));
        verify(mockOtpProvider, never()).sendOtp(any());
    }

    @Test
    @DisplayName("Security: Send OTP fails if DoveSoft delivery fails")
    void testSendOtp_HandlesDoveSoftFailure() {
        mockActiveUserAndBeneficiary();
        when(mockOtpProvider.sendOtp(eq("9876543210"))).thenThrow(new RuntimeException("DoveSoft gateway timeout"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                payoutOtpService.sendOtp(createValidSendRequest(), testUserId, "127.0.0.1", "Mozilla/5.0"));

        assertTrue(ex.getMessage().contains("Unable to send OTP"));
        verify(challengeRepository, never()).save(any(PayoutOtpChallenge.class));
    }

    @Test
    @DisplayName("Stage B: Verify OTP succeeds and issues single-use authorization reference")
    void testVerifyOtp_Success() {
        String challengeId = "POC_TEST_123";
        String payloadFingerprint = payoutOtpService.computePayloadFingerprint(
                testUserId, "123456789012", "SBIN0001234", new BigDecimal("1000.00"), "IMPS"
        );

        PayoutOtpChallenge challenge = PayoutOtpChallenge.builder()
                .challengeId(challengeId)
                .payoutIntentId("POI_INTENT_1")
                .userId(testUserUuid)
                .userRole("RETAILER")
                .mobileNumber("9876543210")
                .maskedMobile("******3210")
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .transferMode("IMPS")
                .amount(new BigDecimal("1000.00"))
                .payloadHash(payloadFingerprint)
                .providerReference("DOVE_SESSION_12345")
                .status(PayoutOtpStatus.PENDING)
                .expiryAt(Instant.now().plusSeconds(300))
                .attemptCount(0)
                .maxAttempts(5)
                .build();

        when(challengeRepository.findWithLockByChallengeId(challengeId)).thenReturn(Optional.of(challenge));
        when(mockOtpProvider.verifyOtp(eq("9876543210"), eq("123456"), eq("DOVE_SESSION_12345"))).thenReturn(true);

        PayoutOtpVerifyRequest verifyReq = PayoutOtpVerifyRequest.builder()
                .challengeId(challengeId)
                .otp("123456")
                .amount(new BigDecimal("1000.00"))
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .transferMode("IMPS")
                .build();

        PayoutOtpVerifyResponse resp = payoutOtpService.verifyOtp(verifyReq, testUserId, "127.0.0.1", "Mozilla/5.0");

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertNotNull(resp.getAuthorizationReference());
        assertTrue(resp.getAuthorizationReference().startsWith("AUTH_PO_"));
        assertEquals(PayoutOtpStatus.VERIFIED, challenge.getStatus());
        assertNotNull(challenge.getVerifiedAt());
    }

    @Test
    @DisplayName("Security: Verify OTP rejects incorrect OTP and tracks attempts")
    void testVerifyOtp_IncorrectOtp() {
        String challengeId = "POC_TEST_123";
        String payloadFingerprint = payoutOtpService.computePayloadFingerprint(
                testUserId, "123456789012", "SBIN0001234", new BigDecimal("1000.00"), "IMPS"
        );

        PayoutOtpChallenge challenge = PayoutOtpChallenge.builder()
                .challengeId(challengeId)
                .payoutIntentId("POI_INTENT_1")
                .userId(testUserUuid)
                .userRole("RETAILER")
                .mobileNumber("9876543210")
                .maskedMobile("******3210")
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .transferMode("IMPS")
                .amount(new BigDecimal("1000.00"))
                .payloadHash(payloadFingerprint)
                .providerReference("DOVE_SESSION_12345")
                .status(PayoutOtpStatus.PENDING)
                .expiryAt(Instant.now().plusSeconds(300))
                .attemptCount(0)
                .maxAttempts(5)
                .build();

        when(challengeRepository.findWithLockByChallengeId(challengeId)).thenReturn(Optional.of(challenge));
        when(mockOtpProvider.verifyOtp(eq("9876543210"), eq("999999"), eq("DOVE_SESSION_12345"))).thenReturn(false);

        PayoutOtpVerifyRequest verifyReq = PayoutOtpVerifyRequest.builder()
                .challengeId(challengeId)
                .otp("999999")
                .amount(new BigDecimal("1000.00"))
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .transferMode("IMPS")
                .build();

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                payoutOtpService.verifyOtp(verifyReq, testUserId, "127.0.0.1", "Mozilla/5.0"));

        assertTrue(ex.getMessage().contains("Incorrect OTP"));
        assertEquals(1, challenge.getAttemptCount());
        assertNull(challenge.getAuthorizationReference());
    }

    @Test
    @DisplayName("Security: Changing amount between OTP send and verify invalidates challenge")
    void testVerifyOtp_AmountTamperingInvalidatesChallenge() {
        String challengeId = "POC_TEST_TAMPER";
        String payloadFingerprint = payoutOtpService.computePayloadFingerprint(
                testUserId, "123456789012", "SBIN0001234", new BigDecimal("100.00"), "IMPS"
        );

        PayoutOtpChallenge challenge = PayoutOtpChallenge.builder()
                .challengeId(challengeId)
                .payoutIntentId("POI_INTENT_TAMPER")
                .userId(testUserUuid)
                .userRole("RETAILER")
                .mobileNumber("9876543210")
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .transferMode("IMPS")
                .amount(new BigDecimal("100.00"))
                .payloadHash(payloadFingerprint)
                .providerReference("DOVE_SESSION_12345")
                .status(PayoutOtpStatus.PENDING)
                .expiryAt(Instant.now().plusSeconds(300))
                .attemptCount(0)
                .maxAttempts(5)
                .build();

        when(challengeRepository.findWithLockByChallengeId(challengeId)).thenReturn(Optional.of(challenge));

        // Submit ₹10,000 instead of ₹100
        PayoutOtpVerifyRequest verifyReq = PayoutOtpVerifyRequest.builder()
                .challengeId(challengeId)
                .otp("123456")
                .amount(new BigDecimal("10000.00"))
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .transferMode("IMPS")
                .build();

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                payoutOtpService.verifyOtp(verifyReq, testUserId, "127.0.0.1", "Mozilla/5.0"));

        assertTrue(ex.getMessage().contains("Payout details have changed since OTP generation"));
        assertEquals(PayoutOtpStatus.INVALIDATED, challenge.getStatus());
        verify(mockOtpProvider, never()).verifyOtp(any(), any(), any());
    }

    @Test
    @DisplayName("Security: Validate & Consume rejects already consumed authorization reference")
    void testValidateAndConsume_ReplayRejected() {
        String authRef = "AUTH_ALREADY_USED";
        PayoutOtpChallenge challenge = PayoutOtpChallenge.builder()
                .authorizationReference(authRef)
                .userId(testUserUuid)
                .status(PayoutOtpStatus.CONSUMED)
                .consumedAt(Instant.now().minusSeconds(10))
                .build();

        when(challengeRepository.findWithLockByAuthorizationReference(authRef)).thenReturn(Optional.of(challenge));

        PayoutRequest req = PayoutRequest.builder()
                .authorizationReference(authRef)
                .amount(new BigDecimal("1000.00"))
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .transferMode("IMPS")
                .build();

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                payoutOtpService.validateAndConsumeAuthorization(authRef, req, testUserId, "127.0.0.1"));

        assertTrue(ex.getMessage().contains("already been consumed"));
    }

    @Test
    @DisplayName("Security: Validate & Consume rejects wrong user challenge")
    void testValidateAndConsume_WrongUserRejected() {
        String authRef = "AUTH_OTHER_USER";
        UUID otherUser = UUID.randomUUID();
        PayoutOtpChallenge challenge = PayoutOtpChallenge.builder()
                .authorizationReference(authRef)
                .userId(otherUser)
                .status(PayoutOtpStatus.VERIFIED)
                .build();

        when(challengeRepository.findWithLockByAuthorizationReference(authRef)).thenReturn(Optional.of(challenge));

        PayoutRequest req = PayoutRequest.builder()
                .authorizationReference(authRef)
                .amount(new BigDecimal("1000.00"))
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .transferMode("IMPS")
                .build();

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () ->
                payoutOtpService.validateAndConsumeAuthorization(authRef, req, testUserId, "127.0.0.1"));

        assertTrue(ex.getMessage().contains("does not belong to the authenticated user"));
    }
}
