package com.rupiksha.backend.integration.aeps;

import java.math.BigDecimal;
import java.util.Map;

public interface AepsProvider {
    String providerName();

    ProviderResponse transact(String userId, String tab, String mobile, String operator, String bankName, BigDecimal amount);

    record ProviderResponse(boolean success, String providerTxnId, String message, Map<String, Object> raw) {}
}
