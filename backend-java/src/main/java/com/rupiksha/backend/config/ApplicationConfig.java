package com.rupiksha.backend.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.List;

@Slf4j
@Configuration
@RequiredArgsConstructor
@EnableConfigurationProperties(AppProperties.class)
public class ApplicationConfig {
    private static final String INSECURE_DEFAULT_JWT_SECRET =
            "change_this_to_a_long_random_secret_32_chars_min";

    private final AppProperties appProperties;
    private final Environment environment;

    /**
     * Fail fast when the production profile is active but secrets / CORS are still
     * at dev defaults. This turns silent misconfiguration into an obvious startup
     * error so a dev build cannot accidentally reach production.
     */
    @PostConstruct
    public void validateProductionConfig() {
        boolean prod = List.of(environment.getActiveProfiles()).contains("prod");
        if (!prod) {
            return;
        }

        String secret = appProperties.jwt().secret();
        if (secret == null || secret.isBlank() || INSECURE_DEFAULT_JWT_SECRET.equals(secret)
                || secret.length() < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET must be a strong env value (>=32 chars, not the dev default) in prod profile.");
        }

        String cors = appProperties.cors() == null ? null : appProperties.cors().allowedOrigins();
        if (cors == null || cors.isBlank() || cors.contains("localhost")) {
            throw new IllegalStateException(
                    "CORS_ALLOWED_ORIGINS must be an explicit production origin list in prod profile.");
        }

        log.info("Production config validation passed for Rupiksha backend.");
    }
}
