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
import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class RazorpayPaymentGatewayProvider implements PaymentGatewayProvider {
    private final AppProperties appProperties;
    private final RestTemplateBuilder restTemplateBuilder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String providerName() {
        return "razorpay";
    }

    @Override
    public ProviderOrderResponse createOrder(String internalRef, BigDecimal amount, String purpose) {
        String keyId = appProperties.providers().payment().keyId();
        String keySecret = appProperties.providers().payment().keySecret();
        if (keyId == null || keyId.isBlank() || keySecret == null || keySecret.isBlank()) {
            throw new IllegalArgumentException("Razorpay keys not configured");
        }
        RestTemplate rt = restTemplateBuilder.build();
        String url = "https://api.razorpay.com/v1/orders";

        Map<String, Object> req = new HashMap<>();
        req.put("amount", amount.multiply(BigDecimal.valueOf(100)).longValue());
        req.put("currency", "INR");
        req.put("receipt", internalRef);
        req.put("notes", Map.of("purpose", purpose));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBasicAuth(keyId, keySecret);
        ResponseEntity<Map> res = rt.exchange(url, HttpMethod.POST, new HttpEntity<>(req, headers), Map.class);

        Map body = res.getBody();
        String orderId = String.valueOf(body.get("id"));
        return new ProviderOrderResponse(orderId, providerName(), "created", body);
    }

    @Override
    public boolean verifyWebhook(String rawPayload, Map<String, String> headers) {
        String secret = appProperties.providers().payment().webhookSecret();
        String provided = headers.getOrDefault("x-razorpay-signature", "");
        if (secret == null || secret.isBlank() || provided.isBlank()) return false;
        String computed = PaymentSignatureUtils.hmacSha256Hex(rawPayload, secret);
        return computed.equalsIgnoreCase(provided);
    }

    @Override
    public boolean verifyPaymentSignature(Map<String, Object> payload) {
        String secret = appProperties.providers().payment().keySecret();
        String orderId = String.valueOf(payload.getOrDefault("razorpay_order_id", ""));
        String paymentId = String.valueOf(payload.getOrDefault("razorpay_payment_id", ""));
        String signature = String.valueOf(payload.getOrDefault("razorpay_signature", ""));
        if (secret == null || secret.isBlank() || orderId.isBlank() || paymentId.isBlank() || signature.isBlank()) return false;
        String computed = PaymentSignatureUtils.hmacSha256Hex(orderId + "|" + paymentId, secret);
        return computed.equalsIgnoreCase(signature);
    }

    @Override
    public WebhookEvent parseWebhookEvent(String rawPayload, Map<String, String> headers) {
        try {
            if (!verifyWebhook(rawPayload, headers)) {
                return new WebhookEvent(false, false, "", "Invalid Razorpay webhook signature");
            }
            Map<String, Object> body = objectMapper.readValue(rawPayload, new TypeReference<>() {});
            String event = String.valueOf(body.getOrDefault("event", ""));
            Object payloadObj = body.get("payload");
            if (!(payloadObj instanceof Map<?, ?> payloadMap)) {
                return new WebhookEvent(false, false, "", "Missing payload object");
            }
            Object paymentEntityObj = ((Map<?, ?>) payloadMap).get("payment");
            if (!(paymentEntityObj instanceof Map<?, ?> paymentWrapper)) {
                return new WebhookEvent(false, false, "", "Missing payment entity wrapper");
            }
            Object entityObj = paymentWrapper.get("entity");
            if (!(entityObj instanceof Map<?, ?> entity)) {
                return new WebhookEvent(false, false, "", "Missing payment entity");
            }
            Object orderIdObj = entity.get("order_id");
            Object statusObj = entity.get("status");
            String orderId = orderIdObj == null ? "" : String.valueOf(orderIdObj);
            String status = statusObj == null ? "" : String.valueOf(statusObj);
            if (orderId.isBlank()) {
                return new WebhookEvent(false, false, "", "Missing order_id");
            }
            boolean success = "payment.captured".equalsIgnoreCase(event) || "captured".equalsIgnoreCase(status);
            return new WebhookEvent(true, success, orderId, "Razorpay webhook parsed");
        } catch (Exception e) {
            return new WebhookEvent(false, false, "", "Invalid Razorpay payload");
        }
    }
}

