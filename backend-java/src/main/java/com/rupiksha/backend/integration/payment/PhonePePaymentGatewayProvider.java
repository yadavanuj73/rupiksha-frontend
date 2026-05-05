package com.rupiksha.backend.integration.payment;

import com.rupiksha.backend.config.AppProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class PhonePePaymentGatewayProvider implements PaymentGatewayProvider {
    private final AppProperties appProperties;
    private final RestTemplateBuilder restTemplateBuilder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String providerName() {
        return "phonepe";
    }

    @Override
    public ProviderOrderResponse createOrder(String internalRef, BigDecimal amount, String purpose) {
        String merchantId = appProperties.providers().payment().keyId();
        String saltKey = appProperties.providers().payment().keySecret();
        if (merchantId == null || merchantId.isBlank() || saltKey == null || saltKey.isBlank()) {
            throw new IllegalArgumentException("PhonePe credentials not configured");
        }
        try {
            String base = appProperties.providers().payment().baseUrl();
            if (base == null || base.isBlank()) base = "https://api-preprod.phonepe.com/apis/pg-sandbox";
            String endpoint = "/pg/v1/pay";
            RestTemplate rt = restTemplateBuilder.build();

            Map<String, Object> req = new HashMap<>();
            req.put("merchantId", merchantId);
            req.put("merchantTransactionId", internalRef);
            req.put("merchantUserId", internalRef);
            req.put("amount", amount.multiply(BigDecimal.valueOf(100)).longValue());
            String publicBaseUrl = appProperties.publicBaseUrl() == null ? "http://localhost:8080" : appProperties.publicBaseUrl();
            req.put("redirectUrl", publicBaseUrl + "/api/v1/payment/redirect/phonepe");
            req.put("redirectMode", "REDIRECT");
            req.put("callbackUrl", publicBaseUrl + "/api/v1/payment/webhook/phonepe");
            req.put("paymentInstrument", Map.of("type", "PAY_PAGE"));

            String json = objectMapper.writeValueAsString(req);
            String base64Payload = Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
            String xVerify = PaymentSignatureUtils.sha256Hex(base64Payload + endpoint + saltKey) + "###1";

            Map<String, Object> wrapped = Map.of("request", base64Payload);
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-VERIFY", xVerify);
            headers.set("Content-Type", "application/json");
            ResponseEntity<Map> res = rt.exchange(base + endpoint, HttpMethod.POST, new HttpEntity<>(wrapped, headers), Map.class);
            Map body = res.getBody();
            String orderId = String.valueOf(body.getOrDefault("merchantTransactionId", internalRef));
            return new ProviderOrderResponse(orderId, providerName(), "created", body);
        } catch (Exception e) {
            throw new IllegalArgumentException("PhonePe order creation failed: " + e.getMessage());
        }
    }

    @Override
    public boolean verifyWebhook(String rawPayload, Map<String, String> headers) {
        String secret = appProperties.providers().payment().webhookSecret();
        String provided = headers.getOrDefault("x-verify", "");
        if (secret == null || secret.isBlank() || provided.isBlank()) return false;
        String computed = PaymentSignatureUtils.sha256Hex(rawPayload + secret);
        return provided.toLowerCase().startsWith(computed.toLowerCase());
    }

    @Override
    public boolean verifyPaymentSignature(Map<String, Object> payload) {
        return payload.containsKey("merchantTransactionId") || payload.containsKey("transactionId");
    }

    @Override
    public WebhookEvent parseWebhookEvent(String rawPayload, Map<String, String> headers) {
        try {
            if (!verifyWebhook(rawPayload, headers)) {
                return new WebhookEvent(false, false, "", "Invalid PhonePe webhook signature");
            }
            Map<String, Object> body = objectMapper.readValue(rawPayload, new TypeReference<>() {});
            String state = String.valueOf(body.getOrDefault("state", ""));
            String orderId = String.valueOf(body.getOrDefault("merchantTransactionId", ""));
            if (orderId.isBlank()) {
                return new WebhookEvent(false, false, "", "Missing merchantTransactionId");
            }
            boolean success = "COMPLETED".equalsIgnoreCase(state) || "SUCCESS".equalsIgnoreCase(state);
            return new WebhookEvent(true, success, orderId, "PhonePe webhook parsed");
        } catch (Exception e) {
            return new WebhookEvent(false, false, "", "Invalid PhonePe payload");
        }
    }
}

