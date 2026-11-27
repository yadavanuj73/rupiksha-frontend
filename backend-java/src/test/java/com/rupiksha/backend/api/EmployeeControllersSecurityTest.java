package com.rupiksha.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.config.SecurityConfig;
import com.rupiksha.backend.domain.Employee;
import com.rupiksha.backend.domain.EmployeeRole;
import com.rupiksha.backend.domain.EmployeeStatus;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EmployeeControllersSecurityTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void controllersEnforceRoleLevelPreAuthorizeAnnotations() {
        PreAuthorize adminPre = AdminEmployeeController.class.getAnnotation(PreAuthorize.class);
        assertNotNull(adminPre);
        assertEquals("hasRole('ADMIN')", adminPre.value());

        PreAuthorize portalPre = EmployeePortalController.class.getAnnotation(PreAuthorize.class);
        assertNotNull(portalPre);
        assertEquals("hasRole('EMPLOYEE')", portalPre.value());

        // Ensure EmployeeAuthController has login/refresh/logout and NO public self-signup endpoint
        boolean hasRegisterMapping = java.util.Arrays.stream(EmployeeAuthController.class.getDeclaredMethods())
                .anyMatch(m -> m.getName().toLowerCase().contains("register") || m.getName().toLowerCase().contains("signup"));
        assertFalse(hasRegisterMapping);

        // Verify SecurityConfig class compiles and exists cleanly alongside Employee endpoints
        assertNotNull(SecurityConfig.class);
    }

    @Test
    void employeeLoginEndpointReturns401OnBadCredentialsAndNoSecretsOnSuccess() throws Exception {
        EmployeeAuthService authService = mock(EmployeeAuthService.class);
        EmployeeAuthController controller = new EmployeeAuthController(authService);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();

        when(authService.login(any(), any(), any())).thenThrow(new BadCredentialsException("Invalid employee credentials"));

        mockMvc.perform(post("/api/v1/employee/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EmployeeDtos.EmployeeLoginRequest("emp1", "wrong"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));

        EmployeeDtos.EmployeeProfileView view = new EmployeeDtos.EmployeeProfileView(
                UUID.randomUUID().toString(), "EMP-1", "nh.india", "National Lead",
                "9999999999", "nh@rupiksha.in", "Delhi", "NATIONAL_HEADER", "National Head",
                "ACTIVE", null, "Admin", "ADMIN", "All India (National)",
                List.of(), List.of("VIEW_DASHBOARD"), null, null, null
        );
        doReturn(new EmployeeDtos.EmployeeAuthResponse("jwt-access", "raw-refresh", "Bearer", 1800, view))
                .when(authService).login(any(), any(), any());

        MvcResult result = mockMvc.perform(post("/api/v1/employee/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new EmployeeDtos.EmployeeLoginRequest("EMP-1", "Pass@123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employee.employeeCode").value("EMP-1"))
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertFalse(body.contains("passwordHash"));
        assertFalse(body.contains("initialPassword"));
    }

    @Test
    void employeePortalControllerReturns403WhenServiceDeniesPermissionOrScope() throws Exception {
        EmployeePortalService portalService = mock(EmployeePortalService.class);
        EmployeeScopeService scopeService = mock(EmployeeScopeService.class);
        EmployeePermissionService permService = mock(EmployeePermissionService.class);

        EmployeePortalController controller = new EmployeePortalController(portalService, scopeService, permService);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();

        JwtPrincipal empPrincipal = new JwtPrincipal(UUID.randomUUID().toString(), "sh.bihar", List.of("EMPLOYEE", "STATE_HEADER"));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(empPrincipal, null, List.of())
        );

        try {
            when(portalService.getDashboard(any(), any(), any()))
                    .thenThrow(new AccessDeniedException("Missing required employee permission: VIEW_DASHBOARD"));

            mockMvc.perform(get("/api/v1/employee/dashboard"))
                    .andExpect(status().isForbidden());

            EmployeeDtos.EmployeeDashboardResponse okDash = new EmployeeDtos.EmployeeDashboardResponse(
                    null, true, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, BigDecimal.ZERO, List.of(), List.of(), List.of()
            );
            doReturn(okDash).when(portalService).getDashboard(any(), any(), any());

            mockMvc.perform(get("/api/v1/employee/dashboard"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalUsers").value(0));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void adminEmployeeControllerNeverExposesPasswordHashesInResponses() throws Exception {
        AdminEmployeeService adminService = mock(AdminEmployeeService.class);
        EmployeePermissionService permService = mock(EmployeePermissionService.class);
        EmployeeScopeService scopeService = mock(EmployeeScopeService.class);

        AdminEmployeeController controller = new AdminEmployeeController(adminService, permService, scopeService);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();

        EmployeeDtos.EmployeePerformanceItem perfItem = new EmployeeDtos.EmployeePerformanceItem(
                UUID.randomUUID().toString(), "EMP-SH-1", "sh.up", "UP Head",
                "9876543211", "up@rupiksha.in", EmployeeRole.STATE_HEADER.name(),
                EmployeeRole.STATE_HEADER.getDisplayName(), EmployeeStatus.ACTIVE.name(),
                null, "Admin", "ADMIN", "Uttar Pradesh", List.of(), List.of("VIEW_DASHBOARD"),
                2, 2, 0, 0, 15, 10, 4, 1, 1, 50, 45, 3, 2,
                new BigDecimal("125000.00"), null, null, List.of(), List.of()
        );
        when(adminService.listPerformanceSummary(any(), any(), any(), any(), any())).thenReturn(List.of(perfItem));

        MvcResult result = mockMvc.perform(get("/api/v1/admin/employees/performance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].employeeCode").value("EMP-SH-1"))
                .andReturn();

        String json = result.getResponse().getContentAsString();
        assertFalse(json.contains("passwordHash"));
        assertFalse(json.contains("accessToken"));
        assertFalse(json.contains("refreshToken"));
    }
}
