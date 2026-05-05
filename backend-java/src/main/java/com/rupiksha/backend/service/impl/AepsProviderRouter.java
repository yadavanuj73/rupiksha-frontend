package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.integration.aeps.AepsProvider;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AepsProviderRouter {
    private final AepsProvider selected;

    public AepsProviderRouter(List<AepsProvider> providers, AppProperties appProperties, Environment environment) {
        String configured = appProperties.aeps().provider() == null
                ? "mock"
                : appProperties.aeps().provider().trim().toLowerCase();
        boolean productionProfile = List.of(environment.getActiveProfiles()).contains("prod");
        if (productionProfile && "mock".equals(configured) && !appProperties.environment().allowMockProvidersInProduction()) {
            throw new IllegalStateException("Mock AEPS provider is blocked in production profile");
        }
        this.selected = providers.stream()
                .filter(p -> p.providerName().equalsIgnoreCase(configured))
                .findFirst()
                .orElseGet(() -> providers.stream()
                        .filter(p -> p.providerName().equalsIgnoreCase("mock"))
                        .findFirst()
                        .orElseThrow());
    }

    public AepsProvider current() {
        return selected;
    }
}
