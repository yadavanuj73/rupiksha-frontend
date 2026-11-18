package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.integration.payment.PaymentGatewayProvider;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class PaymentProviderRouter {
    private final List<PaymentGatewayProvider> providers;
    private final PaymentGatewayProvider selected;
    private final boolean productionProfile;

    public PaymentProviderRouter(List<PaymentGatewayProvider> providers, AppProperties appProperties, Environment environment) {
        this.providers = providers;
        String configured = appProperties.providers().payment().name() == null
                ? "mock"
                : appProperties.providers().payment().name().trim().toLowerCase();
        this.productionProfile = List.of(environment.getActiveProfiles()).contains("prod");
        if (productionProfile && ("mock".equals(configured) || configured.isBlank())) {
            throw new IllegalStateException(
                    "Mock payment provider is blocked in production profile. Set PAYMENT_PROVIDER to a real provider.");
        }
        this.selected = providers.stream()
                .filter(p -> p.providerName().equalsIgnoreCase(configured))
                .findFirst()
                .orElseGet(() -> providers.stream()
                        .filter(p -> p.providerName().equalsIgnoreCase("mock"))
                        .findFirst()
                        .orElseThrow());
    }

    public PaymentGatewayProvider current() {
        return selected;
    }

    public PaymentGatewayProvider byNameOrDefault(String provider) {
        if (provider == null || provider.isBlank()) return selected;
        if (productionProfile && "mock".equalsIgnoreCase(provider)) {
            throw new IllegalStateException("Mock payment provider is blocked in production profile");
        }
        return providers.stream()
                .filter(p -> p.providerName().equalsIgnoreCase(provider))
                .findFirst()
                .orElse(selected);
    }
}

