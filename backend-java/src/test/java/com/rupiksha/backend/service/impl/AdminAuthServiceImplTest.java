package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.AdminAuthDtos;
import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.integration.otp.OtpProvider;
import com.rupiksha.backend.repository.AdminOtpChallengeRepository;
import com.rupiksha.backend.repository.RefreshTokenRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtService;
import com.rupiksha.backend.service.AdminAuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
class AdminAuthServiceImplTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private AdminOtpChallengeRepository challengeRepository;
    @Mock
    private AdminAuditService auditService;
    @Mock
    private OtpProviderRouter otpProviderRouter;
    @Mock
    private OtpProvider otpProvider;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private AppProperties appProperties;

    private AdminDestinationService destinationService;
    private AdminAuthServiceImpl adminAuthService;

    private User adminUser;
    private Role adminRole;

    @BeforeEach
    void setUp() {
        destinationService = new AdminDestinationService();
        ReflectionTestUtils.setField(destinationService, "adminPhone1", "7292987918");
        ReflectionTestUtils.setField(destinationService, "adminPhone2", "9679729762");

        adminAuthService = new AdminAuthServiceImpl(
                userRepository,
                challengeRepository,
                destinationService,
                auditService,
                otpProviderRouter,
                passwordEncoder,
                jwtService,
                refreshTokenRepository,
                appProperties
        );

        adminRole = new Role();
        adminRole.setName(RoleName.ADMIN);

        adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setUsername("admin");
        adminUser.setPasswordHash("hashed_pw");
        adminUser.setStatus(UserStatus.ACTIVE);
        adminUser.setRoles(Set.of(adminRole));
        adminUser.setAdminSessionVersion(2);
    }

    @Test
    @DisplayName("Test 1 & 2: Initiate Login with valid admin credentials returns challenge and masked destinations")
    void initiateLogin_ValidAdminCredentials_ReturnsChallengeAndMaskedDestinations() {
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));
        when(passwordEncoder.matches("secret123", "hashed_pw")).thenReturn(true);
        when(challengeRepository.findByAdminUserIdAndStatus(any(), eq(AdminOtpChallengeStatus.PENDING)))
                .thenReturn(Collections.emptyList());
        when(challengeRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        AdminAuthDtos.AdminLoginInitResponse response = adminAuthService.initiateLogin(
                new AdminAuthDtos.AdminLoginRequest("admin", "secret123"),
                "127.0.0.1", "Mozilla/5.0", "corr-1"
        );

        assertTrue(response.success());
        assertNotNull(response.challengeId());
        assertEquals(2, response.destinations().size());
        assertEquals("ADMIN_PHONE_1", response.destinations().get(0).id());
        assertEquals("XXXXXXX918", response.destinations().get(0).masked());
        assertEquals("ADMIN_PHONE_2", response.destinations().get(1).id());
        assertEquals("XXXXXXX762", response.destinations().get(1).masked());

        verify(auditService).logEvent(eq(AdminAuthAuditEventType.PASSWORD_AUTH_SUCCESS), any(), eq("admin"),
                eq("ADMIN"), isNull(), isNull(), eq("127.0.0.1"), any(), eq("corr-1"), eq("SUCCESS"), isNull(), any(), any(), any());
    }

    @Test
    @DisplayName("Test 3: Incorrect password throws exception and records audit event")
    void initiateLogin_IncorrectPassword_ThrowsException() {
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));
        when(passwordEncoder.matches("wrong_pw", "hashed_pw")).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                adminAuthService.initiateLogin(
                        new AdminAuthDtos.AdminLoginRequest("admin", "wrong_pw"),
                        "127.0.0.1", "Mozilla/5.0", "corr-2"
                )
        );

        assertEquals("Invalid admin credentials.", ex.getMessage());
        verify(auditService).logEvent(eq(AdminAuthAuditEventType.PASSWORD_AUTH_FAILED), any(), eq("admin"),
                eq("ADMIN"), isNull(), isNull(), eq("127.0.0.1"), any(), eq("corr-2"), eq("FAILURE"), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Test 29: Non-admin user (e.g. Retailer) cannot initiate admin login")
    void initiateLogin_RetailerUser_RejectedWithUnauthorized() {
        Role retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);
        User retailerUser = new User();
        retailerUser.setId(UUID.randomUUID());
        retailerUser.setUsername("retailer1");
        retailerUser.setPasswordHash("hashed_pw");
        retailerUser.setStatus(UserStatus.ACTIVE);
        retailerUser.setRoles(Set.of(retailerRole));

        when(userRepository.findByUsername("retailer1")).thenReturn(Optional.of(retailerUser));
        when(passwordEncoder.matches("secret", "hashed_pw")).thenReturn(true);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                adminAuthService.initiateLogin(
                        new AdminAuthDtos.AdminLoginRequest("retailer1", "secret"),
                        "127.0.0.1", "Mozilla/5.0", "corr-3"
                )
        );

        assertTrue(ex.getMessage().contains("not authorized"));
    }

    @Test
    @DisplayName("Test 9 & 10: Send OTP with invalid/unapproved destination throws exception")
    void sendOtp_UnapprovedDestination_ThrowsException() {
        AdminOtpChallenge challenge = new AdminOtpChallenge();
        challenge.setChallengeId("chal-123");
        challenge.setAdminUserId(adminUser.getId());
        challenge.setAdminUsername("admin");
        challenge.setStatus(AdminOtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setResendAvailableAt(Instant.now().minusSeconds(10));

        when(challengeRepository.findWithLockByChallengeId("chal-123")).thenReturn(Optional.of(challenge));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                adminAuthService.sendOtp(
                        new AdminAuthDtos.AdminSendOtpRequest("chal-123", "ARBITRARY_PHONE_9999999999"),
                        "127.0.0.1", "Mozilla/5.0", "corr-4"
                )
        );

        assertTrue(ex.getMessage().contains("Unauthorized destination") || ex.getMessage().contains("Invalid destination"));
    }

    @Test
    @DisplayName("Test 1: Send OTP with ADMIN_PHONE_1 generates OTP and calls real provider for 7292987918")
    void sendOtp_AdminPhone1_DeliversToAuthorizedNumber() {
        AdminOtpChallenge challenge = new AdminOtpChallenge();
        challenge.setChallengeId("chal-123");
        challenge.setAdminUserId(adminUser.getId());
        challenge.setAdminUsername("admin");
        challenge.setStatus(AdminOtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setResendAvailableAt(Instant.now().minusSeconds(10));

        when(challengeRepository.findWithLockByChallengeId("chal-123")).thenReturn(Optional.of(challenge));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.sendOtp("7292987918")).thenReturn("dovesoft-ref-111");
        when(passwordEncoder.encode(anyString())).thenReturn("salted_otp_hash");

        AdminAuthDtos.AdminSendOtpResponse response = adminAuthService.sendOtp(
                new AdminAuthDtos.AdminSendOtpRequest("chal-123", "ADMIN_PHONE_1"),
                "127.0.0.1", "Mozilla/5.0", "corr-5"
        );

        assertTrue(response.success());
        assertEquals("XXXXXXX918", response.maskedDestination());
        assertEquals("dovesoft-ref-111", challenge.getProviderReference());
        assertEquals("salted_otp_hash", challenge.getOtpHash());
        assertEquals("ADMIN_PHONE_1", challenge.getDestinationIdentifier());
        verify(otpProvider).sendOtp("7292987918");
    }

    @Test
    @DisplayName("Test 2: Send OTP with ADMIN_PHONE_2 delivers to 9679729762")
    void sendOtp_AdminPhone2_DeliversToSecondAuthorizedNumber() {
        AdminOtpChallenge challenge = new AdminOtpChallenge();
        challenge.setChallengeId("chal-456");
        challenge.setAdminUserId(adminUser.getId());
        challenge.setAdminUsername("admin");
        challenge.setStatus(AdminOtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setResendAvailableAt(Instant.now().minusSeconds(10));

        when(challengeRepository.findWithLockByChallengeId("chal-456")).thenReturn(Optional.of(challenge));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.sendOtp("9679729762")).thenReturn("dovesoft-ref-222");
        when(passwordEncoder.encode(anyString())).thenReturn("salted_otp_hash_2");

        AdminAuthDtos.AdminSendOtpResponse response = adminAuthService.sendOtp(
                new AdminAuthDtos.AdminSendOtpRequest("chal-456", "ADMIN_PHONE_2"),
                "127.0.0.1", "Mozilla/5.0", "corr-6"
        );

        assertTrue(response.success());
        assertEquals("XXXXXXX762", response.maskedDestination());
        verify(otpProvider).sendOtp("9679729762");
    }

    @Test
    @DisplayName("Test 12: SMS Provider failure does not issue authenticated session")
    void sendOtp_ProviderFailure_ThrowsExceptionAndDoesNotIssueTokens() {
        AdminOtpChallenge challenge = new AdminOtpChallenge();
        challenge.setChallengeId("chal-fail");
        challenge.setAdminUserId(adminUser.getId());
        challenge.setAdminUsername("admin");
        challenge.setStatus(AdminOtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setResendAvailableAt(Instant.now().minusSeconds(10));

        when(challengeRepository.findWithLockByChallengeId("chal-fail")).thenReturn(Optional.of(challenge));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.sendOtp(anyString())).thenThrow(new RuntimeException("Gateway timed out"));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                adminAuthService.sendOtp(
                        new AdminAuthDtos.AdminSendOtpRequest("chal-fail", "ADMIN_PHONE_1"),
                        "127.0.0.1", "Mozilla/5.0", "corr-7"
                )
        );

        assertTrue(ex.getMessage().contains("Unable to deliver verification code"));
        verify(auditService).logEvent(eq(AdminAuthAuditEventType.OTP_SMS_DELIVERY_FAILED), any(), any(),
                any(), any(), any(), any(), any(), any(), eq("FAILURE"), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Test 4 & 5: Arbitrary or incorrect 6-digit OTP is rejected")
    void verifyOtp_ArbitraryOrIncorrectOtp_Rejected() {
        AdminOtpChallenge challenge = new AdminOtpChallenge();
        challenge.setChallengeId("chal-verify-1");
        challenge.setAdminUserId(adminUser.getId());
        challenge.setAdminUsername("admin");
        challenge.setDestinationIdentifier("ADMIN_PHONE_1");
        challenge.setMaskedDestination("XXXXXXX918");
        challenge.setOtpHash("some_bcrypt_hash");
        challenge.setProviderReference("prov-ref-1");
        challenge.setStatus(AdminOtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setAttemptCount(0);
        challenge.setMaxAttempts(5);

        when(challengeRepository.findWithLockByChallengeId("chal-verify-1")).thenReturn(Optional.of(challenge));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.verifyOtp("7292987918", "123456", "prov-ref-1")).thenReturn(false);
        when(passwordEncoder.matches("123456", "some_bcrypt_hash")).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                adminAuthService.verifyOtp(
                        new AdminAuthDtos.AdminVerifyOtpRequest("chal-verify-1", "123456"),
                        "127.0.0.1", "Mozilla/5.0", "corr-8"
                )
        );

        assertTrue(ex.getMessage().contains("Incorrect verification code"));
        assertEquals(1, challenge.getAttemptCount());
        verify(auditService).logEvent(eq(AdminAuthAuditEventType.OTP_VERIFY_FAILED), any(), eq("admin"),
                eq("ADMIN"), any(), any(), any(), any(), any(), eq("FAILURE"), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Test 6: Expired OTP challenge is rejected")
    void verifyOtp_ExpiredChallenge_Rejected() {
        AdminOtpChallenge challenge = new AdminOtpChallenge();
        challenge.setChallengeId("chal-expired");
        challenge.setAdminUserId(adminUser.getId());
        challenge.setAdminUsername("admin");
        challenge.setStatus(AdminOtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().minusSeconds(10)); // expired

        when(challengeRepository.findWithLockByChallengeId("chal-expired")).thenReturn(Optional.of(challenge));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                adminAuthService.verifyOtp(
                        new AdminAuthDtos.AdminVerifyOtpRequest("chal-expired", "414067"),
                        "127.0.0.1", "Mozilla/5.0", "corr-9"
                )
        );

        assertTrue(ex.getMessage().contains("expired"));
        assertEquals(AdminOtpChallengeStatus.EXPIRED, challenge.getStatus());
    }

    @Test
    @DisplayName("Test 7: Already consumed / verified challenge cannot be reused (replay protection)")
    void verifyOtp_AlreadyConsumedChallenge_Rejected() {
        AdminOtpChallenge challenge = new AdminOtpChallenge();
        challenge.setChallengeId("chal-consumed");
        challenge.setAdminUserId(adminUser.getId());
        challenge.setAdminUsername("admin");
        challenge.setStatus(AdminOtpChallengeStatus.VERIFIED);
        challenge.setConsumedAt(Instant.now().minusSeconds(30));

        when(challengeRepository.findWithLockByChallengeId("chal-consumed")).thenReturn(Optional.of(challenge));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                adminAuthService.verifyOtp(
                        new AdminAuthDtos.AdminVerifyOtpRequest("chal-consumed", "414067"),
                        "127.0.0.1", "Mozilla/5.0", "corr-10"
                )
        );

        assertTrue(ex.getMessage().contains("no longer valid"));
    }

    @Test
    @DisplayName("Test 8: More than 5 incorrect attempts blocks the challenge")
    void verifyOtp_MoreThanFiveIncorrectAttempts_Blocked() {
        AdminOtpChallenge challenge = new AdminOtpChallenge();
        challenge.setChallengeId("chal-block");
        challenge.setAdminUserId(adminUser.getId());
        challenge.setAdminUsername("admin");
        challenge.setDestinationIdentifier("ADMIN_PHONE_1");
        challenge.setStatus(AdminOtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setAttemptCount(4); // this attempt will be the 5th
        challenge.setMaxAttempts(5);

        when(challengeRepository.findWithLockByChallengeId("chal-block")).thenReturn(Optional.of(challenge));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.verifyOtp(anyString(), anyString(), any())).thenReturn(false);
        when(passwordEncoder.matches(anyString(), any())).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                adminAuthService.verifyOtp(
                        new AdminAuthDtos.AdminVerifyOtpRequest("chal-block", "999999"),
                        "127.0.0.1", "Mozilla/5.0", "corr-11"
                )
        );

        assertTrue(ex.getMessage().contains("Maximum attempts reached, challenge blocked"));
        assertEquals(AdminOtpChallengeStatus.MAX_ATTEMPTS_EXCEEDED, challenge.getStatus());
        verify(auditService).logEvent(eq(AdminAuthAuditEventType.OTP_CHALLENGE_BLOCKED), any(), eq("admin"),
                eq("ADMIN"), any(), any(), any(), any(), any(), eq("BLOCKED"), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Test 1 & 24: Correct OTP verified server-side issues tokens with admin session version")
    void verifyOtp_CorrectOtp_IssuesFullTokensWithSessionVersion() {
        AdminOtpChallenge challenge = new AdminOtpChallenge();
        challenge.setChallengeId("chal-success");
        challenge.setAdminUserId(adminUser.getId());
        challenge.setAdminUsername("admin");
        challenge.setDestinationIdentifier("ADMIN_PHONE_1");
        challenge.setMaskedDestination("XXXXXXX918");
        challenge.setOtpHash("salted_hash");
        challenge.setProviderReference("prov-ref-ok");
        challenge.setStatus(AdminOtpChallengeStatus.PENDING);
        challenge.setExpiryAt(Instant.now().plusSeconds(300));
        challenge.setAttemptCount(0);
        challenge.setMaxAttempts(5);

        when(challengeRepository.findWithLockByChallengeId("chal-success")).thenReturn(Optional.of(challenge));
        when(otpProviderRouter.current()).thenReturn(otpProvider);
        when(otpProvider.verifyOtp("7292987918", "654321", "prov-ref-ok")).thenReturn(true);
        when(userRepository.findById(adminUser.getId())).thenReturn(Optional.of(adminUser));
        when(appProperties.jwt()).thenReturn(new AppProperties.Jwt("secret", "rupiksha", 480, 15));
        when(jwtService.createAccessToken(eq(adminUser.getId()), eq("admin"), anyList(), eq(2)))
                .thenReturn("valid_admin_jwt_version_2");

        AuthDtos.AuthResponse response = adminAuthService.verifyOtp(
                new AdminAuthDtos.AdminVerifyOtpRequest("chal-success", "654321"),
                "127.0.0.1", "Mozilla/5.0", "corr-12"
        );

        assertNotNull(response);
        assertEquals("valid_admin_jwt_version_2", response.accessToken());
        assertEquals(AdminOtpChallengeStatus.VERIFIED, challenge.getStatus());
        assertNotNull(challenge.getConsumedAt());

        verify(auditService).logEvent(eq(AdminAuthAuditEventType.OTP_VERIFY_SUCCESS), eq(adminUser.getId()),
                eq("admin"), eq("ADMIN"), eq("XXXXXXX918"), eq("chal-success"), any(), any(), any(), eq("SUCCESS"), isNull(), any(), any(), any());
        verify(auditService).logEvent(eq(AdminAuthAuditEventType.ADMIN_LOGIN_COMPLETED), eq(adminUser.getId()),
                eq("admin"), eq("ADMIN"), eq("XXXXXXX918"), eq("chal-success"), any(), any(), any(), eq("SUCCESS"), isNull(), any(), eq(2), any());
    }

    @Test
    @DisplayName("Test 18: Logout revokes refresh token and increments user session version")
    void logout_RevokesRefreshTokenAndIncrementsSessionVersion() {
        when(userRepository.findById(adminUser.getId())).thenReturn(Optional.of(adminUser));

        adminAuthService.logout("raw-refresh-token", adminUser.getId(), "127.0.0.1", "Mozilla/5.0", "corr-13");

        assertEquals(3, adminUser.getAdminSessionVersion());
        verify(userRepository).save(adminUser);
        verify(auditService).logEvent(eq(AdminAuthAuditEventType.ADMIN_LOGOUT), eq(adminUser.getId()),
                eq("admin"), eq("ADMIN"), any(), any(), any(), any(), any(), eq("SUCCESS"), any(), any(), eq(3), any());
    }
}
