package com.rupiksha.backend.integration.payment;

import com.rupiksha.backend.config.AppProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class RazorpayPaymentGatewayProvider implements PaymentGatewayProvider {
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String providerName() {
        return "razorpay";
    }

    /**
     * Creates a Razorpay order using the official SDK.
     * Reference: https://razorpay.com/docs/payments/server-integration/java/integration-steps
     */
    @Override
    public ProviderOrderResponse createOrder(String internalRef, BigDecimal amount, String purpose) {
        String keyId = appProperties.providers().payment().keyId();
        String keySecret = appProperties.providers().payment().keySecret();
        if (keyId == null || keyId.isBlank() || keySecret == null || keySecret.isBlank()) {
            throw new IllegalArgumentException("Razorpay keys not configured");
        }

        try {
            RazorpayClient razorpayClient = new RazorpayClient(keyId, keySecret);

            JSONObject orderRequest = new JSONObject();
            // Amount must be in smallest currency subunit (paise for INR)
            orderRequest.put("amount", amount.multiply(BigDecimal.valueOf(100)).longValue());
            orderRequest.put("currency", "INR");
            orderRequest.put("receipt", internalRef);

            JSONObject notes = new JSONObject();
            notes.put("purpose", purpose);
            notes.put("platform", "rupiksha");
            orderRequest.put("notes", notes);

            Order order = razorpayClient.orders.create(orderRequest);
            String orderId = order.get("id");

            log.info("Razorpay order created via official SDK: {} for amount {} paise", orderId, amount.multiply(BigDecimal.valueOf(100)).longValue());

            Map<String, Object> payload = new HashMap<>();
            payload.put("id", orderId);
            payload.put("entity", order.get("entity"));
            payload.put("amount", order.get("amount"));
            payload.put("currency", order.get("currency"));
            payload.put("receipt", order.get("receipt"));
            payload.put("status", order.get("status"));

            return new ProviderOrderResponse(orderId, providerName(), "created", payload);
        } catch (RazorpayException e) {
            log.error("Razorpay SDK order creation failed: {}", e.getMessage(), e);
            throw new IllegalStateException("Razorpay order creation failed: " + e.getMessage(), e);
        }
    }

    /**
     * Verifies Razorpay webhook signature using HMAC-SHA256.
     */
    @Override
    public boolean verifyWebhook(String rawPayload, Map<String, String> headers) {
        String secret = appProperties.providers().payment().webhookSecret();
        if (secret == null || secret.isBlank()) return false;

        String provided = "";
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if ("x-razorpay-signature".equalsIgnoreCase(entry.getKey())) {
                provided = entry.getValue();
                break;
            }
        }
        if (provided.isBlank()) return false;

        try {
            return Utils.verifyWebhookSignature(rawPayload, provided, secret);
        } catch (RazorpayException e) {
            log.warn("Razorpay webhook signature verification failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Verifies payment signature using the official Razorpay SDK utility.
     * generated_signature = hmac_sha256(order_id + "|" + razorpay_payment_id, secret)
     */
    @Override
    public boolean verifyPaymentSignature(Map<String, Object> payload) {
        String secret = appProperties.providers().payment().keySecret();
        String orderId = String.valueOf(payload.getOrDefault("razorpay_order_id", ""));
        String paymentId = String.valueOf(payload.getOrDefault("razorpay_payment_id", ""));
        String signature = String.valueOf(payload.getOrDefault("razorpay_signature", ""));

        if (secret == null || secret.isBlank() || orderId.isBlank()
                || paymentId.isBlank() || signature.isBlank()) return false;

        try {
            JSONObject options = new JSONObject();
            options.put("razorpay_order_id", orderId);
            options.put("razorpay_payment_id", paymentId);
            options.put("razorpay_signature", signature);

            // Official SDK verification — uses HMAC-SHA256 internally
            return Utils.verifyPaymentSignature(options, secret);
        } catch (RazorpayException e) {
            log.warn("Razorpay payment signature verification failed: {}", e.getMessage());
            return false;
        }
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
