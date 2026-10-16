package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.integration.bbps.BbpsProvider;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class BbpsProviderRouter {
    private final BbpsProvider selected;

    public BbpsProviderRouter(List<BbpsProvider> providers, AppProperties appProperties, Environment environment) {
        String configured = (appProperties.bbps() == null || appProperties.bbps().provider() == null)
                ? "mock"
                : appProperties.bbps().provider().trim().toLowerCase();
        boolean productionProfile = List.of(environment.getActiveProfiles()).contains("prod");
        if (productionProfile && "mock".equals(configured) && !appProperties.environment().allowMockProvidersInProduction()) {
            // Automatically fall back to "billavenue" in production profile to prevent mock blockages
            configured = "billavenue";
        }
        String finalConfigured = configured;
        this.selected = providers.stream()
                .filter(p -> p.providerName().equalsIgnoreCase(finalConfigured))
                .findFirst()
                .orElseGet(() -> providers.stream()
                        .filter(p -> p.providerName().equalsIgnoreCase("mock"))
                        .findFirst()
                        .orElseThrow());
    }

    public BbpsProvider current() {
        return selected;
    }
}
