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

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;

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
                "/api/v1/otp/**",
                "/api/v1/payment/webhook/**",
                "/api/v1/aeps/status",
                "/api/v1/aeps/fix-user"
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
                        .requestMatchers(publicPaths.toArray(String[]::new)).permitAll()
                        // Hard gate sensitive approval/KYC mutation flows to ADMIN at
                        // HTTP layer so they remain protected even if method-security
                        // proxies are bypassed/misconfigured.
                        .requestMatchers(
                                "/api/v1/admin/approvals/**",
                                "/api/v1/admin/kyc/**"
                        ).hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // Always-allowed origins (hardcoded so they work even if env var is missing/stale)
        LinkedHashSet<String> origins = new LinkedHashSet<>(Arrays.asList(
                "http://localhost:5173",
                "http://localhost:3000",
                "https://rupiksha-frontend.vercel.app",
                "https://rupiksha.in",
                "https://www.rupiksha.in"
        ));
        // Merge any extra origins from env var
        String envAllowed = env.getProperty("app.cors.allowed-origins", "");
        if (!envAllowed.isBlank()) {
            Arrays.stream(envAllowed.split(",")).map(String::trim).filter(s -> !s.isBlank()).forEach(origins::add);
        }
        configuration.setAllowedOrigins(new ArrayList<>(origins));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
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

