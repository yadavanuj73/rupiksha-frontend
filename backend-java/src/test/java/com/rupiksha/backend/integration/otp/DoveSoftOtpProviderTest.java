package com.rupiksha.backend.integration.otp;

import com.rupiksha.backend.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.AdditionalMatchers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DoveSoftOtpProviderTest {

    @Mock
    private AppProperties appProperties;

    @Mock
    private RestTemplateBuilder restTemplateBuilder;

    @Mock
    private RestTemplate restTemplate;

    private DoveSoftOtpProvider provider;

    @BeforeEach
    void setUp() {
        provider = new DoveSoftOtpProvider(appProperties, restTemplateBuilder);
        ReflectionTestUtils.setField(provider, "envApiKey", "test-dovesoft-api-key");
        ReflectionTestUtils.setField(provider, "envBaseUrl", "https://api.dovesoft.io");
        ReflectionTestUtils.setField(provider, "envTimeToAlive", 200);
        ReflectionTestUtils.setField(provider, "envMessage", "");
    }

    @Test
    void providerName_ShouldReturnDovesoft() {
        assertEquals("dovesoft", provider.providerName());
    }

    @Test
    void resolveMessageTemplate_DefaultTemplateMatchesUserDltTemplate() {
        String template = provider.resolveMessageTemplate();
        assertTrue(template.contains("Dear User Your One Tine Password is {otp}"));
        assertTrue(template.contains("Thanks You."));
        assertTrue(template.contains("Rupiksha Services Private Limeted"));
    }

    @Test
    void resolveMessageTemplate_SafeguardsMissingOtpPlaceholder() {
        ReflectionTestUtils.setField(provider, "envMessage", "Dear User Your One Tine Password is \n\nThanks You.\nRupiksha Services Private Limeted");
        String template = provider.resolveMessageTemplate();
        assertTrue(template.contains("Dear User Your One Tine Password is {otp}"));
    }

    @Test
    void sendOtp_Success_WithOtpIdReturned() {
        when(restTemplateBuilder.build()).thenReturn(restTemplate);
        Map<String, Object> responseBody = Map.of(
                "result", "success",
                "otpId", "987654321"
        );
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        String ref = provider.sendOtp("9876543210");

        assertEquals("987654321", ref);
        verify(restTemplate).exchange(
                argThat((String url) -> url.contains("mobileno=9876543210") && url.contains("timetoalive=200")),
                eq(HttpMethod.POST),
                argThat((HttpEntity<?> entity) -> "test-dovesoft-api-key".equals(entity.getHeaders().getFirst("key"))),
                eq(Map.class)
        );
    }

    @Test
    void sendOtp_Success_WithoutOtpId_ReturnsSuccessString() {
        when(restTemplateBuilder.build()).thenReturn(restTemplate);
        Map<String, Object> responseBody = Map.of(
                "result", "success"
        );
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        String ref = provider.sendOtp("+91 98765 43210");

        assertEquals("success", ref);
    }

    @Test
    void sendOtp_Failure_ThrowsIllegalArgumentException() {
        when(restTemplateBuilder.build()).thenReturn(restTemplate);
        Map<String, Object> responseBody = Map.of(
                "result", "fail",
                "reason", "Insufficient balance"
        );
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> provider.sendOtp("9876543210"));
        assertTrue(ex.getMessage().contains("Insufficient balance"));
    }

    @Test
    void sendOtp_MissingApiKey_ThrowsException() {
        ReflectionTestUtils.setField(provider, "envApiKey", "");
        when(appProperties.providers()).thenReturn(null);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> provider.sendOtp("9876543210"));
        assertTrue(ex.getMessage().contains("key not configured"));
    }

    @Test
    void sendOtp_InvalidMobile_ThrowsException() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> provider.sendOtp("12345"));
        assertTrue(ex.getMessage().contains("Exactly 10 digits required"));
    }

    @Test
    void verifyOtp_Success_WithDirectResponse() {
        when(restTemplateBuilder.build()).thenReturn(restTemplate);
        Map<String, Object> responseBody = Map.of("result", "success");
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(responseBody, HttpStatus.OK));

        boolean verified = provider.verifyOtp("9876543210", "414067", "987654321");

        assertTrue(verified);
        verify(restTemplate).exchange(
                argThat((String url) -> url.contains("mobileno=9876543210") && url.contains("otp=414067") && url.contains("otpid=987654321")),
                eq(HttpMethod.POST),
                argThat((HttpEntity<?> entity) -> "test-dovesoft-api-key".equals(entity.getHeaders().getFirst("key"))),
                eq(Map.class)
        );
    }

    @Test
    void verifyOtp_Success_ViaFallbackWithoutOtpid() {
        when(restTemplateBuilder.build()).thenReturn(restTemplate);
        Map<String, Object> failBody = Map.of("result", "fail", "message", "otpid expired");
        Map<String, Object> successBody = Map.of("result", "success");

        when(restTemplate.exchange(contains("otpid="), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(failBody, HttpStatus.OK));
        when(restTemplate.exchange(AdditionalMatchers.not(contains("otpid=")), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(successBody, HttpStatus.OK));

        boolean verified = provider.verifyOtp("9876543210", "414067", "old_otpid_123");

        assertTrue(verified);
    }

    @Test
    void verifyOtp_Failure_ReturnsFalse() {
        when(restTemplateBuilder.build()).thenReturn(restTemplate);
        Map<String, Object> failBody = Map.of("result", "fail", "message", "Invalid OTP");
        when(restTemplate.exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Map.class)))
                .thenReturn(new ResponseEntity<>(failBody, HttpStatus.OK));

        boolean verified = provider.verifyOtp("9876543210", "000000", "success");

        assertFalse(verified);
    }

    @Test
    void verifyOtp_BlankOtp_ReturnsFalseImmediately() {
        assertFalse(provider.verifyOtp("9876543210", "", "success"));
        assertFalse(provider.verifyOtp("9876543210", null, "success"));
    }
}
