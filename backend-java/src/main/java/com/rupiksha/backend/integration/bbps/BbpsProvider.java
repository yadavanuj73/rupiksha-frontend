package com.rupiksha.backend.integration.bbps;

import java.math.BigDecimal;
import java.util.Map;

public interface BbpsProvider {
    String providerName();

    ProviderFetchResponse fetch(String userId, String biller, String opcode, String consumerNo, String category);

    ProviderPayResponse pay(String userId, String biller, String opcode, String consumerNo, String category, BigDecimal amount);

    record ProviderFetchResponse(boolean success, String message, Map<String, Object> bill) {}

    record ProviderPayResponse(boolean success, String providerTxnId, String message, Map<String, Object> raw) {}
}
