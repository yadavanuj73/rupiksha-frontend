package com.rupiksha.backend.api;

import com.rupiksha.backend.domain.Role;
import com.rupiksha.backend.domain.RoleName;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtAuthFilter;
import com.rupiksha.backend.security.JwtService;
import com.rupiksha.backend.service.AdminAuditService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminAuthSecurityTest {

    @Mock
    private JwtService jwtService;
    @Mock
    private UserRepository userRepository;
    @Mock
    private AdminAuditService adminAuditService;
    @Mock
    private HttpServletRequest request;
    @Mock
    private HttpServletResponse response;
    @Mock
    private FilterChain filterChain;
    @Mock
    private Claims claims;

    private JwtAuthFilter jwtAuthFilter;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        jwtAuthFilter = new JwtAuthFilter(jwtService, userRepository, adminAuditService);
    }

    @Test
    @DisplayName("Test 14 & 16: Old admin access token without admin_session_version is rejected")
    void doFilterInternal_OldAdminTokenWithoutSessionVersion_Rejected() throws Exception {
        when(request.getHeader("Authorization")).thenReturn("Bearer old-pre-2fa-token");
        when(jwtService.parse("old-pre-2fa-token")).thenReturn(claims);
        when(claims.getSubject()).thenReturn(UUID.randomUUID().toString());
        when(claims.get("username", String.class)).thenReturn("admin");
        when(claims.get("roles", List.class)).thenReturn(List.of("ADMIN"));
        // Token has NO admin_session_version claim (null)
        when(claims.get("admin_session_version")).thenReturn(null);

        jwtAuthFilter.doFilter(request, response, filterChain);

        // Security context must NOT be authenticated
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
        verify(adminAuditService).logEvent(any(), any(), any(), eq("ADMIN"), any(), any(), any(), any(), any(), eq("BLOCKED"), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Test 14: Old admin token with version 1 is rejected (deployment requires version >= 2)")
    void doFilterInternal_OldAdminTokenWithVersion1_Rejected() throws Exception {
        when(request.getHeader("Authorization")).thenReturn("Bearer v1-token");
        when(jwtService.parse("v1-token")).thenReturn(claims);
        when(claims.getSubject()).thenReturn(UUID.randomUUID().toString());
        when(claims.get("username", String.class)).thenReturn("admin");
        when(claims.get("roles", List.class)).thenReturn(List.of("ADMIN"));
        when(claims.get("admin_session_version")).thenReturn(1); // older than minimum required 2

        jwtAuthFilter.doFilter(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("Test 18 & 20: Admin token with version less than user's DB session version is rejected")
    void doFilterInternal_RevokedAdminToken_Rejected() throws Exception {
        UUID adminId = UUID.randomUUID();
        User adminUser = new User();
        adminUser.setId(adminId);
        adminUser.setAdminSessionVersion(3); // user logged out or invalidated, version is now 3

        when(request.getHeader("Authorization")).thenReturn("Bearer v2-token");
        when(jwtService.parse("v2-token")).thenReturn(claims);
        when(claims.getSubject()).thenReturn(adminId.toString());
        when(claims.get("username", String.class)).thenReturn("admin");
        when(claims.get("roles", List.class)).thenReturn(List.of("ADMIN"));
        when(claims.get("admin_session_version")).thenReturn(2); // token is version 2, DB is 3
        when(userRepository.findById(adminId)).thenReturn(Optional.of(adminUser));

        jwtAuthFilter.doFilter(request, response, filterChain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("Test 17 & 32: Valid 2FA admin token with current session version is accepted")
    void doFilterInternal_Valid2FaAdminToken_Accepted() throws Exception {
        UUID adminId = UUID.randomUUID();
        User adminUser = new User();
        adminUser.setId(adminId);
        adminUser.setAdminSessionVersion(2);

        when(request.getHeader("Authorization")).thenReturn("Bearer valid-v2-token");
        when(jwtService.parse("valid-v2-token")).thenReturn(claims);
        when(claims.getSubject()).thenReturn(adminId.toString());
        when(claims.get("username", String.class)).thenReturn("admin");
        when(claims.get("roles", List.class)).thenReturn(List.of("ADMIN"));
        when(claims.get("admin_session_version")).thenReturn(2);
        when(userRepository.findById(adminId)).thenReturn(Optional.of(adminUser));

        jwtAuthFilter.doFilter(request, response, filterChain);

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        Object principalObj = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertTrue(principalObj instanceof com.rupiksha.backend.security.JwtPrincipal);
        assertEquals("admin", ((com.rupiksha.backend.security.JwtPrincipal) principalObj).username());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    @DisplayName("Test 7 & 34: Non-admin tokens (e.g. Retailer) are NOT subject to admin versioning and continue working")
    void doFilterInternal_RetailerTokenWithoutAdminVersion_Accepted() throws Exception {
        UUID retailerId = UUID.randomUUID();

        when(request.getHeader("Authorization")).thenReturn("Bearer retailer-token");
        when(jwtService.parse("retailer-token")).thenReturn(claims);
        when(claims.getSubject()).thenReturn(retailerId.toString());
        when(claims.get("username", String.class)).thenReturn("retailer_user");
        when(claims.get("roles", List.class)).thenReturn(List.of("RETAILER"));
        when(claims.get("admin_session_version")).thenReturn(null);

        jwtAuthFilter.doFilter(request, response, filterChain);

        // Retailer authentication must succeed without admin_session_version
        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        Object principalObj = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertTrue(principalObj instanceof com.rupiksha.backend.security.JwtPrincipal);
        assertEquals("retailer_user", ((com.rupiksha.backend.security.JwtPrincipal) principalObj).username());
        verify(filterChain).doFilter(request, response);
    }
}
