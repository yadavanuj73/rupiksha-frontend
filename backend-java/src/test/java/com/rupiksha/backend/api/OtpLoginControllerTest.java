package com.rupiksha.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.service.AuthService;
import com.rupiksha.backend.service.OtpLoginService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
public class OtpLoginControllerTest {

    private MockMvc mockMvc;

    @Mock
    private AuthService authService;

    @Mock
    private OtpLoginService otpLoginService;

    @InjectMocks
    private AuthController authController;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(authController).build();
    }

    @Test
    void requestOtpLogin_Success() throws Exception {
        AuthDtos.OtpLoginRequest req = new AuthDtos.OtpLoginRequest("9876543210", "RETAILER");
        AuthDtos.OtpLoginRequestResponse res = new AuthDtos.OtpLoginRequestResponse(
                true, "If an eligible Rupiksha account exists for this mobile number, an OTP will be sent.", "chal-123", 60, 300);

        when(otpLoginService.requestOtp(any(AuthDtos.OtpLoginRequest.class), anyString(), any()))
                .thenReturn(res);

        mockMvc.perform(post("/api/v1/auth/otp-login/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.challengeId").value("chal-123"))
                .andExpect(jsonPath("$.cooldownSeconds").value(60));
    }

    @Test
    void verifyOtpLogin_Success() throws Exception {
        AuthDtos.OtpLoginVerifyRequest req = new AuthDtos.OtpLoginVerifyRequest("chal-123", "123456", "RETAILER");
        AuthDtos.AuthResponse res = new AuthDtos.AuthResponse("acc-token", "ref-token", "Bearer", 28800, null);

        when(otpLoginService.verifyOtp(any(AuthDtos.OtpLoginVerifyRequest.class), anyString(), any()))
                .thenReturn(res);

        mockMvc.perform(post("/api/v1/auth/otp-login/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("acc-token"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"));
    }

    @Test
    void resendOtpLogin_Success() throws Exception {
        AuthDtos.OtpLoginResendRequest req = new AuthDtos.OtpLoginResendRequest("chal-123");
        AuthDtos.OtpLoginRequestResponse res = new AuthDtos.OtpLoginRequestResponse(
                true, "If an eligible Rupiksha account exists for this mobile number, an OTP will be sent.", "chal-456", 60, 300);

        when(otpLoginService.resendOtp(any(AuthDtos.OtpLoginResendRequest.class), anyString(), any()))
                .thenReturn(res);

        mockMvc.perform(post("/api/v1/auth/otp-login/resend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.challengeId").value("chal-456"));
    }
}

