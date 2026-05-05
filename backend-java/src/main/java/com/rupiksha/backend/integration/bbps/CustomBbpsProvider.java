package com.rupiksha.backend.integration.bbps;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Component
public class CustomBbpsProvider implements BbpsProvider {
    @Override
    public String providerName() {
        return "custom";
    }

    @Override
    public ProviderFetchResponse fetch(String userId, String biller, String opcode, String consumerNo, String category) {
        return new ProviderFetchResponse(
                false,
                "Custom BBPS provider adapter scaffolded. Integrate live BBPS APIs.",
                Map.of("biller", biller, "opcode", opcode, "consumerNo", consumerNo)
        );
    }

    @Override
    public ProviderPayResponse pay(String userId, String biller, String opcode, String consumerNo, String category, BigDecimal amount) {
        return new ProviderPayResponse(
                false,
                "CUSTOM-BBPS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                "Custom BBPS provider adapter scaffolded. Integrate live pay APIs.",
                Map.of("biller", biller, "opcode", opcode, "amount", amount)
        );
    }
}
