package com.rupiksha.backend.integration.aeps;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
public class MockAepsProvider implements AepsProvider {
    @Override
    public String providerName() {
        return "mock";
    }

    @Override
    public ProviderResponse transact(String userId, String tab, String mobile, String operator, String bankName, BigDecimal amount) {
        return new ProviderResponse(
                true,
                "AEPS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                "Mock AEPS success",
                Map.of("provider", "mock", "processedAt", Instant.now().toString(), "tab", tab, "bankName", bankName)
        );
    }
}
