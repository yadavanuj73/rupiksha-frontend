package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.IdPaymentDtos;
import com.rupiksha.backend.service.IdPaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/id-payment")
@RequiredArgsConstructor
public class IdPaymentController {

    private final IdPaymentService idPaymentService;

    @GetMapping("/details")
    public ResponseEntity<IdPaymentDtos.PaymentDetailsResponse> getPaymentDetails(@RequestParam String identifier) {
        return ResponseEntity.ok(idPaymentService.getPaymentDetails(identifier));
    }

    @PostMapping("/apply-coupon")
    public ResponseEntity<IdPaymentDtos.ApplyCouponResponse> applyCoupon(@Valid @RequestBody IdPaymentDtos.ApplyCouponRequest request) {
        return ResponseEntity.ok(idPaymentService.applyCoupon(request.identifier(), request.couponCode()));
    }

    @PostMapping("/create-order")
    public ResponseEntity<IdPaymentDtos.CreateIdOrderResponse> createOrder(@Valid @RequestBody IdPaymentDtos.CreateIdOrderRequest request) {
        return ResponseEntity.ok(idPaymentService.createOrder(request.identifier(), request.couponCode()));
    }

    @PostMapping("/verify")
    public ResponseEntity<IdPaymentDtos.VerifyPaymentResponse> verifyPayment(@Valid @RequestBody IdPaymentDtos.VerifyPaymentRequest request) {
        return ResponseEntity.ok(idPaymentService.verifyPayment(request));
    }

    @GetMapping("/status")
    public ResponseEntity<IdPaymentDtos.PaymentStatusResponse> getPaymentStatus(@RequestParam String identifier) {
        return ResponseEntity.ok(idPaymentService.getPaymentStatus(identifier));
    }

    @PostMapping("/webhook")
    @ResponseStatus(HttpStatus.OK)
    public Map<String, Object> handleWebhook(
            @RequestBody String rawPayload,
            @RequestHeader Map<String, String> headers
    ) {
        idPaymentService.handleWebhook(rawPayload, headers);
        return Map.of("success", true, "message", "Webhook processed successfully");
    }
}
