package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.PaymentDtos;

import java.util.Map;
import java.math.BigDecimal;

public interface PaymentService {
    PaymentDtos.CreateOrderResponse createOrder(PaymentDtos.CreateOrderRequest request);
    PaymentDtos.WebhookResponse handleWebhook(String rawPayload, Map<String, String> headers);
    PaymentDtos.WebhookResponse handleWebhook(String provider, String rawPayload, Map<String, String> headers);
    boolean verifyPayment(Map<String, Object> payload);
    PaymentDtos.CreateOrderResponse createOrderCompat(BigDecimal amount, String customerId, String purpose);
}

