package com.rupiksha.backend.integration.bbps;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
public class MockBbpsProvider implements BbpsProvider {
    @Override
    public String providerName() {
        return "mock";
    }

    @Override
    public ProviderFetchResponse fetch(String userId, String biller, String opcode, String consumerNo, String category) {
        return new ProviderFetchResponse(
                true,
                "Mock bill fetched",
                Map.of(
                        "billNo", "BBPS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                        "consumerNo", consumerNo,
                        "custName", "Retailer Customer",
                        "amount", new BigDecimal("499.00"),
                        "dueDate", LocalDate.now().plusDays(7).toString(),
                        "biller", biller,
                        "opcode", opcode
                )
        );
    }

    @Override
    public ProviderPayResponse pay(String userId, String biller, String opcode, String consumerNo, String category, BigDecimal amount) {
        return new ProviderPayResponse(
                true,
                "BBPS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                "Mock bill payment success",
                Map.of("provider", "mock", "processedAt", Instant.now().toString(), "biller", biller)
        );
    }
}
