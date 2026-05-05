package com.rupiksha.backend.integration.payment;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
public class CustomPaymentGatewayProvider implements PaymentGatewayProvider {
    @Override
    public String providerName() {
        return "custom";
    }

    @Override
    public ProviderOrderResponse createOrder(String internalRef, BigDecimal amount, String purpose) {
        return new ProviderOrderResponse(
                "custom_order_" + UUID.randomUUID(),
                "custom",
                "pending_integration",
                Map.of(
                        "internal_ref", internalRef,
                        "purpose", purpose,
                        "amount", amount,
                        "created_at", Instant.now().toString(),
                        "note", "Custom payment adapter scaffolded. Integrate your internal provider API."
                )
        );
    }

    @Override
    public boolean verifyWebhook(String rawPayload, Map<String, String> headers) {
        return false;
    }

    @Override
    public boolean verifyPaymentSignature(Map<String, Object> payload) {
        return false;
    }

    @Override
    public WebhookEvent parseWebhookEvent(String rawPayload, Map<String, String> headers) {
        return new WebhookEvent(false, false, "", "Custom payment provider not integrated");
    }
}
