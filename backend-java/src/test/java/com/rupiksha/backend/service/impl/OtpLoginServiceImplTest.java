package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.integration.otp.OtpProvider;
import com.rupiksha.backend.repository.OtpLoginChallengeRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.service.AuthService;
import com.rupiksha.backend.service.IdPaymentRequiredException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class OtpLoginServiceImplTest {

    @Mock
    private OtpLoginChallengeRepository challengeRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private OtpProviderRouter otpProviderRouter;

    @Mock
    private OtpProvider otpProvider;

    @Mock
    private AuthService authService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AppProperties appProperties;

    @InjectMocks
    private OtpLoginServiceImpl otpLoginService;

    private User retailerUser;
    private User distributorUser;
    private User superDistributorUser;
    private final String testMobile = "9876543210";

    @BeforeEach
    void setUp() {
        Role retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);

        Role distributorRole = new Role();
        distributorRole.setName(RoleName.DISTRIBUTOR);

        Role superDistributorRole = new Role();
        superDistributorRole.setName(RoleName.SUPER_DISTRIBUTOR);

        retailerUser = new User();
        retailerUser.setId(UUID.randomUUID());
        retailerUser.setUsername("retailer_test");
        retailerUser.setMobile(testMobile);
        retailerUser.setStatus(UserStatus.ACTIVE);
        retailerUser.setIdPaymentStatus(IdPaymentStatus.SUCCESS);
        retailerUser.getRoles().add(retailerRole);

        distributorUser = new User();
        distributorUser.setId(UUID.randomUUID());
        distributorUser.setUsername("distributor_test");
        distributorUser.setMobile(testMobile);
        distributorUser.setStatus(UserStatus.ACTIVE);
        distributorUser.setIdPaymentStatus(IdPaymentStatus.SUCCESS);
        distributorUser.getRoles().add(distributorRole);

        superDistributorUser = new User();
        superDistributorUser.setId(UUID.randomUUID());
        superDistributorUser.setUsername("super_dist_test");
        superDistributorUser.setMobile(testMobile);
        superDistributorUser.setStatus(UserStatus.ACTIVE);
        superDistributorUser.setIdPaymentStatus(IdPaymentStatus.SUCCESS);
        superDistributorUser.getRoles().add(superDistributorRole);
    }

    private void mockAppProperties() {
        AppProperties.Otp otpProps = new AppProperties.Otp(300L, 5);
        lenient().when(appProperties.otp()).thenReturn(otpProps);
    }

    @Test
    void requestOtp_Success_RealRetailerUser_GeneratesChallengeAndSendsOtp() {
        mockAppProperties();
        when(userRepository.findAllByMobileAndRole(testMobile, RoleName.RETAILER))
                .thenReturn(List.of(retailerUser));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.sendOtp(testMobile)).thenReturn("provider-ref-123");
        when(passwordEncoder.encode(anyString())).thenReturn("hashed-ref");
        when(challengeRepository.save(any(OtpLoginChallenge.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthDtos.OtpLoginRequest req = new AuthDtos.OtpLoginRequest(testMobile, "RETAILER");
        AuthDtos.OtpLoginRequestResponse res = otpLoginService.requestOtp(req, "192.168.1.1", "Chrome");

        assertTrue(res.success());
        assertEquals(OtpLoginServiceImpl.GENERIC_OTP_SENT_MESSAGE, res.message());
        assertNotNull(res.challengeId());
        assertEquals(60, res.cooldownSeconds());
        assertEquals(300L, res.expiresInSeconds());

        verify(otpProvider).sendOtp(testMobile);
        verify(challengeRepository).save(any(OtpLoginChallenge.class));
    }

    @Test
    void requestOtp_UnknownUser_ReturnsGenericResponseWithDecoyChallenge() {
        mockAppProperties();
        when(userRepository.findAllByMobileAndRole(testMobile, RoleName.RETAILER))
                .thenReturn(Collections.emptyList());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed-decoy");
        when(challengeRepository.save(any(OtpLoginChallenge.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthDtos.OtpLoginRequest req = new AuthDtos.OtpLoginRequest(testMobile, "RETAILER");
        AuthDtos.OtpLoginRequestResponse res = otpLoginService.requestOtp(req, "192.168.1.1", "Chrome");

        assertTrue(res.success());
        assertEquals(OtpLoginServiceImpl.GENERIC_OTP_SENT_MESSAGE, res.message());
        assertNotNull(res.challengeId());
        verify(otpProviderRouter, never()).current(); // No SMS sent for non-existent user
    }

    @Test
    void requestOtp_MultipleAccountsWithSameRole_Ambiguity_ReturnsDecoy() {
        mockAppProperties();
        User dupUser1 = new User();
        dupUser1.setId(UUID.randomUUID());
        dupUser1.setStatus(UserStatus.ACTIVE);
        User dupUser2 = new User();
        dupUser2.setId(UUID.randomUUID());
        dupUser2.setStatus(UserStatus.ACTIVE);

        when(userRepository.findAllByMobileAndRole(testMobile, RoleName.RETAILER))
                .thenReturn(List.of(dupUser1, dupUser2));
        when(passwordEncoder.encode(anyString())).thenReturn("hashed-decoy");
        when(challengeRepository.save(any(OtpLoginChallenge.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthDtos.OtpLoginRequest req = new AuthDtos.OtpLoginRequest(testMobile, "RETAILER");
        AuthDtos.OtpLoginRequestResponse res = otpLoginService.requestOtp(req, "192.168.1.1", "Chrome");

        assertTrue(res.success());
        assertEquals(OtpLoginServiceImpl.GENERIC_OTP_SENT_MESSAGE, res.message());
        verify(otpProviderRouter, never()).current(); // No SMS sent on ambiguity
    }

    @Test
    void requestOtp_SuspendedAccount_ReturnsDecoyWithoutSendingOtp() {
        mockAppProperties();
        retailerUser.setStatus(UserStatus.INACTIVE);
        when(userRepository.findAllByMobileAndRole(testMobile, RoleName.RETAILER))
                .thenReturn(List.of(retailerUser));
        when(passwordEncoder.encode(anyString())).thenReturn("hashed-decoy");
        when(challengeRepository.save(any(OtpLoginChallenge.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthDtos.OtpLoginRequest req = new AuthDtos.OtpLoginRequest(testMobile, "RETAILER");
        AuthDtos.OtpLoginRequestResponse res = otpLoginService.requestOtp(req, "192.168.1.1", "Chrome");

        assertTrue(res.success());
        assertEquals(OtpLoginServiceImpl.GENERIC_OTP_SENT_MESSAGE, res.message());
        verify(otpProviderRouter, never()).current();
    }

    @Test
    void requestOtp_InvalidMobile_ThrowsException() {
        AuthDtos.OtpLoginRequest req = new AuthDtos.OtpLoginRequest("12345", "RETAILER");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                otpLoginService.requestOtp(req, "127.0.0.1", "Chrome"));
        assertTrue(ex.getMessage().contains("Enter a valid 10-digit mobile number"));
    }

    @Test
    void requestOtp_InvalidRole_ThrowsException() {
        AuthDtos.OtpLoginRequest req = new AuthDtos.OtpLoginRequest(testMobile, "ADMIN");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                otpLoginService.requestOtp(req, "127.0.0.1", "Chrome"));
        assertTrue(ex.getMessage().contains("Invalid portal role"));
    }

    @Test
    void requestOtp_ResendCooldown_ThrowsException() {
        OtpLoginChallenge active = new OtpLoginChallenge();
        active.setStatus(OtpChallengeStatus.PENDING);
        active.setResendAvailableAt(Instant.now().plusSeconds(45));

        when(challengeRepository.findByMobileNumberAndExpectedRoleAndStatus(testMobile, "RETAILER", OtpChallengeStatus.PENDING))
                .thenReturn(List.of(active));

        AuthDtos.OtpLoginRequest req = new AuthDtos.OtpLoginRequest(testMobile, "RETAILER");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                otpLoginService.requestOtp(req, "127.0.0.1", "Chrome"));
        assertTrue(ex.getMessage().contains("Please wait before requesting another OTP"));
    }

    @Test
    void requestOtp_IpRateLimitExceeded_ThrowsException() {
        when(challengeRepository.countByIpAddressAndCreatedAtAfter(eq("10.0.0.1"), any(Instant.class)))
                .thenReturn(20L);

        AuthDtos.OtpLoginRequest req = new AuthDtos.OtpLoginRequest(testMobile, "RETAILER");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                otpLoginService.requestOtp(req, "10.0.0.1", "Chrome"));
        assertTrue(ex.getMessage().contains("Too many OTP requests from this network"));
    }

    @Test
    void requestOtp_MobileRateLimitExceeded_ThrowsException() {
        when(challengeRepository.countByMobileNumberAndCreatedAtAfter(eq(testMobile), any(Instant.class)))
                .thenReturn(6L);

        AuthDtos.OtpLoginRequest req = new AuthDtos.OtpLoginRequest(testMobile, "RETAILER");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                otpLoginService.requestOtp(req, "10.0.0.2", "Chrome"));
        assertTrue(ex.getMessage().contains("Too many OTP requests for this mobile number"));
    }

    @Test
    void requestOtp_SmsProviderFailure_ThrowsSafeException() {
        mockAppProperties();
        when(userRepository.findAllByMobileAndRole(testMobile, RoleName.RETAILER))
                .thenReturn(List.of(retailerUser));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.sendOtp(testMobile)).thenThrow(new RuntimeException("SMS gateway network timeout"));

        AuthDtos.OtpLoginRequest req = new AuthDtos.OtpLoginRequest(testMobile, "RETAILER");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                otpLoginService.requestOtp(req, "192.168.1.1", "Chrome"));
        assertEquals("Unable to send OTP. Please try again later.", ex.getMessage());
    }

    @Test
    void verifyOtp_Success_Retailer_AtomicallyConsumesChallengeAndIssuesSession() {
        String challengeId = UUID.randomUUID().toString();
        OtpLoginChallenge challenge = new OtpLoginChallenge();
        challenge.setChallengeId(challengeId);
        challenge.setMobileNumber(testMobile);
        challenge.setExpectedRole("RETAILER");
        challenge.setUserId(retailerUser.getId());
        challenge.setProviderReference("prov-ref-1");
        challenge.setStatus(OtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setAttemptCount(0);
        challenge.setMaxAttempts(5);

        when(challengeRepository.findWithLockByChallengeId(challengeId)).thenReturn(Optional.of(challenge));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.verifyOtp(testMobile, "654321", "prov-ref-1")).thenReturn(true);
        when(passwordEncoder.encode("654321")).thenReturn("hashed-otp-val");
        when(userRepository.findById(retailerUser.getId())).thenReturn(Optional.of(retailerUser));

        AuthDtos.AuthResponse expectedAuth = new AuthDtos.AuthResponse(
                "mock-access-token", "mock-refresh-token", "Bearer", 28800, null);
        when(authService.issueTokensForUser(retailerUser)).thenReturn(expectedAuth);

        AuthDtos.OtpLoginVerifyRequest verifyReq = new AuthDtos.OtpLoginVerifyRequest(challengeId, "654321", "RETAILER");
        AuthDtos.AuthResponse res = otpLoginService.verifyOtp(verifyReq, "127.0.0.1", "Chrome");

        assertNotNull(res);
        assertEquals("mock-access-token", res.accessToken());
        assertEquals(OtpChallengeStatus.VERIFIED, challenge.getStatus());
        assertNotNull(challenge.getConsumedAt());
        assertEquals("hashed-otp-val", challenge.getOtpHash());
        assertEquals(1, challenge.getAttemptCount());

        verify(challengeRepository, atLeastOnce()).saveAndFlush(challenge);
        verify(authService).issueTokensForUser(retailerUser);
    }

    @Test
    void verifyOtp_MultiRole_SameMobileDifferentRoles_OnlyAuthenticatesMatchingRoleAccount() {
        // Distributor challenge
        String challengeId = UUID.randomUUID().toString();
        OtpLoginChallenge challenge = new OtpLoginChallenge();
        challenge.setChallengeId(challengeId);
        challenge.setMobileNumber(testMobile);
        challenge.setExpectedRole("DISTRIBUTOR");
        challenge.setUserId(distributorUser.getId());
        challenge.setProviderReference("prov-ref-dist");
        challenge.setStatus(OtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setAttemptCount(0);
        challenge.setMaxAttempts(5);

        when(challengeRepository.findWithLockByChallengeId(challengeId)).thenReturn(Optional.of(challenge));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.verifyOtp(testMobile, "112233", "prov-ref-dist")).thenReturn(true);
        when(passwordEncoder.encode("112233")).thenReturn("hashed-dist-otp");
        when(userRepository.findById(distributorUser.getId())).thenReturn(Optional.of(distributorUser));

        AuthDtos.AuthResponse expectedAuth = new AuthDtos.AuthResponse(
                "dist-access-token", "dist-refresh-token", "Bearer", 28800, null);
        when(authService.issueTokensForUser(distributorUser)).thenReturn(expectedAuth);

        AuthDtos.OtpLoginVerifyRequest verifyReq = new AuthDtos.OtpLoginVerifyRequest(challengeId, "112233", "DISTRIBUTOR");
        AuthDtos.AuthResponse res = otpLoginService.verifyOtp(verifyReq, "127.0.0.1", "Chrome");

        assertEquals("dist-access-token", res.accessToken());
        verify(authService).issueTokensForUser(distributorUser);
        verify(authService, never()).issueTokensForUser(retailerUser);
    }

    @Test
    void verifyOtp_DecoyChallenge_Rejected() {
        String challengeId = UUID.randomUUID().toString();
        OtpLoginChallenge decoy = new OtpLoginChallenge();
        decoy.setChallengeId(challengeId);
        decoy.setUserId(null); // Decoy has no user
        decoy.setStatus(OtpChallengeStatus.PENDING);

        when(challengeRepository.findWithLockByChallengeId(challengeId)).thenReturn(Optional.of(decoy));

        AuthDtos.OtpLoginVerifyRequest verifyReq = new AuthDtos.OtpLoginVerifyRequest(challengeId, "123456", "RETAILER");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                otpLoginService.verifyOtp(verifyReq, "127.0.0.1", "Chrome"));
        assertEquals("Incorrect OTP. Please try again.", ex.getMessage());
    }

    @Test
    void verifyOtp_IncorrectOtp_IncrementsAttemptCount() {
        String challengeId = UUID.randomUUID().toString();
        OtpLoginChallenge challenge = new OtpLoginChallenge();
        challenge.setChallengeId(challengeId);
        challenge.setMobileNumber(testMobile);
        challenge.setExpectedRole("RETAILER");
        challenge.setUserId(retailerUser.getId());
        challenge.setProviderReference("prov-ref-1");
        challenge.setStatus(OtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setAttemptCount(1);
        challenge.setMaxAttempts(5);

        when(challengeRepository.findWithLockByChallengeId(challengeId)).thenReturn(Optional.of(challenge));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.verifyOtp(testMobile, "000000", "prov-ref-1")).thenReturn(false);

        AuthDtos.OtpLoginVerifyRequest verifyReq = new AuthDtos.OtpLoginVerifyRequest(challengeId, "000000", "RETAILER");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                otpLoginService.verifyOtp(verifyReq, "127.0.0.1", "Chrome"));

        assertEquals("Incorrect OTP. Please try again.", ex.getMessage());
        assertEquals(2, challenge.getAttemptCount());
        assertEquals(OtpChallengeStatus.PENDING, challenge.getStatus());
    }

    @Test
    void verifyOtp_MaxAttemptsExceeded_BlocksVerification() {
        String challengeId = UUID.randomUUID().toString();
        OtpLoginChallenge challenge = new OtpLoginChallenge();
        challenge.setChallengeId(challengeId);
        challenge.setMobileNumber(testMobile);
        challenge.setExpectedRole("RETAILER");
        challenge.setUserId(retailerUser.getId());
        challenge.setStatus(OtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setAttemptCount(5);
        challenge.setMaxAttempts(5);

        when(challengeRepository.findWithLockByChallengeId(challengeId)).thenReturn(Optional.of(challenge));

        AuthDtos.OtpLoginVerifyRequest verifyReq = new AuthDtos.OtpLoginVerifyRequest(challengeId, "123456", "RETAILER");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                otpLoginService.verifyOtp(verifyReq, "127.0.0.1", "Chrome"));

        assertTrue(ex.getMessage().contains("Maximum verification attempts reached"));
        assertEquals(OtpChallengeStatus.MAX_ATTEMPTS_EXCEEDED, challenge.getStatus());
    }

    @Test
    void verifyOtp_ExpiredChallenge_Rejected() {
        String challengeId = UUID.randomUUID().toString();
        OtpLoginChallenge challenge = new OtpLoginChallenge();
        challenge.setChallengeId(challengeId);
        challenge.setUserId(retailerUser.getId());
        challenge.setStatus(OtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().minusSeconds(10)); // Expired

        when(challengeRepository.findWithLockByChallengeId(challengeId)).thenReturn(Optional.of(challenge));

        AuthDtos.OtpLoginVerifyRequest verifyReq = new AuthDtos.OtpLoginVerifyRequest(challengeId, "123456", "RETAILER");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                otpLoginService.verifyOtp(verifyReq, "127.0.0.1", "Chrome"));

        assertTrue(ex.getMessage().contains("Your OTP has expired"));
        assertEquals(OtpChallengeStatus.EXPIRED, challenge.getStatus());
    }

    @Test
    void verifyOtp_AlreadyConsumedChallenge_Rejected() {
        String challengeId = UUID.randomUUID().toString();
        OtpLoginChallenge challenge = new OtpLoginChallenge();
        challenge.setChallengeId(challengeId);
        challenge.setUserId(retailerUser.getId());
        challenge.setStatus(OtpChallengeStatus.VERIFIED); // Already consumed

        when(challengeRepository.findWithLockByChallengeId(challengeId)).thenReturn(Optional.of(challenge));

        AuthDtos.OtpLoginVerifyRequest verifyReq = new AuthDtos.OtpLoginVerifyRequest(challengeId, "123456", "RETAILER");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                otpLoginService.verifyOtp(verifyReq, "127.0.0.1", "Chrome"));

        assertTrue(ex.getMessage().contains("already been used"));
    }

    @Test
    void verifyOtp_RoleMismatch_Rejected() {
        String challengeId = UUID.randomUUID().toString();
        OtpLoginChallenge challenge = new OtpLoginChallenge();
        challenge.setChallengeId(challengeId);
        challenge.setUserId(retailerUser.getId());
        challenge.setExpectedRole("RETAILER");
        challenge.setStatus(OtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setAttemptCount(0);
        challenge.setMaxAttempts(5);

        when(challengeRepository.findWithLockByChallengeId(challengeId)).thenReturn(Optional.of(challenge));

        AuthDtos.OtpLoginVerifyRequest verifyReq = new AuthDtos.OtpLoginVerifyRequest(challengeId, "123456", "DISTRIBUTOR");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                otpLoginService.verifyOtp(verifyReq, "127.0.0.1", "Chrome"));

        assertTrue(ex.getMessage().contains("Portal role mismatch"));
    }

    @Test
    void verifyOtp_PartnerAccount_IdPaymentPending_ThrowsIdPaymentRequiredException() {
        String challengeId = UUID.randomUUID().toString();
        retailerUser.setIdPaymentStatus(IdPaymentStatus.PENDING);

        OtpLoginChallenge challenge = new OtpLoginChallenge();
        challenge.setChallengeId(challengeId);
        challenge.setMobileNumber(testMobile);
        challenge.setExpectedRole("RETAILER");
        challenge.setUserId(retailerUser.getId());
        challenge.setProviderReference("prov-ref-1");
        challenge.setStatus(OtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setAttemptCount(0);
        challenge.setMaxAttempts(5);

        when(challengeRepository.findWithLockByChallengeId(challengeId)).thenReturn(Optional.of(challenge));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.verifyOtp(testMobile, "654321", "prov-ref-1")).thenReturn(true);
        when(passwordEncoder.encode("654321")).thenReturn("hashed-otp-val");
        when(userRepository.findById(retailerUser.getId())).thenReturn(Optional.of(retailerUser));

        AuthDtos.OtpLoginVerifyRequest verifyReq = new AuthDtos.OtpLoginVerifyRequest(challengeId, "654321", "RETAILER");
        IdPaymentRequiredException ex = assertThrows(IdPaymentRequiredException.class, () ->
                otpLoginService.verifyOtp(verifyReq, "127.0.0.1", "Chrome"));

        assertNotNull(ex);
        assertEquals(retailerUser.getId().toString(), ex.getUserId());
        assertEquals("PENDING", ex.getPaymentStatus());
        verify(authService, never()).issueTokensForUser(any());
    }

    @Test
    void resendOtp_Success_InvalidatesOldAndCreatesNewChallenge() {
        mockAppProperties();
        String oldChallengeId = UUID.randomUUID().toString();
        OtpLoginChallenge oldChallenge = new OtpLoginChallenge();
        oldChallenge.setChallengeId(oldChallengeId);
        oldChallenge.setMobileNumber(testMobile);
        oldChallenge.setExpectedRole("RETAILER");
        oldChallenge.setUserId(retailerUser.getId());
        oldChallenge.setStatus(OtpChallengeStatus.PENDING);
        oldChallenge.setResendAvailableAt(Instant.now().minusSeconds(10)); // Cooldown elapsed

        when(challengeRepository.findByChallengeId(oldChallengeId)).thenReturn(Optional.of(oldChallenge));
        when(userRepository.findById(retailerUser.getId())).thenReturn(Optional.of(retailerUser));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.sendOtp(testMobile)).thenReturn("new-prov-ref");
        when(passwordEncoder.encode("new-prov-ref")).thenReturn("new-hash");
        when(challengeRepository.save(any(OtpLoginChallenge.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthDtos.OtpLoginResendRequest req = new AuthDtos.OtpLoginResendRequest(oldChallengeId);
        AuthDtos.OtpLoginRequestResponse res = otpLoginService.resendOtp(req, "127.0.0.1", "Chrome");

        assertTrue(res.success());
        assertEquals(OtpChallengeStatus.SUPERSEDED, oldChallenge.getStatus());
        assertNotEquals(oldChallengeId, res.challengeId());
        verify(otpProvider).sendOtp(testMobile);
    }
}

