package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.Map;

public class PaymentDtos {
    public record CreateOrderRequest(
            @NotBlank String userId,
            @NotNull @DecimalMin("1.00") BigDecimal amount,
            @NotBlank String purpose
    ) {}

    public record CreateOrderResponse(
            String orderId,
            String provider,
            String status,
            BigDecimal amount,
            Map<String, Object> providerPayload
    ) {}

    public record WebhookResponse(boolean success, String message) {}
}

