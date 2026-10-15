package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.integration.otp.OtpProvider;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class OtpProviderRouter {
    private final OtpProvider selected;

    public OtpProviderRouter(List<OtpProvider> providers, AppProperties appProperties, Environment environment) {
        String configured = appProperties.providers().otp().name() == null
                ? "dovesoft"
                : appProperties.providers().otp().name().trim().toLowerCase();
        boolean productionProfile = List.of(environment.getActiveProfiles()).contains("prod");
        if (productionProfile && "mock".equals(configured)
                && !appProperties.environment().allowMockProvidersInProduction()) {
            throw new IllegalStateException(
                    "Mock OTP provider is blocked in production profile. Set OTP_PROVIDER to a real provider.");
        }
        this.selected = providers.stream()
                .filter(p -> matchesProvider(p.providerName(), configured))
                .findFirst()
                .orElseGet(() -> providers.stream()
                        .filter(p -> p.providerName().equalsIgnoreCase("mock"))
                        .findFirst()
                        .orElseThrow());
    }

    private static boolean matchesProvider(String providerName, String configured) {
        if (providerName.equalsIgnoreCase(configured)) {
            return true;
        }
        if ("dovesoft".equalsIgnoreCase(providerName)) {
            return "dove".equalsIgnoreCase(configured) || "dovesoft-otp".equalsIgnoreCase(configured);
        }
        if ("2factor".equalsIgnoreCase(providerName)) {
            return "2fa".equalsIgnoreCase(configured) || "twofactor".equalsIgnoreCase(configured);
        }
        return false;
    }

    public OtpProvider current() {
        return selected;
    }
}

