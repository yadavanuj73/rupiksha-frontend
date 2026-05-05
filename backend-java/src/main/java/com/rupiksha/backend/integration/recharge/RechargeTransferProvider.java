package com.rupiksha.backend.integration.recharge;

import java.math.BigDecimal;
import java.util.Map;

public interface RechargeTransferProvider {
    String providerName();
    ProviderTxnResponse recharge(String userRef, String mobile, String operator, BigDecimal amount);
    ProviderTxnResponse transfer(String userRef, String beneficiary, String account, String ifsc, BigDecimal amount);

    record ProviderTxnResponse(boolean success, String providerTxnId, String message, Map<String, Object> raw) {}
}

