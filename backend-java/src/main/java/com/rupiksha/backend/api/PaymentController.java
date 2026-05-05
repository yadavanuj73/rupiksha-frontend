package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.PaymentDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/payment")
@RequiredArgsConstructor
public class PaymentController {
    private final PaymentService paymentService;

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentDtos.CreateOrderResponse createOrder(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody PaymentDtos.CreateOrderRequest request
    ) {
        if (principal == null || principal.userId() == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        if (!principal.userId().toString().equalsIgnoreCase(request.userId())) {
            throw new IllegalArgumentException("userId in request must match authenticated principal");
        }
        return paymentService.createOrder(request);
    }

    @PostMapping("/webhook")
    public PaymentDtos.WebhookResponse webhook(
            @RequestBody String rawPayload,
            @RequestHeader Map<String, String> headers
    ) {
        return paymentService.handleWebhook(rawPayload, normalizeHeaders(headers));
    }

    @PostMapping("/webhook/{provider}")
    public PaymentDtos.WebhookResponse webhookByProvider(
            @PathVariable String provider,
            @RequestBody String rawPayload,
            @RequestHeader Map<String, String> headers
    ) {
        return paymentService.handleWebhook(provider, rawPayload, normalizeHeaders(headers));
    }

    // Compatibility endpoint for existing frontend AddMoney flow
    @PostMapping("/create-order")
    public Map<String, Object> createOrderCompat(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestBody Map<String, Object> request
    ) {
        if (principal == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        BigDecimal amount = new BigDecimal(String.valueOf(request.getOrDefault("amount", "0")));
        String customerId = String.valueOf(request.getOrDefault("customer_id", principal.username()));
        if (!principal.username().equals(customerId)) {
            throw new IllegalArgumentException("customer_id must match logged-in user");
        }
        String purpose = String.valueOf(request.getOrDefault("purpose", "WALLET_TOPUP"));
        PaymentDtos.CreateOrderResponse response = paymentService.createOrderCompat(amount, customerId, purpose);

        Map<String, Object> payload = new HashMap<>();
        payload.put("success", true);
        payload.put("provider", response.provider());
        payload.put("order_id", response.orderId());
        payload.put("amount", amount.multiply(BigDecimal.valueOf(100)).longValue());
        payload.put("key", "mock".equalsIgnoreCase(response.provider()) ? "rzp_test_mock_key" : null);
        payload.put("meta", response.providerPayload());
        return payload;
    }

    // Compatibility endpoint for existing frontend AddMoney flow
    @PostMapping("/verify-payment")
    public Map<String, Object> verifyPaymentCompat(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestBody Map<String, Object> payload
    ) {
        if (principal == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        boolean ok = paymentService.verifyPayment(payload);
        return Map.of(
                "success", ok,
                "message", ok ? "Payment verified" : "Invalid payment signature"
        );
    }

    private Map<String, String> normalizeHeaders(Map<String, String> headers) {
        return headers.entrySet().stream()
                .collect(Collectors.toMap(e -> e.getKey().toLowerCase(), Map.Entry::getValue, (a, b) -> b));
    }
}

