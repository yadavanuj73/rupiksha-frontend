package com.rupiksha.backend.integration.payment;

import java.math.BigDecimal;
import java.util.Map;

public interface PaymentGatewayProvider {
    String providerName();
    ProviderOrderResponse createOrder(String internalRef, BigDecimal amount, String purpose);
    boolean verifyWebhook(String rawPayload, Map<String, String> headers);
    boolean verifyPaymentSignature(Map<String, Object> payload);
    WebhookEvent parseWebhookEvent(String rawPayload, Map<String, String> headers);

    record ProviderOrderResponse(String orderId, String provider, String status, Map<String, Object> payload) {}
    record WebhookEvent(boolean valid, boolean success, String orderId, String message) {}
}

