package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class IdPaymentDtos {

    public record PaymentDetailsResponse(
            String userId,
            String username,
            String mobile,
            String fullName,
            String role,
            String partyCode,
            BigDecimal originalAmount,
            BigDecimal discountAmount,
            BigDecimal finalAmount,
            String paymentStatus,
            String appliedCouponCode,
            BigDecimal appliedCouponDiscountPercent,
            String razorpayKeyId
    ) {}

    public record ApplyCouponRequest(
            @NotBlank String identifier,
            @NotBlank String couponCode
    ) {}

    public record ApplyCouponResponse(
            boolean valid,
            String couponCode,
            BigDecimal discountPercent,
            BigDecimal originalAmount,
            BigDecimal discountAmount,
            BigDecimal finalAmount,
            String message
    ) {}

    public record CreateIdOrderRequest(
            @NotBlank String identifier,
            String couponCode
    ) {}

    public record CreateIdOrderResponse(
            String orderId,
            String razorpayKeyId,
            BigDecimal amount,
            BigDecimal discountAmount,
            BigDecimal finalAmount,
            String currency,
            String customerName,
            String customerMobile,
            String customerEmail,
            String status
    ) {}

    public record VerifyPaymentRequest(
            @NotBlank String razorpayOrderId,
            @NotBlank String razorpayPaymentId,
            @NotBlank String razorpaySignature
    ) {}

    public record VerifyPaymentResponse(
            boolean success,
            String message,
            String paymentStatus,
            String accessToken,
            String refreshToken,
            AuthDtos.UserView user
    ) {
        public VerifyPaymentResponse(boolean success, String message, String paymentStatus) {
            this(success, message, paymentStatus, null, null, null);
        }
    }

    public record PaymentStatusResponse(
            String userId,
            String username,
            String mobile,
            String role,
            String paymentStatus,
            Instant paidAt,
            String lastOrderId,
            String lastPaymentId
    ) {}

    public record GenerateCouponRequest(
            @NotBlank String userId,
            @NotNull @DecimalMin("1.0") @DecimalMax("100.0") BigDecimal discountPercent
    ) {}

    public record CouponResponse(
            String id,
            String userId,
            String userName,
            String userMobile,
            String code,
            BigDecimal discountPercent,
            Instant validFrom,
            Instant validTo,
            boolean isUsed,
            Instant usedAt,
            String createdBy,
            Instant createdAt
    ) {}

    public record PendingPaymentUserView(
            String id,
            String fullName,
            String username,
            String mobile,
            String email,
            String role,
            String partyCode,
            Instant registrationDate,
            BigDecimal originalAmount,
            BigDecimal discountAmount,
            BigDecimal finalAmount,
            String paymentStatus,
            String activeCouponCode,
            BigDecimal activeCouponDiscountPercent,
            Instant activeCouponValidTo
    ) {}

    public record SuccessPaymentUserView(
            String id,
            String fullName,
            String username,
            String mobile,
            String email,
            String role,
            String partyCode,
            BigDecimal originalAmount,
            BigDecimal discountAmount,
            BigDecimal finalAmountPaid,
            String couponCode,
            String razorpayOrderId,
            String razorpayPaymentId,
            Instant paymentDate,
            String paymentStatus
    ) {}

    public record RoleChargeItem(
            String role,
            String displayName,
            BigDecimal amount,
            Instant updatedAt,
            String updatedBy
    ) {}

    public record RoleChargesResponse(
            boolean success,
            List<RoleChargeItem> charges
    ) {}

    public record UpdateRoleChargesRequest(
            @NotNull @DecimalMin("1.0") BigDecimal retailerCharge,
            @NotNull @DecimalMin("1.0") BigDecimal distributorCharge,
            @NotNull @DecimalMin("1.0") BigDecimal superDistributorCharge
    ) {}
}

