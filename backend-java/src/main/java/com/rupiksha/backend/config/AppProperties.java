package com.rupiksha.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Jwt jwt,
        Otp otp,
        Cors cors,
        Providers providers,
        Recharge recharge,
        Aeps aeps,
        Bbps bbps,
        Services services,
        Environment environment,
        String publicBaseUrl
) {
    public record Jwt(String issuer, String secret, long accessTokenMinutes, long refreshTokenDays) {}
    public record Otp(long ttlSeconds, int maxAttempts) {}
    public record Cors(String allowedOrigins) {}
    public record Providers(OtpProvider otp, PaymentProvider payment) {}
    public record OtpProvider(String name, String baseUrl, String apiKey, String senderId) {}
    public record PaymentProvider(String name, String baseUrl, String keyId, String keySecret, String webhookSecret) {}
    public record Recharge(String provider, String baseUrl, String apiKey, String apiSecret) {}
    public record Aeps(String provider, String baseUrl, String apiKey, String apiSecret) {}
    public record Bbps(String provider, String baseUrl, String apiKey, String apiSecret) {}
    public record Services(boolean aepsEnabled, boolean bbpsEnabled, boolean ticketsEnabled, boolean rechargeEnabled, boolean payoutEnabled) {}
    public record Environment(boolean allowMockProvidersInProduction) {}
}

