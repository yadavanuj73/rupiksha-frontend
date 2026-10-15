package com.rupiksha.backend.api;

import com.rupiksha.backend.service.IdPaymentService;
import com.rupiksha.backend.service.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
public class WebhookController {

    private final IdPaymentService idPaymentService;
    private final PaymentService paymentService;

    /**
     * Clean, unified webhook endpoints for Razorpay.
     * Accessible via:
     * - /api/v1/webhook/razorpay
     * - /webhook/razorpay
     * - /api/v1/webhook/id-payment
     * - /webhook/id-payment
     */
    @PostMapping({
            "/api/v1/webhook/razorpay",
            "/webhook/razorpay",
            "/api/v1/webhook/id-payment",
            "/webhook/id-payment"
    })
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> handleRazorpayWebhook(
            @RequestBody String rawPayload,
            @RequestHeader Map<String, String> headers
    ) {
        log.info("Received Razorpay webhook via clean endpoint");
        // Process ID payment webhook first
        try {
            idPaymentService.handleWebhook(rawPayload, headers);
        } catch (Exception e) {
            log.debug("ID payment webhook handler did not match: {}", e.getMessage());
            // Fallback to wallet payment webhook
            paymentService.handleWebhook("razorpay", rawPayload, headers);
        }
        return Map.of("success", true, "message", "Webhook processed successfully");
    }
}
