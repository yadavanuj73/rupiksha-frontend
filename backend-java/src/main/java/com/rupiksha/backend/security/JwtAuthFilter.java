package com.rupiksha.backend.security;

import com.rupiksha.backend.domain.AdminAuthAuditEventType;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.service.AdminAuditService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final AdminAuditService adminAuditService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String token = auth.substring(7).trim();
            Claims claims = jwtService.parse(token);
            String subject = claims.getSubject();
            @SuppressWarnings("unchecked")
            List<String> roles = claims.get("roles", List.class);

            boolean isAdminRole = roles != null && roles.stream()
                    .anyMatch(r -> "ADMIN".equalsIgnoreCase(r) || "SUPER_ADMIN".equalsIgnoreCase(r));

            if (isAdminRole) {
                // Critical Safeguard: Mandatory Session Version Validation for Admin Accounts
                Object verObj = claims.get("admin_session_version");
                Integer tokenVersion = null;
                if (verObj instanceof Number n) {
                    tokenVersion = n.intValue();
                }

                // Any pre-deployment token missing session version or version < 2 is immediately rejected
                if (tokenVersion == null || tokenVersion < 2) {
                    log.warn("Blocked outdated admin access token missing or invalid admin_session_version (tokenVersion={}) for user {}",
                            tokenVersion, subject);
                    adminAuditService.logEvent(
                            AdminAuthAuditEventType.OLD_ACCESS_TOKEN_REJECTED,
                            tryParseUuid(subject),
                            claims.get("username", String.class),
                            "ADMIN",
                            null, null,
                            resolveClientIp(request),
                            request.getHeader("User-Agent"),
                            request.getHeader("X-Correlation-ID"),
                            "BLOCKED",
                            "Outdated pre-2FA admin access token rejected: version=" + tokenVersion,
                            null, tokenVersion, null
                    );
                    SecurityContextHolder.clearContext();
                    filterChain.doFilter(request, response);
                    return;
                }

                // Check against user's live session version in database
                UUID userId = tryParseUuid(subject);
                if (userId != null) {
                    User user = userRepository.findById(userId).orElse(null);
                    if (user == null || user.getAdminSessionVersion() > tokenVersion) {
                        log.warn("Blocked revoked/invalidated admin access token for user {} (tokenVer={}, userVer={})",
                                subject, tokenVersion, user != null ? user.getAdminSessionVersion() : "null");
                        adminAuditService.logEvent(
                                AdminAuthAuditEventType.OLD_ACCESS_TOKEN_REJECTED,
                                userId,
                                claims.get("username", String.class),
                                "ADMIN",
                                null, null,
                                resolveClientIp(request),
                                request.getHeader("User-Agent"),
                                request.getHeader("X-Correlation-ID"),
                                "BLOCKED",
                                "Admin session revoked or invalidated by version increment",
                                null, tokenVersion, null
                        );
                        SecurityContextHolder.clearContext();
                        filterChain.doFilter(request, response);
                        return;
                    }
                }
            }

            var authorities = roles == null ? List.<SimpleGrantedAuthority>of() :
                    roles.stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList();
            var principal = new JwtPrincipal(subject, claims.get("username", String.class), roles);
            var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (Exception e) {
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }

    private UUID tryParseUuid(String val) {
        if (val == null) return null;
        try {
            return UUID.fromString(val.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp.trim();
        }
        return request.getRemoteAddr();
    }
}
