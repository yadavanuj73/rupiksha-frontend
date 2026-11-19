package com.rupiksha.aeps.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.dto.*;
import com.rupiksha.aeps.repository.PayoutStatusHistoryRepository;
import com.rupiksha.aeps.service.PayoutOtpService;
import com.rupiksha.aeps.service.PayoutReconciliationService;
import com.rupiksha.aeps.service.PayoutService;
import com.rupiksha.backend.security.JwtPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.math.BigDecimal;
import java.security.Principal;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PayoutControllerTest {

    private MockMvc mockMvc;

    @Mock
    private PayoutService payoutService;
    @Mock
    private PayoutReconciliationService payoutReconciliationService;
    @Mock
    private PayoutStatusHistoryRepository payoutStatusHistoryRepository;
    @Mock
    private PayoutOtpService payoutOtpService;

    @InjectMocks
    private PayoutController payoutController;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String testUserId = "ecf4d499-1b8a-4db7-8325-95a874fbae8e";

    @BeforeEach
    void setUp() {
        // Custom argument resolver to inject JwtPrincipal and Principal for testing controller
        HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class)
                        || parameter.getParameterType().isAssignableFrom(JwtPrincipal.class)
                        || parameter.getParameterType().isAssignableFrom(Authentication.class)
                        || parameter.getParameterType().isAssignableFrom(Principal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                          NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
                if (parameter.getParameterType().isAssignableFrom(Authentication.class)) {
                    Authentication auth = mock(Authentication.class);
                    when(auth.getName()).thenReturn(testUserId);
                    return auth;
                }
                return new JwtPrincipal(testUserId, "retailer_test", java.util.List.of("RETAILER"));
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(payoutController)
                .setCustomArgumentResolvers(principalResolver)
                .build();
    }

    @Test
    @DisplayName("Controller: POST /api/v1/payout/otp/send returns challenge and masked mobile")
    void testSendOtpEndpoint_Success() throws Exception {
        PayoutOtpSendRequest req = PayoutOtpSendRequest.builder()
                .amount(new BigDecimal("1000.00"))
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .beneficiaryName("Test Beneficiary")
                .transferMode("IMPS")
                .build();

        PayoutOtpSendResponse res = PayoutOtpSendResponse.builder()
                .success(true)
                .message("OTP has been sent to your registered mobile number.")
                .challengeId("POC_CHAL_12345")
                .payoutIntentId("POI_INT_12345")
                .maskedMobile("******3210")
                .resendCooldownSeconds(60)
                .expiresInSeconds(300)
                .amount(new BigDecimal("1000.00"))
                .totalCharges(new BigDecimal("6.49"))
                .totalDeduction(new BigDecimal("1006.49"))
                .build();

        when(payoutOtpService.sendOtp(any(PayoutOtpSendRequest.class), anyString(), anyString(), any()))
                .thenReturn(res);

        mockMvc.perform(post("/api/v1/payout/otp/send")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.challengeId").value("POC_CHAL_12345"))
                .andExpect(jsonPath("$.maskedMobile").value("******3210"))
                .andExpect(jsonPath("$.totalDeduction").value(1006.49));
    }

    @Test
    @DisplayName("Controller: POST /api/v1/payout/otp/verify returns single-use authorizationReference")
    void testVerifyOtpEndpoint_Success() throws Exception {
        PayoutOtpVerifyRequest req = PayoutOtpVerifyRequest.builder()
                .challengeId("POC_CHAL_12345")
                .otp("123456")
                .amount(new BigDecimal("1000.00"))
                .accountNumber("123456789012")
                .ifsc("SBIN0001234")
                .transferMode("IMPS")
                .build();

        PayoutOtpVerifyResponse res = PayoutOtpVerifyResponse.builder()
                .success(true)
                .message("OTP verified successfully.")
                .authorizationReference("AUTH_PO_SECURE_TOKEN_XYZ")
                .payoutIntentId("POI_INT_12345")
                .expiresInSeconds(300)
                .build();

        when(payoutOtpService.verifyOtp(any(PayoutOtpVerifyRequest.class), anyString(), anyString(), any()))
                .thenReturn(res);

        mockMvc.perform(post("/api/v1/payout/otp/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.authorizationReference").value("AUTH_PO_SECURE_TOKEN_XYZ"));
    }
}
