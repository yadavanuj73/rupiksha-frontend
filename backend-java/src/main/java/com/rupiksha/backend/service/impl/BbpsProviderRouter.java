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
        String configured = appProperties.bbps().provider() == null
                ? "mock"
                : appProperties.bbps().provider().trim().toLowerCase();
        boolean productionProfile = List.of(environment.getActiveProfiles()).contains("prod");
        if (productionProfile && "mock".equals(configured) && !appProperties.environment().allowMockProvidersInProduction()) {
            throw new IllegalStateException("Mock BBPS provider is blocked in production profile");
        }
        this.selected = providers.stream()
                .filter(p -> p.providerName().equalsIgnoreCase(configured))
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
