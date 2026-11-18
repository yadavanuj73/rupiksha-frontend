package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.api.dto.OtpDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.Role;
import com.rupiksha.backend.domain.RoleName;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.RefreshTokenRepository;
import com.rupiksha.backend.repository.RoleRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.UserServiceRepository;
import com.rupiksha.backend.repository.WalletRepository;
import com.rupiksha.backend.security.JwtService;
import com.rupiksha.backend.service.OtpService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private WalletRepository walletRepository;
    @Mock
    private UserServiceRepository userServiceRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;
    @Mock
    private OtpService otpService;
    @Mock
    private AppProperties appProperties;

    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        authService = new AuthServiceImpl(
                userRepository,
                roleRepository,
                refreshTokenRepository,
                walletRepository,
                userServiceRepository,
                passwordEncoder,
                jwtService,
                otpService,
                appProperties
        );
    }

    @Test
    void forgotPasswordSendOtp_withDistributorRole_resolvesCorrectAccount() {
        User distUser = new User();
        distUser.setId(UUID.randomUUID());
        distUser.setMobile("9876543210");
        distUser.setUsername("dist_user");

        when(userRepository.findAllByMobileAndRole(eq("9876543210"), eq(RoleName.DISTRIBUTOR)))
                .thenReturn(List.of(distUser));
        when(otpService.sendOtp(any())).thenReturn(new OtpDtos.OtpResponse(true, "OTP sent successfully"));

        AuthDtos.ForgotPasswordRequest request = new AuthDtos.ForgotPasswordRequest("9876543210", "DISTRIBUTOR");
        OtpDtos.OtpResponse response = authService.forgotPasswordSendOtp(request);

        assertThat(response.success()).isTrue();
        verify(userRepository).findAllByMobileAndRole("9876543210", RoleName.DISTRIBUTOR);
        verify(otpService).sendOtp(any());
    }

    @Test
    void forgotPasswordSendOtp_nonExistentUser_returnsAntiEnumerationSuccessWithoutCallingSms() {
        when(userRepository.findAllByMobileAndRole(eq("9876543210"), eq(RoleName.SUPER_DISTRIBUTOR)))
                .thenReturn(Collections.emptyList());

        AuthDtos.ForgotPasswordRequest request = new AuthDtos.ForgotPasswordRequest("9876543210", "SUPER_DISTRIBUTOR");
        OtpDtos.OtpResponse response = authService.forgotPasswordSendOtp(request);

        assertThat(response.success()).isTrue();
        assertThat(response.message()).contains("If an eligible Rupiksha account exists");
        verify(otpService, never()).sendOtp(any());
    }

    @Test
    void resetPassword_withRole_updatesOnlyTargetAccount() {
        User distUser = new User();
        distUser.setId(UUID.randomUUID());
        distUser.setMobile("9876543210");
        distUser.setUsername("dist_user");

        when(userRepository.findAllByMobileAndRole(eq("9876543210"), eq(RoleName.DISTRIBUTOR)))
                .thenReturn(List.of(distUser));
        when(otpService.verifyOtp(any())).thenReturn(new OtpDtos.OtpResponse(true, "OTP verified"));
        when(passwordEncoder.encode("NewSecret123")).thenReturn("encodedPassword");

        AuthDtos.ResetPasswordRequest request = new AuthDtos.ResetPasswordRequest("9876543210", "123456", "NewSecret123", "DISTRIBUTOR");
        OtpDtos.OtpResponse response = authService.resetPassword(request);

        assertThat(response.success()).isTrue();
        assertThat(distUser.getPasswordHash()).isEqualTo("encodedPassword");
        assertThat(distUser.getPasswordLastChanged()).isNotNull();
        verify(userRepository).save(distUser);
    }

    @Test
    void forgotPinSendOtp_withSuperDistributorRole_resolvesCorrectAccount() {
        User sdUser = new User();
        sdUser.setId(UUID.randomUUID());
        sdUser.setMobile("9876543210");
        sdUser.setUsername("sd_user");

        when(userRepository.findAllByMobileAndRole(eq("9876543210"), eq(RoleName.SUPER_DISTRIBUTOR)))
                .thenReturn(List.of(sdUser));
        when(otpService.sendOtp(any())).thenReturn(new OtpDtos.OtpResponse(true, "OTP sent successfully"));

        AuthDtos.ForgotPinRequest request = new AuthDtos.ForgotPinRequest("9876543210", "SUPER_DISTRIBUTOR");
        OtpDtos.OtpResponse response = authService.forgotPinSendOtp(request);

        assertThat(response.success()).isTrue();
        verify(userRepository).findAllByMobileAndRole("9876543210", RoleName.SUPER_DISTRIBUTOR);
        verify(otpService).sendOtp(any());
    }

    @Test
    void resetPin_withRole_updatesOnlyTargetAccountPin() {
        User distUser = new User();
        distUser.setId(UUID.randomUUID());
        distUser.setMobile("9876543210");
        distUser.setUsername("dist_user");

        when(userRepository.findAllByMobileAndRole(eq("9876543210"), eq(RoleName.DISTRIBUTOR)))
                .thenReturn(List.of(distUser));
        when(otpService.verifyOtp(any())).thenReturn(new OtpDtos.OtpResponse(true, "OTP verified"));
        when(passwordEncoder.encode("1234")).thenReturn("encodedPin");

        AuthDtos.ResetPinRequest request = new AuthDtos.ResetPinRequest("9876543210", "123456", "1234", "DISTRIBUTOR");
        OtpDtos.OtpResponse response = authService.resetPin(request);

        assertThat(response.success()).isTrue();
        assertThat(distUser.getPinHash()).isEqualTo("encodedPin");
        assertThat(distUser.getPinLastChanged()).isNotNull();
        verify(userRepository).save(distUser);
    }

    @Test
    void resolveUserForRecovery_whenAmbiguityExists_rejectsWithoutResetting() {
        User user1 = new User();
        User user2 = new User();

        when(userRepository.findAllByMobileAndRole(eq("9876543210"), eq(RoleName.DISTRIBUTOR)))
                .thenReturn(List.of(user1, user2));

        AuthDtos.ForgotPasswordRequest request = new AuthDtos.ForgotPasswordRequest("9876543210", "DISTRIBUTOR");
        OtpDtos.OtpResponse response = authService.forgotPasswordSendOtp(request);

        assertThat(response.success()).isTrue();
        verify(otpService, never()).sendOtp(any());
    }
}
