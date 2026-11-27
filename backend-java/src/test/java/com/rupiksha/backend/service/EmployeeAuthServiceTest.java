package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.security.JwtAuthFilter;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.security.JwtService;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EmployeeAuthServiceTest {

    private EmployeeRepository employeeRepository;
    private EmployeeScopeRepository employeeScopeRepository;
    private EmployeeRefreshTokenRepository refreshTokenRepository;
    private EmployeePermissionService permissionService;
    private EmployeeAuditService auditService;
    private EmployeeAuthRateLimiter rateLimiter;
    private PasswordEncoder passwordEncoder;
    private JwtService jwtService;
    private EmployeeAuthService authService;

    @BeforeEach
    void setUp() {
        employeeRepository = mock(EmployeeRepository.class);
        employeeScopeRepository = mock(EmployeeScopeRepository.class);
        refreshTokenRepository = mock(EmployeeRefreshTokenRepository.class);
        permissionService = mock(EmployeePermissionService.class);
        auditService = mock(EmployeeAuditService.class);
        rateLimiter = new EmployeeAuthRateLimiter();
        passwordEncoder = new BCryptPasswordEncoder();

        AppProperties props = new AppProperties(
                new AppProperties.Jwt("rupiksha", "rupiksha-super-secret-signing-key-for-employee-jwt-tests-2026-min-length", 30, 7),
                null, null, null, null, null, null, null, null, null, null
        );
        jwtService = new JwtService(props);

        authService = new EmployeeAuthService(
                employeeRepository,
                employeeScopeRepository,
                refreshTokenRepository,
                permissionService,
                auditService,
                rateLimiter,
                passwordEncoder,
                jwtService,
                props
        );
        SecurityContextHolder.clearContext();
    }

    private Employee buildEmployee(EmployeeStatus status) {
        Employee e = new Employee();
        e.setId(UUID.randomUUID());
        e.setEmployeeCode("EMP-SH-101");
        e.setUsername("amit.bihar");
        e.setFullName("Amit Kumar");
        e.setMobile("9876543210");
        e.setEmail("amit@rupiksha.in");
        e.setEmployeeRole(EmployeeRole.STATE_HEADER);
        e.setStatus(status);
        e.setPasswordHash(passwordEncoder.encode("StrongPass@123"));
        e.setSessionVersion(2);
        e.setTerritoryLabel("Bihar");
        return e;
    }

    @Test
    void activeEmployeeCanLoginByEmployeeCodeAndJwtHasIsolatedClaims() {
        Employee emp = buildEmployee(EmployeeStatus.ACTIVE);
        when(employeeRepository.findByUsernameIgnoreCase("EMP-SH-101")).thenReturn(Optional.empty());
        when(employeeRepository.findByEmployeeCodeIgnoreCase("EMP-SH-101")).thenReturn(Optional.of(emp));
        when(employeeScopeRepository.findByEmployeeId(emp.getId())).thenReturn(List.of());
        when(permissionService.getPermissionCodes(emp.getId())).thenReturn(Set.of(EmployeePermissionCatalog.VIEW_DASHBOARD));

        EmployeeDtos.EmployeeAuthResponse res = authService.login(
                new EmployeeDtos.EmployeeLoginRequest("EMP-SH-101", "StrongPass@123"),
                "10.0.0.1", "JUnit"
        );

        assertNotNull(res.accessToken());
        assertNotNull(res.refreshToken());
        assertEquals("STATE_HEADER", res.employee().role());
        assertEquals("State Head", res.employee().roleDisplayName());

        var claims = jwtService.parse(res.accessToken());
        assertEquals("EMPLOYEE", claims.get("principal_type"));
        assertEquals("STATE_HEADER", claims.get("employee_role"));
        assertEquals(2, ((Number) claims.get("employee_session_version")).intValue());
    }

    @Test
    void suspendedAndInactiveEmployeesAreRejectedOnLogin() {
        Employee suspended = buildEmployee(EmployeeStatus.SUSPENDED);
        when(employeeRepository.findByUsernameIgnoreCase("amit.bihar")).thenReturn(Optional.of(suspended));

        assertThrows(AccessDeniedException.class, () ->
                authService.login(new EmployeeDtos.EmployeeLoginRequest("amit.bihar", "StrongPass@123"), "10.0.0.1", "JUnit")
        );

        Employee inactive = buildEmployee(EmployeeStatus.INACTIVE);
        when(employeeRepository.findByUsernameIgnoreCase("amit.bihar")).thenReturn(Optional.of(inactive));

        assertThrows(AccessDeniedException.class, () ->
                authService.login(new EmployeeDtos.EmployeeLoginRequest("amit.bihar", "StrongPass@123"), "10.0.0.1", "JUnit")
        );
    }

    @Test
    void fiveFailedPasswordsLockAccount() {
        Employee emp = buildEmployee(EmployeeStatus.ACTIVE);
        when(employeeRepository.findByUsernameIgnoreCase("amit.bihar")).thenReturn(Optional.of(emp));

        for (int i = 0; i < 5; i++) {
            assertThrows(BadCredentialsException.class, () ->
                    authService.login(new EmployeeDtos.EmployeeLoginRequest("amit.bihar", "WrongPass"), "10.0.0.2", "JUnit")
            );
        }

        assertEquals(5, emp.getFailedLoginAttempts());
        assertNotNull(emp.getLockedUntil());
        assertTrue(emp.getLockedUntil().isAfter(Instant.now()));

        assertThrows(AccessDeniedException.class, () ->
                authService.login(new EmployeeDtos.EmployeeLoginRequest("amit.bihar", "StrongPass@123"), "10.0.0.2", "JUnit")
        );
    }

    @Test
    void logoutIncrementsSessionVersionAndRevokesRefreshTokens() {
        Employee emp = buildEmployee(EmployeeStatus.ACTIVE);
        when(employeeRepository.findById(emp.getId())).thenReturn(Optional.of(emp));
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        authService.logout(
                "raw-refresh",
                new JwtPrincipal(emp.getId().toString(), emp.getUsername(), List.of("EMPLOYEE", "STATE_HEADER")),
                "10.0.0.1", "JUnit"
        );

        assertEquals(3, emp.getSessionVersion());
        verify(refreshTokenRepository).revokeAllByEmployeeId(emp.getId());
    }

    @Test
    void jwtAuthFilterRejectsRevokedSuspendedAndSpoofedEmployeeTokens() throws Exception {
        UserRepository userRepository = mock(UserRepository.class);
        AdminAuditService adminAuditService = mock(AdminAuditService.class);
        JwtAuthFilter filter = new JwtAuthFilter(jwtService, userRepository, adminAuditService);
        filter.setEmployeeRepository(employeeRepository);

        Employee emp = buildEmployee(EmployeeStatus.ACTIVE);
        String validToken = jwtService.createEmployeeAccessToken(emp.getId(), emp.getUsername(), "STATE_HEADER", 2);

        // 1. Valid active matching sessionVersion -> authenticated
        when(employeeRepository.findById(emp.getId())).thenReturn(Optional.of(emp));
        MockHttpServletRequest req1 = new MockHttpServletRequest();
        req1.addHeader("Authorization", "Bearer " + validToken);
        FilterChain chain1 = mock(FilterChain.class);
        filter.doFilter(req1, new MockHttpServletResponse(), chain1);
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        SecurityContextHolder.clearContext();

        // 2. SessionVersion incremented -> rejected
        emp.setSessionVersion(3);
        MockHttpServletRequest req2 = new MockHttpServletRequest();
        req2.addHeader("Authorization", "Bearer " + validToken);
        filter.doFilter(req2, new MockHttpServletResponse(), mock(FilterChain.class));
        assertNull(SecurityContextHolder.getContext().getAuthentication());

        // 3. Suspended employee -> rejected even with matching version
        emp.setSessionVersion(2);
        emp.setStatus(EmployeeStatus.SUSPENDED);
        MockHttpServletRequest req3 = new MockHttpServletRequest();
        req3.addHeader("Authorization", "Bearer " + validToken);
        filter.doFilter(req3, new MockHttpServletResponse(), mock(FilterChain.class));
        assertNull(SecurityContextHolder.getContext().getAuthentication());

        // 4. Spoofed normal user token claiming EMPLOYEE role without principal_type=EMPLOYEE -> rejected
        String spoofed = jwtService.createAccessToken(UUID.randomUUID(), "rogue", List.of("EMPLOYEE", "NATIONAL_HEADER"));
        MockHttpServletRequest req4 = new MockHttpServletRequest();
        req4.addHeader("Authorization", "Bearer " + spoofed);
        filter.doFilter(req4, new MockHttpServletResponse(), mock(FilterChain.class));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
}
