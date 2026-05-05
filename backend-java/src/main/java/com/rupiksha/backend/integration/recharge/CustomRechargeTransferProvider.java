package com.rupiksha.backend.integration.recharge;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Component
public class CustomRechargeTransferProvider implements RechargeTransferProvider {
    @Override
    public String providerName() {
        return "custom";
    }

    @Override
    public ProviderTxnResponse recharge(String userRef, String mobile, String operator, BigDecimal amount) {
        return new ProviderTxnResponse(
                false,
                "CUST-RCG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                "Custom recharge provider scaffolded. Integrate your provider API.",
                Map.of("mobile", mobile, "operator", operator, "amount", amount)
        );
    }

    @Override
    public ProviderTxnResponse transfer(String userRef, String beneficiary, String account, String ifsc, BigDecimal amount) {
        return new ProviderTxnResponse(
                false,
                "CUST-TRF-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
                "Custom transfer provider scaffolded. Integrate your provider API.",
                Map.of("beneficiary", beneficiary, "account", account, "ifsc", ifsc, "amount", amount)
        );
    }
}
