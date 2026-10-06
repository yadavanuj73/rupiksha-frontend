package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.IdPaymentDtos;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface IdPaymentService {
    IdPaymentDtos.PaymentDetailsResponse getPaymentDetails(String identifier);
    IdPaymentDtos.ApplyCouponResponse applyCoupon(String identifier, String couponCode);
    IdPaymentDtos.CreateIdOrderResponse createOrder(String identifier, String couponCode);
    IdPaymentDtos.VerifyPaymentResponse verifyPayment(IdPaymentDtos.VerifyPaymentRequest request);
    IdPaymentDtos.PaymentStatusResponse getPaymentStatus(String identifier);
    void handleWebhook(String rawPayload, Map<String, String> headers);

    // Admin Operations
    List<IdPaymentDtos.PendingPaymentUserView> getPendingUsers();
    List<IdPaymentDtos.SuccessPaymentUserView> getSuccessUsers();
    IdPaymentDtos.CouponResponse generateCoupon(UUID userId, BigDecimal discountPercent, String adminUsername);
}
