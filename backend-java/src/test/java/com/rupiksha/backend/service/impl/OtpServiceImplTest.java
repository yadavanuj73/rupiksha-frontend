package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.OtpDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.integration.otp.OtpProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OtpServiceImplTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private OtpProviderRouter otpProviderRouter;

    @Mock
    private OtpProvider otpProvider;

    @Mock
    private AppProperties appProperties;

    private OtpServiceImpl otpService;

    @BeforeEach
    void setUp() {
        lenient().when(appProperties.otp()).thenReturn(new AppProperties.Otp(300, 3));
        lenient().when(otpProviderRouter.current()).thenReturn(otpProvider);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        otpService = new OtpServiceImpl(redisTemplate, otpProviderRouter, appProperties);
    }

    @Test
    @DisplayName("Send OTP requests reference from current provider and caches it")
    void sendOtp_success() {
        when(otpProvider.providerName()).thenReturn("dove_soft");
        when(otpProvider.sendOtp("9876543210")).thenReturn("REF_12345");

        OtpDtos.OtpResponse resp = otpService.sendOtp(new OtpDtos.SendOtpRequest("9876543210"));

        assertThat(resp.success()).isTrue();
        assertThat(resp.message()).isEqualTo("OTP sent successfully");
        verify(valueOperations).set(eq("otp:ref:9876543210"), eq("REF_12345"), any(Duration.class));
    }

    @Test
    @DisplayName("Verify OTP with valid code stores registration token and clears reference")
    void verifyOtp_success_storesRegistrationToken() {
        when(valueOperations.get("otp:ref:9876543210")).thenReturn("REF_12345");
        when(otpProvider.verifyOtp("9876543210", "654321", "REF_12345")).thenReturn(true);

        OtpDtos.OtpResponse resp = otpService.verifyOtp(new OtpDtos.VerifyOtpRequest("9876543210", "654321"));

        assertThat(resp.success()).isTrue();
        verify(redisTemplate).delete("otp:ref:9876543210");
        verify(valueOperations).set(eq("reg:verified:9876543210"), eq("654321"), any(Duration.class));
    }

    @Test
    @DisplayName("Test bypass OTP 123456 is REJECTED when real SMS provider rejects verification")
    void verifyOtp_123456_isRejectedWhenProviderFails() {
        when(valueOperations.get("otp:ref:9876543210")).thenReturn("REF_12345");
        when(otpProvider.verifyOtp("9876543210", "123456", "REF_12345")).thenReturn(false);

        OtpDtos.OtpResponse resp = otpService.verifyOtp(new OtpDtos.VerifyOtpRequest("9876543210", "123456"));

        assertThat(resp.success()).isFalse();
        assertThat(resp.message()).isEqualTo("Invalid OTP");
        verify(redisTemplate, never()).delete("otp:ref:9876543210");
        verify(valueOperations, never()).set(eq("reg:verified:9876543210"), any(), any());
    }

    @Test
    @DisplayName("Registration verification is atomic and single-use (cannot be replayed or reused)")
    void verifyAndConsumeRegistration_consumedOnlyOnce() {
        when(valueOperations.get("reg:verified:9876543210"))
                .thenReturn("654321")
                .thenReturn(null); // Second read returns null after deletion

        // First registration attempt succeeds and consumes token
        boolean firstAttempt = otpService.verifyAndConsumeRegistration("9876543210", "654321");
        assertThat(firstAttempt).isTrue();
        verify(redisTemplate).delete("reg:verified:9876543210");

        // Second registration attempt with same details is rejected
        boolean secondAttempt = otpService.verifyAndConsumeRegistration("9876543210", "654321");
        assertThat(secondAttempt).isFalse();
    }

    @Test
    @DisplayName("Registration verification fails when no verification session exists")
    void verifyAndConsumeRegistration_noSession_fails() {
        when(valueOperations.get("reg:verified:9876543210")).thenReturn(null);
        when(valueOperations.get("otp:ref:9876543210")).thenReturn(null);

        boolean ok = otpService.verifyAndConsumeRegistration("9876543210", "111111");
        assertThat(ok).isFalse();
    }
}
