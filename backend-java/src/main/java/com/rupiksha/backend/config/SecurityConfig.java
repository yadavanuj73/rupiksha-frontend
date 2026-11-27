package com.rupiksha.backend.config;

import com.rupiksha.backend.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import lombok.extern.slf4j.Slf4j;
import com.rupiksha.backend.security.JwtPrincipal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;

@Slf4j
@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthFilter jwtAuthFilter;
    private final org.springframework.core.env.Environment env;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        boolean prod = List.of(env.getActiveProfiles()).contains("prod");

        List<String> publicPaths = new ArrayList<>(List.of(
                "/actuator/health",
                "/api/v1/health/**",
                "/api/v1/auth/**",
                "/api/auth/**",
                "/auth/**",
                "/api/v1/otp/**",
                "/api/v1/payment/webhook/**",
                "/api/v1/webhooks/bussto/**",
                "/api/v1/aeps/status",
                "/api/v1/recharge/callback",
                "/api/v1/certificates/verify/**",
                "/api/v1/id-payment/**",
                "/api/v1/bbps/callback",
                "/api/v1/fingpay-cms/callback/**",
                "/api/v1/cms/**",
                "/api/upicw/callback/**",
                "/api/upicw/v1/callback/**",
                "/api/v1/upicw/callback/**",
                "/api/v1/admin/auth/login",
                "/api/v1/admin/auth/send-otp",
                "/api/v1/admin/auth/resend-otp",
                "/api/v1/admin/auth/verify-otp",
                "/api/v1/admin/auth/logout",
                "/api/v1/employee/auth/login",
                "/api/v1/employee/auth/refresh",
                "/api/v1/employee/auth/logout"
        ));

        // Swagger and API docs are only public outside production.
        if (!prod) {
            publicPaths.add("/v3/api-docs/**");
            publicPaths.add("/swagger-ui/**");
            publicPaths.add("/swagger-ui.html");
        }

        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(org.springframework.http.HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(publicPaths.toArray(String[]::new)).permitAll()
                        .requestMatchers("/api/v1/aeps/rd/test").hasAnyRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER")
                        .requestMatchers(
                                "/api/v1/admin/approvals/**",
                                "/api/v1/admin/kyc/**",
                                "/api/v1/admin/add-user",
                                "/api/admin/add-user",
                                "/admin/add-user",
                                "/api/v1/admin/payout-settings/**",
                                "/api/admin/payout-settings/**",
                                "/admin/payout-settings/**",
                                "/api/v1/admin/bank-accounts/**",
                                "/api/v1/admin/employees/**"
                        ).hasRole("ADMIN")
                        .requestMatchers("/api/v1/employee/**").hasRole("EMPLOYEE")
                        .anyRequest().authenticated()
                )
                .exceptionHandling(eh -> eh.accessDeniedHandler(accessDeniedHandler()))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    private org.springframework.security.web.access.AccessDeniedHandler accessDeniedHandler() {
        return (request, response, accessDeniedException) -> {
            if ("/api/v1/aeps/rd/test".equals(request.getRequestURI())) {
                String ipAddress = request.getHeader("X-Forwarded-For");
                if (ipAddress == null || ipAddress.isBlank()) {
                    ipAddress = request.getRemoteAddr();
                }

                String userId = "anonymous";
                String username = "anonymous";
                List<String> roles = List.of();

                org.springframework.security.core.Authentication auth =
                        org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.getPrincipal() instanceof JwtPrincipal principal) {
                    userId = principal.userId();
                    username = principal.username();
                    roles = principal.roles();
                }

                log.warn("ACCESS ATTEMPT DENIED: path={}, userId={}, username={}, roles={}, ip={}, result=DENIED, timestamp={}",
                        request.getRequestURI(), userId, username, roles, ipAddress, java.time.Instant.now());
            }

            response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"success\":false,\"message\":\"Access Denied: Unauthorized role\"}");
        };
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of(
                "https://rupiksha.in",
                "https://www.rupiksha.in",
                "https://*.rupiksha.in",
                "https://rupiksha-frontend.vercel.app",
                "http://localhost:5173",
                "http://localhost:3000",
                "http://localhost:4173",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:3000"
        ));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setExposedHeaders(Arrays.asList(
                "Authorization", "Content-Disposition", "X-Idempotency-Key", "Idempotency-Key"
        ));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }
}


