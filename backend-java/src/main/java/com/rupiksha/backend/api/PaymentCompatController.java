package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.PaymentDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.PaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PaymentCompatController {
    private final PaymentService paymentService;

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
}

