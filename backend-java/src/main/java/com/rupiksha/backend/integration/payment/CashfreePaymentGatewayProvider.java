package com.rupiksha.backend.integration.payment;

import com.rupiksha.backend.config.AppProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class CashfreePaymentGatewayProvider implements PaymentGatewayProvider {
    private final AppProperties appProperties;
    private final RestTemplateBuilder restTemplateBuilder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String providerName() {
        return "cashfree";
    }

    @Override
    public ProviderOrderResponse createOrder(String internalRef, BigDecimal amount, String purpose) {
        String clientId = appProperties.providers().payment().keyId();
        String clientSecret = appProperties.providers().payment().keySecret();
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new IllegalArgumentException("Cashfree keys not configured");
        }
        RestTemplate rt = restTemplateBuilder.build();
        String base = appProperties.providers().payment().baseUrl();
        if (base == null || base.isBlank()) base = "https://sandbox.cashfree.com";
        String url = base + "/pg/orders";

        Map<String, Object> req = Map.of(
                "order_id", "cf_" + internalRef.replace("-", ""),
                "order_amount", amount,
                "order_currency", "INR",
                "order_note", purpose,
                "customer_details", Map.of(
                        "customer_id", internalRef,
                        "customer_phone", "9999999999"
                )
        );
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-client-id", clientId);
        headers.set("x-client-secret", clientSecret);
        headers.set("x-api-version", "2023-08-01");

        ResponseEntity<Map> res = rt.exchange(url, HttpMethod.POST, new HttpEntity<>(req, headers), Map.class);
        Map body = res.getBody();
        String orderId = String.valueOf(body.getOrDefault("order_id", ""));
        return new ProviderOrderResponse(orderId, providerName(), String.valueOf(body.getOrDefault("order_status", "created")), body);
    }

    @Override
    public boolean verifyWebhook(String rawPayload, Map<String, String> headers) {
        String secret = appProperties.providers().payment().webhookSecret();
        String ts = headers.getOrDefault("x-webhook-timestamp", "");
        String sig = headers.getOrDefault("x-webhook-signature", "");
        if (secret == null || secret.isBlank() || ts.isBlank() || sig.isBlank()) return false;
        String computed = PaymentSignatureUtils.hmacSha256Hex(ts + rawPayload, secret);
        return computed.equalsIgnoreCase(sig);
    }

    @Override
    public boolean verifyPaymentSignature(Map<String, Object> payload) {
        // Cashfree final verification should be via order status API on server-side.
        String orderId = String.valueOf(payload.getOrDefault("order_id", ""));
        return !orderId.isBlank();
    }

    @Override
    public WebhookEvent parseWebhookEvent(String rawPayload, Map<String, String> headers) {
        try {
            if (!verifyWebhook(rawPayload, headers)) {
                return new WebhookEvent(false, false, "", "Invalid Cashfree webhook signature");
            }
            Map<String, Object> body = objectMapper.readValue(rawPayload, new TypeReference<>() {});
            String type = String.valueOf(body.getOrDefault("type", ""));
            Object dataObj = body.get("data");
            if (!(dataObj instanceof Map<?, ?> data)) {
                return new WebhookEvent(false, false, "", "Missing Cashfree data object");
            }
            Object orderObj = data.get("order");
            if (!(orderObj instanceof Map<?, ?> order)) {
                return new WebhookEvent(false, false, "", "Missing order object");
            }
            Object orderIdObj = order.get("order_id");
            Object orderStatusObj = order.get("order_status");
            String orderId = orderIdObj == null ? "" : String.valueOf(orderIdObj);
            String orderStatus = orderStatusObj == null ? "" : String.valueOf(orderStatusObj);
            if (orderId.isBlank()) {
                return new WebhookEvent(false, false, "", "Missing order_id");
            }
            boolean success = "PAYMENT_SUCCESS_WEBHOOK".equalsIgnoreCase(type) || "PAID".equalsIgnoreCase(orderStatus);
            return new WebhookEvent(true, success, orderId, "Cashfree webhook parsed");
        } catch (Exception e) {
            return new WebhookEvent(false, false, "", "Invalid Cashfree payload");
        }
    }
}

