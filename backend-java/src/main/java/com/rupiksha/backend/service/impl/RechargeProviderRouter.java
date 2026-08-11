package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.integration.recharge.RechargeTransferProvider;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class RechargeProviderRouter {
    private final RechargeTransferProvider selected;

    public RechargeProviderRouter(List<RechargeTransferProvider> providers, AppProperties appProperties, Environment environment) {
        String configured = appProperties.recharge() == null || appProperties.recharge().provider() == null
                ? "mock"
                : appProperties.recharge().provider().trim().toLowerCase();
        boolean productionProfile = List.of(environment.getActiveProfiles()).contains("prod");
        if (productionProfile && "mock".equals(configured)
                && (appProperties.environment() == null || !appProperties.environment().allowMockProvidersInProduction())) {
            throw new IllegalStateException(
                    "Mock recharge provider is blocked in production profile. Set RECHARGE_PROVIDER to a real provider.");
        }
        this.selected = providers.stream()
                .filter(p -> p.providerName().equalsIgnoreCase(configured))
                .findFirst()
                .orElseGet(() -> providers.stream()
                        .filter(p -> p.providerName().equalsIgnoreCase("mock"))
                        .findFirst()
                        .orElseThrow());
    }

    public RechargeTransferProvider current() {
        return selected;
    }
}

