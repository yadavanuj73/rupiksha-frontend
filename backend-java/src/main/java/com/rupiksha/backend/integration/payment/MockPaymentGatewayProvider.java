package com.rupiksha.backend.integration.payment;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
@Primary
public class MockPaymentGatewayProvider implements PaymentGatewayProvider {
    @Override
    public String providerName() {
        return "mock";
    }

    @Override
    public ProviderOrderResponse createOrder(String internalRef, BigDecimal amount, String purpose) {
        String orderId = "mock_order_" + UUID.randomUUID();
        return new ProviderOrderResponse(
                orderId,
                "mock",
                "created",
                Map.of(
                        "internal_ref", internalRef,
                        "purpose", purpose,
                        "amount", amount,
                        "created_at", Instant.now().toString()
                )
        );
    }

    @Override
    public boolean verifyWebhook(String rawPayload, Map<String, String> headers) {
        return true;
    }

    @Override
    public boolean verifyPaymentSignature(Map<String, Object> payload) {
        return true;
    }

    @Override
    public WebhookEvent parseWebhookEvent(String rawPayload, Map<String, String> headers) {
        String orderId = headers.getOrDefault("x-order-id", "");
        return new WebhookEvent(true, true, orderId, "mock webhook parsed");
    }
}

