package com.rupiksha.aeps.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.dto.PayoutLimitSettingsDto;
import com.rupiksha.aeps.dto.PayoutLimitUpdateRequest;
import com.rupiksha.aeps.service.PayoutLimitConfigurationService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminPayoutSettingsControllerTest {

    private MockMvc mockMvc;

    @Mock
    private PayoutLimitConfigurationService payoutLimitConfigurationService;

    @InjectMocks
    private AdminPayoutSettingsController controller;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String adminUserId = "admin-uuid-9999-8888";

    @BeforeEach
    void setUp() {
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
                    when(auth.getName()).thenReturn(adminUserId);
                    return auth;
                }
                return new JwtPrincipal(adminUserId, "admin_user", java.util.List.of("ADMIN"));
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setCustomArgumentResolvers(principalResolver)
                .build();
    }

    @Test
    @DisplayName("Admin Controller: GET /api/v1/admin/payout-settings returns saved limits")
    void testGetPayoutSettings_Success() throws Exception {
        PayoutLimitSettingsDto dto = PayoutLimitSettingsDto.builder()
                .minimumPayoutAmount(new BigDecimal("100.00"))
                .maximumPayoutAmount(new BigDecimal("100000.00"))
                .updatedBy(adminUserId)
                .updatedAt("2026-11-20T11:42:00")
                .version(1L)
                .build();

        when(payoutLimitConfigurationService.getActiveLimits()).thenReturn(dto);

        mockMvc.perform(get("/api/v1/admin/payout-settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minimumPayoutAmount").value(100.00))
                .andExpect(jsonPath("$.maximumPayoutAmount").value(100000.00))
                .andExpect(jsonPath("$.updatedBy").value(adminUserId))
                .andExpect(jsonPath("$.version").value(1));
    }

    @Test
    @DisplayName("Admin Controller: PUT /api/v1/admin/payout-settings atomically saves new limits")
    void testUpdatePayoutSettings_Success() throws Exception {
        PayoutLimitUpdateRequest updateReq = PayoutLimitUpdateRequest.builder()
                .minimumPayoutAmount(new BigDecimal("500.00"))
                .maximumPayoutAmount(new BigDecimal("200000.00"))
                .build();

        PayoutLimitSettingsDto updatedDto = PayoutLimitSettingsDto.builder()
                .minimumPayoutAmount(new BigDecimal("500.00"))
                .maximumPayoutAmount(new BigDecimal("200000.00"))
                .updatedBy(adminUserId)
                .updatedAt("2026-11-20T12:00:00")
                .version(2L)
                .build();

        when(payoutLimitConfigurationService.updateLimits(any(), any(), any(), any(), any(), any()))
                .thenReturn(updatedDto);

        mockMvc.perform(put("/api/v1/admin/payout-settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.minimumPayoutAmount").value(500.00))
                .andExpect(jsonPath("$.maximumPayoutAmount").value(200000.00))
                .andExpect(jsonPath("$.version").value(2));
    }

    @Test
    @DisplayName("Admin Controller: PUT /api/v1/admin/payout-settings rejects invalid payloads (400 Bad Request)")
    void testUpdatePayoutSettings_InvalidPayload() throws Exception {
        // Negative minimum amount
        PayoutLimitUpdateRequest invalidReq = PayoutLimitUpdateRequest.builder()
                .minimumPayoutAmount(new BigDecimal("-100.00"))
                .maximumPayoutAmount(new BigDecimal("100000.00"))
                .build();

        mockMvc.perform(put("/api/v1/admin/payout-settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidReq)))
                .andExpect(status().isBadRequest());
    }
}
