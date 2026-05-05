package com.rupiksha.backend.integration.recharge;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
public class MockRechargeTransferProvider implements RechargeTransferProvider {
    @Override
    public String providerName() {
        return "mock";
    }

    @Override
    public ProviderTxnResponse recharge(String userRef, String mobile, String operator, BigDecimal amount) {
        return new ProviderTxnResponse(
                true,
                "RCH_" + UUID.randomUUID(),
                "Recharge success (mock)",
                Map.of("mobile", mobile, "operator", operator, "amount", amount, "at", Instant.now().toString())
        );
    }

    @Override
    public ProviderTxnResponse transfer(String userRef, String beneficiary, String account, String ifsc, BigDecimal amount) {
        return new ProviderTxnResponse(
                true,
                "TRF_" + UUID.randomUUID(),
                "Transfer success (mock)",
                Map.of("beneficiary", beneficiary, "account", account, "ifsc", ifsc, "amount", amount, "at", Instant.now().toString())
        );
    }
}

