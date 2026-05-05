package com.rupiksha.backend.integration.aeps;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
public class CustomAepsProvider implements AepsProvider {
    @Override
    public String providerName() {
        return "custom";
    }

    @Override
    public ProviderResponse transact(String userId, String tab, String mobile, String operator, String bankName, BigDecimal amount) {
        return new ProviderResponse(
                false,
                "CUSTOM-AEPS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                "Custom AEPS provider adapter scaffolded. Integrate provider API to enable live transactions.",
                Map.of("provider", "custom", "processedAt", Instant.now().toString(), "tab", tab)
        );
    }
}
