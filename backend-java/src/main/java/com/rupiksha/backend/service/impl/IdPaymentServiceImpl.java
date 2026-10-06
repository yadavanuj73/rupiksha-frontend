package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.IdPaymentDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.integration.payment.PaymentSignatureUtils;
import com.rupiksha.backend.integration.payment.RazorpayPaymentGatewayProvider;
import com.rupiksha.backend.repository.IdCouponRepository;
import com.rupiksha.backend.repository.IdPaymentTransactionRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.service.IdPaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdPaymentServiceImpl implements IdPaymentService {

    private final UserRepository userRepository;
    private final IdCouponRepository idCouponRepository;
    private final IdPaymentTransactionRepository idPaymentTransactionRepository;
    private final com.rupiksha.backend.repository.IdChargeSettingRepository idChargeSettingRepository;
    private final RazorpayPaymentGatewayProvider razorpayPaymentGatewayProvider;
    private final AppProperties appProperties;
    private final SecureRandom secureRandom = new SecureRandom();

    // Standard authoritative ID charge amounts
    public static final BigDecimal RETAILER_CHARGE = new BigDecimal("2999.00");
    public static final BigDecimal DISTRIBUTOR_CHARGE = new BigDecimal("5999.00");
    public static final BigDecimal SUPER_DISTRIBUTOR_CHARGE = new BigDecimal("9999.00");

    @Override
    @Transactional(readOnly = true)
    public IdPaymentDtos.PaymentDetailsResponse getPaymentDetails(String identifier) {
        User user = findUser(identifier);
        RoleName primaryRole = resolvePrimaryRole(user);
        BigDecimal originalAmount = getChargeForRole(primaryRole);

        // Find active valid coupon for this user if available
        Optional<IdCoupon> activeCoupon = idCouponRepository.findByUserIdAndIsUsedFalseAndValidToAfter(user.getId(), Instant.now());
        BigDecimal discountPercent = activeCoupon.map(IdCoupon::getDiscountPercent).orElse(BigDecimal.ZERO);
        BigDecimal discountAmount = calculateDiscount(originalAmount, discountPercent);
        BigDecimal finalAmount = calculateFinalAmount(originalAmount, discountAmount);

        String razorpayKeyId = getEffectiveRazorpayKeyId();

        return new IdPaymentDtos.PaymentDetailsResponse(
                user.getId().toString(),
                user.getUsername(),
                user.getMobile(),
                user.getFullName(),
                primaryRole.name(),
                user.getPartyCode(),
                originalAmount,
                discountAmount,
                finalAmount,
                user.getIdPaymentStatus() != null ? user.getIdPaymentStatus().name() : IdPaymentStatus.PENDING.name(),
                activeCoupon.map(IdCoupon::getCode).orElse(null),
                activeCoupon.map(IdCoupon::getDiscountPercent).orElse(null),
                razorpayKeyId
        );
    }

    @Override
    @Transactional(readOnly = true)
    public IdPaymentDtos.ApplyCouponResponse applyCoupon(String identifier, String couponCode) {
        User user = findUser(identifier);
        RoleName primaryRole = resolvePrimaryRole(user);
        BigDecimal originalAmount = getChargeForRole(primaryRole);

        if (couponCode == null || couponCode.isBlank()) {
            return new IdPaymentDtos.ApplyCouponResponse(
                    false, null, BigDecimal.ZERO, originalAmount, BigDecimal.ZERO, originalAmount, "Coupon code cannot be empty"
            );
        }

        String cleanCode = couponCode.trim().toUpperCase(Locale.ROOT);
        Optional<IdCoupon> couponOpt = idCouponRepository.findByCode(cleanCode);
        if (couponOpt.isEmpty()) {
            return new IdPaymentDtos.ApplyCouponResponse(
                    false, cleanCode, BigDecimal.ZERO, originalAmount, BigDecimal.ZERO, originalAmount, "Invalid coupon code"
            );
        }

        IdCoupon coupon = couponOpt.get();
        if (!coupon.getUser().getId().equals(user.getId())) {
            return new IdPaymentDtos.ApplyCouponResponse(
                    false, cleanCode, BigDecimal.ZERO, originalAmount, BigDecimal.ZERO, originalAmount, "This coupon is not assigned to your account"
            );
        }

        if (Boolean.TRUE.equals(coupon.getIsUsed())) {
            return new IdPaymentDtos.ApplyCouponResponse(
                    false, cleanCode, BigDecimal.ZERO, originalAmount, BigDecimal.ZERO, originalAmount, "This coupon has already been used"
            );
        }

        if (coupon.getValidTo().isBefore(Instant.now())) {
            return new IdPaymentDtos.ApplyCouponResponse(
                    false, cleanCode, BigDecimal.ZERO, originalAmount, BigDecimal.ZERO, originalAmount, "This coupon has expired"
            );
        }

        BigDecimal discountPercent = coupon.getDiscountPercent();
        BigDecimal discountAmount = calculateDiscount(originalAmount, discountPercent);
        BigDecimal finalAmount = calculateFinalAmount(originalAmount, discountAmount);

        return new IdPaymentDtos.ApplyCouponResponse(
                true, cleanCode, discountPercent, originalAmount, discountAmount, finalAmount,
                "Coupon applied successfully! " + discountPercent.stripTrailingZeros().toPlainString() + "% discount."
        );
    }

    @Override
    @Transactional
    public IdPaymentDtos.CreateIdOrderResponse createOrder(String identifier, String couponCode) {
        User user = findUser(identifier);

        if (user.getIdPaymentStatus() == IdPaymentStatus.SUCCESS) {
            throw new IllegalArgumentException("ID Charge payment already completed for this account");
        }

        RoleName primaryRole = resolvePrimaryRole(user);
        BigDecimal originalAmount = getChargeForRole(primaryRole);
        BigDecimal discountAmount = BigDecimal.ZERO;
        IdCoupon appliedCoupon = null;

        if (couponCode != null && !couponCode.isBlank()) {
            String cleanCode = couponCode.trim().toUpperCase(Locale.ROOT);
            IdCoupon coupon = idCouponRepository.findByCode(cleanCode)
                    .orElseThrow(() -> new IllegalArgumentException("Invalid coupon code"));

            if (!coupon.getUser().getId().equals(user.getId())) {
                throw new IllegalArgumentException("This coupon does not belong to your account");
            }
            if (Boolean.TRUE.equals(coupon.getIsUsed())) {
                throw new IllegalArgumentException("This coupon has already been used");
            }
            if (coupon.getValidTo().isBefore(Instant.now())) {
                throw new IllegalArgumentException("This coupon has expired");
            }

            appliedCoupon = coupon;
            discountAmount = calculateDiscount(originalAmount, coupon.getDiscountPercent());
        }

        BigDecimal finalAmount = calculateFinalAmount(originalAmount, discountAmount);

        // Check for recent pending order (within 15 minutes) with identical final amount to prevent duplicate orders
        Instant fifteenMinutesAgo = Instant.now().minus(15, ChronoUnit.MINUTES);
        Optional<IdPaymentTransaction> existingPendingOpt = idPaymentTransactionRepository
                .findTopByUserIdAndStatusOrderByCreatedAtDesc(user.getId(), IdPaymentStatus.PENDING);

        if (existingPendingOpt.isPresent()) {
            IdPaymentTransaction existing = existingPendingOpt.get();
            if (existing.getCreatedAt().isAfter(fifteenMinutesAgo)
                    && existing.getFinalAmount().compareTo(finalAmount) == 0
                    && existing.getRazorpayOrderId() != null
                    && !existing.getRazorpayOrderId().isBlank()) {

                log.info("Reusing recent pending ID payment order {} for user {}", existing.getRazorpayOrderId(), user.getUsername());
                return new IdPaymentDtos.CreateIdOrderResponse(
                        existing.getRazorpayOrderId(),
                        getEffectiveRazorpayKeyId(),
                        existing.getAmount(),
                        existing.getDiscountAmount(),
                        existing.getFinalAmount(),
                        existing.getCurrency(),
                        user.getFullName(),
                        user.getMobile(),
                        user.getEmail(),
                        existing.getStatus().name()
                );
            }
        }

        String internalRef = "IDPAY_" + user.getId().toString().substring(0, 8) + "_" + System.currentTimeMillis();
        String orderId;

        String keyId = appProperties.providers() != null && appProperties.providers().payment() != null
                ? appProperties.providers().payment().keyId() : null;
        String keySecret = appProperties.providers() != null && appProperties.providers().payment() != null
                ? appProperties.providers().payment().keySecret() : null;

        boolean isRealRazorpay = keyId != null && !keyId.isBlank() && keySecret != null && !keySecret.isBlank()
                && !"mock".equalsIgnoreCase(keyId) && !"mock".equalsIgnoreCase(appProperties.providers().payment().name());

        if (isRealRazorpay) {
            try {
                var res = razorpayPaymentGatewayProvider.createOrder(internalRef, finalAmount, "ID Charge Payment for " + primaryRole.name());
                orderId = res.orderId();
            } catch (Exception e) {
                log.error("Failed to create Razorpay order for user {}: {}", user.getUsername(), e.getMessage());
                throw new IllegalStateException("Failed to create Razorpay order: " + e.getMessage());
            }
        } else {
            orderId = "order_mock_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
            log.info("Mock Razorpay order generated: {} for amount {}", orderId, finalAmount);
        }

        IdPaymentTransaction txn = new IdPaymentTransaction();
        txn.setUser(user);
        txn.setRazorpayOrderId(orderId);
        txn.setAmount(originalAmount);
        txn.setDiscountAmount(discountAmount);
        txn.setFinalAmount(finalAmount);
        txn.setCurrency("INR");
        txn.setStatus(IdPaymentStatus.PENDING);
        txn.setCoupon(appliedCoupon);
        idPaymentTransactionRepository.save(txn);

        log.info("Created ID payment transaction {} (orderId: {}) for user {}", txn.getId(), orderId, user.getUsername());

        return new IdPaymentDtos.CreateIdOrderResponse(
                orderId,
                getEffectiveRazorpayKeyId(),
                originalAmount,
                discountAmount,
                finalAmount,
                "INR",
                user.getFullName(),
                user.getMobile(),
                user.getEmail(),
                IdPaymentStatus.PENDING.name()
        );
    }

    @Override
    @Transactional
    public IdPaymentDtos.VerifyPaymentResponse verifyPayment(IdPaymentDtos.VerifyPaymentRequest request) {
        String orderId = request.razorpayOrderId().trim();
        String paymentId = request.razorpayPaymentId().trim();
        String signature = request.razorpaySignature().trim();

        IdPaymentTransaction txn = idPaymentTransactionRepository.findByRazorpayOrderId(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found for order ID: " + orderId));

        if (txn.getStatus() == IdPaymentStatus.SUCCESS) {
            return new IdPaymentDtos.VerifyPaymentResponse(true, "Payment already verified", IdPaymentStatus.SUCCESS.name());
        }

        String keySecret = appProperties.providers() != null && appProperties.providers().payment() != null
                ? appProperties.providers().payment().keySecret() : null;

        boolean isMock = keySecret == null || keySecret.isBlank() || "mock".equalsIgnoreCase(keySecret)
                || orderId.startsWith("order_mock_");

        if (!isMock) {
            Map<String, Object> payload = Map.of(
                    "razorpay_order_id", orderId,
                    "razorpay_payment_id", paymentId,
                    "razorpay_signature", signature
            );
            boolean valid = razorpayPaymentGatewayProvider.verifyPaymentSignature(payload);
            if (!valid) {
                txn.setStatus(IdPaymentStatus.FAILED);
                txn.setFailureReason("Invalid signature on payment verification");
                idPaymentTransactionRepository.save(txn);
                log.warn("Payment signature verification FAILED for order {}", orderId);
                return new IdPaymentDtos.VerifyPaymentResponse(false, "Invalid payment signature", IdPaymentStatus.FAILED.name());
            }
        }

        markTransactionSuccess(txn, paymentId, signature);

        return new IdPaymentDtos.VerifyPaymentResponse(true, "Payment verified successfully", IdPaymentStatus.SUCCESS.name());
    }

    @Override
    @Transactional(readOnly = true)
    public IdPaymentDtos.PaymentStatusResponse getPaymentStatus(String identifier) {
        User user = findUser(identifier);
        Optional<IdPaymentTransaction> latestTxn = idPaymentTransactionRepository.findTopByUserIdOrderByCreatedAtDesc(user.getId());

        return new IdPaymentDtos.PaymentStatusResponse(
                user.getId().toString(),
                user.getUsername(),
                user.getMobile(),
                resolvePrimaryRole(user).name(),
                user.getIdPaymentStatus() != null ? user.getIdPaymentStatus().name() : IdPaymentStatus.PENDING.name(),
                user.getIdPaymentPaidAt(),
                latestTxn.map(IdPaymentTransaction::getRazorpayOrderId).orElse(null),
                latestTxn.map(IdPaymentTransaction::getRazorpayPaymentId).orElse(null)
        );
    }

    @Override
    @Transactional
    public void handleWebhook(String rawPayload, Map<String, String> headers) {
        String webhookSecret = appProperties.providers() != null && appProperties.providers().payment() != null
                ? appProperties.providers().payment().webhookSecret() : null;

        boolean isMock = webhookSecret == null || webhookSecret.isBlank() || "mock".equalsIgnoreCase(webhookSecret);

        if (!isMock) {
            String signature = headers.getOrDefault("x-razorpay-signature", headers.getOrDefault("X-Razorpay-Signature", ""));
            if (signature.isBlank()) {
                throw new IllegalArgumentException("Missing webhook signature");
            }
            String computed = PaymentSignatureUtils.hmacSha256Hex(rawPayload, webhookSecret);
            if (!computed.equalsIgnoreCase(signature)) {
                log.warn("Razorpay webhook signature mismatch! Computed: {}, Provided: {}", computed, signature);
                throw new IllegalArgumentException("Invalid Razorpay webhook signature");
            }
        }

        var webhookEvent = razorpayPaymentGatewayProvider.parseWebhookEvent(rawPayload, headers);
        if (!webhookEvent.valid() && !isMock) {
            log.warn("Invalid webhook payload: {}", webhookEvent.message());
            return;
        }

        String orderId = webhookEvent.orderId();
        if (orderId == null || orderId.isBlank()) {
            log.warn("Webhook received with missing order ID");
            return;
        }

        idPaymentTransactionRepository.findByRazorpayOrderId(orderId).ifPresent(txn -> {
            if (webhookEvent.success()) {
                if (txn.getStatus() != IdPaymentStatus.SUCCESS) {
                    markTransactionSuccess(txn, "webhook_" + System.currentTimeMillis(), "webhook_verified");
                    log.info("ID payment order {} marked SUCCESS via webhook", orderId);
                }
            } else {
                if (txn.getStatus() != IdPaymentStatus.SUCCESS) {
                    txn.setStatus(IdPaymentStatus.FAILED);
                    txn.setFailureReason(webhookEvent.message());
                    idPaymentTransactionRepository.save(txn);
                    log.info("ID payment order {} marked FAILED via webhook", orderId);
                }
            }
        });
    }

    @Override
    @Transactional(readOnly = true)
    public List<IdPaymentDtos.PendingPaymentUserView> getPendingUsers() {
        List<User> users = userRepository.findAll();
        List<IdPaymentDtos.PendingPaymentUserView> result = new ArrayList<>();

        for (User user : users) {
            RoleName primaryRole = resolvePrimaryRole(user);
            if (primaryRole == RoleName.ADMIN) continue;

            if (user.getIdPaymentStatus() == IdPaymentStatus.PENDING || user.getIdPaymentStatus() == null) {
                BigDecimal originalAmount = getChargeForRole(primaryRole);
                Optional<IdCoupon> couponOpt = idCouponRepository.findByUserIdAndIsUsedFalseAndValidToAfter(user.getId(), Instant.now());
                BigDecimal discountPercent = couponOpt.map(IdCoupon::getDiscountPercent).orElse(BigDecimal.ZERO);
                BigDecimal discountAmount = calculateDiscount(originalAmount, discountPercent);
                BigDecimal finalAmount = calculateFinalAmount(originalAmount, discountAmount);

                result.add(new IdPaymentDtos.PendingPaymentUserView(
                        user.getId().toString(),
                        user.getFullName(),
                        user.getUsername(),
                        user.getMobile(),
                        user.getEmail(),
                        primaryRole.name(),
                        user.getPartyCode(),
                        user.getCreatedAt(),
                        originalAmount,
                        discountAmount,
                        finalAmount,
                        IdPaymentStatus.PENDING.name(),
                        couponOpt.map(IdCoupon::getCode).orElse(null),
                        couponOpt.map(IdCoupon::getDiscountPercent).orElse(null),
                        couponOpt.map(IdCoupon::getValidTo).orElse(null)
                ));
            }
        }

        result.sort(Comparator.comparing(IdPaymentDtos.PendingPaymentUserView::registrationDate, Comparator.nullsLast(Comparator.reverseOrder())));
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public List<IdPaymentDtos.SuccessPaymentUserView> getSuccessUsers() {
        List<IdPaymentTransaction> txns = idPaymentTransactionRepository.findByStatusOrderByCreatedAtDesc(IdPaymentStatus.SUCCESS);
        List<IdPaymentDtos.SuccessPaymentUserView> result = new ArrayList<>();

        for (IdPaymentTransaction txn : txns) {
            User user = txn.getUser();
            RoleName primaryRole = resolvePrimaryRole(user);
            result.add(new IdPaymentDtos.SuccessPaymentUserView(
                    user.getId().toString(),
                    user.getFullName(),
                    user.getUsername(),
                    user.getMobile(),
                    user.getEmail(),
                    primaryRole.name(),
                    user.getPartyCode(),
                    txn.getAmount(),
                    txn.getDiscountAmount(),
                    txn.getFinalAmount(),
                    txn.getCoupon() != null ? txn.getCoupon().getCode() : null,
                    txn.getRazorpayOrderId(),
                    txn.getRazorpayPaymentId(),
                    txn.getPaidAt() != null ? txn.getPaidAt() : txn.getUpdatedAt(),
                    IdPaymentStatus.SUCCESS.name()
            ));
        }

        return result;
    }

    @Override
    @Transactional
    public IdPaymentDtos.CouponResponse generateCoupon(UUID userId, BigDecimal discountPercent, String adminUsername) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        if (user.getIdPaymentStatus() == IdPaymentStatus.SUCCESS) {
            throw new IllegalArgumentException("User has already completed ID payment; coupon cannot be issued");
        }

        if (discountPercent == null || discountPercent.compareTo(BigDecimal.ONE) < 0 || discountPercent.compareTo(new BigDecimal("100")) > 0) {
            throw new IllegalArgumentException("Discount percentage must be between 1% and 100%");
        }

        String code = generateUniqueCouponCode();

        IdCoupon coupon = new IdCoupon();
        coupon.setUser(user);
        coupon.setCode(code);
        coupon.setDiscountPercent(discountPercent);
        coupon.setValidFrom(Instant.now());
        coupon.setValidTo(Instant.now().plus(24, ChronoUnit.HOURS));
        coupon.setIsUsed(false);
        coupon.setCreatedBy(adminUsername != null && !adminUsername.isBlank() ? adminUsername : "admin");

        IdCoupon saved = idCouponRepository.save(coupon);
        log.info("Admin {} generated {}% coupon {} for user {} ({})", adminUsername, discountPercent, code, user.getUsername(), user.getMobile());

        return new IdPaymentDtos.CouponResponse(
                saved.getId() != null ? saved.getId().toString() : UUID.randomUUID().toString(),
                user.getId().toString(),
                user.getFullName(),
                user.getMobile(),
                saved.getCode(),
                saved.getDiscountPercent(),
                saved.getValidFrom(),
                saved.getValidTo(),
                saved.getIsUsed(),
                saved.getUsedAt(),
                saved.getCreatedBy(),
                saved.getCreatedAt()
        );
    }

    private void markTransactionSuccess(IdPaymentTransaction txn, String paymentId, String signature) {
        txn.setStatus(IdPaymentStatus.SUCCESS);
        txn.setRazorpayPaymentId(paymentId);
        txn.setRazorpaySignature(signature);
        txn.setPaidAt(Instant.now());
        idPaymentTransactionRepository.save(txn);

        if (txn.getCoupon() != null) {
            IdCoupon coupon = txn.getCoupon();
            coupon.setIsUsed(true);
            coupon.setUsedAt(Instant.now());
            idCouponRepository.save(coupon);
        }

        User user = txn.getUser();
        user.setIdPaymentStatus(IdPaymentStatus.SUCCESS);
        user.setIdPaymentPaidAt(Instant.now());
        userRepository.save(user);

        log.info("ID Charge Payment SUCCESS for user {} ({}), paymentId: {}", user.getUsername(), user.getMobile(), paymentId);
    }

    private User findUser(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("User identifier is required");
        }
        String clean = identifier.trim();

        try {
            UUID uid = UUID.fromString(clean);
            return userRepository.findById(uid)
                    .orElseThrow(() -> new IllegalArgumentException("User not found with ID: " + clean));
        } catch (IllegalArgumentException e) {
            return userRepository.findByUsername(clean)
                    .or(() -> userRepository.findByMobile(clean))
                    .or(() -> userRepository.findByEmail(clean))
                    .orElseThrow(() -> new IllegalArgumentException("User not found with identifier: " + clean));
        }
    }

    private RoleName resolvePrimaryRole(User user) {
        if (user.getRoles() == null || user.getRoles().isEmpty()) {
            return RoleName.RETAILER;
        }
        Set<RoleName> roleNames = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        if (roleNames.contains(RoleName.ADMIN)) return RoleName.ADMIN;
        if (roleNames.contains(RoleName.SUPER_DISTRIBUTOR)) return RoleName.SUPER_DISTRIBUTOR;
        if (roleNames.contains(RoleName.DISTRIBUTOR)) return RoleName.DISTRIBUTOR;
        return RoleName.RETAILER;
    }

    @Override
    @Transactional(readOnly = true)
    public IdPaymentDtos.RoleChargesResponse getRoleCharges() {
        List<IdPaymentDtos.RoleChargeItem> list = new ArrayList<>();
        for (RoleName role : List.of(RoleName.RETAILER, RoleName.DISTRIBUTOR, RoleName.SUPER_DISTRIBUTOR)) {
            Optional<IdChargeSetting> settingOpt = idChargeSettingRepository.findById(role);
            BigDecimal amount = settingOpt.map(IdChargeSetting::getAmount).orElseGet(() -> getDefaultStaticCharge(role));
            Instant updatedAt = settingOpt.map(IdChargeSetting::getUpdatedAt).orElse(null);
            String updatedBy = settingOpt.map(IdChargeSetting::getUpdatedBy).orElse("SYSTEM");

            String displayName = switch (role) {
                case SUPER_DISTRIBUTOR -> "Super Distributor";
                case DISTRIBUTOR -> "Distributor";
                default -> "Retailer";
            };

            list.add(new IdPaymentDtos.RoleChargeItem(role.name(), displayName, amount, updatedAt, updatedBy));
        }
        return new IdPaymentDtos.RoleChargesResponse(true, list);
    }

    @Override
    @Transactional
    public IdPaymentDtos.RoleChargesResponse updateRoleCharges(IdPaymentDtos.UpdateRoleChargesRequest request, String adminUsername) {
        if (request == null || request.retailerCharge() == null || request.retailerCharge().compareTo(BigDecimal.ONE) < 0 ||
                request.distributorCharge() == null || request.distributorCharge().compareTo(BigDecimal.ONE) < 0 ||
                request.superDistributorCharge() == null || request.superDistributorCharge().compareTo(BigDecimal.ONE) < 0) {
            throw new IllegalArgumentException("Charges must be at least ₹1.00 for all roles");
        }

        Instant now = Instant.now();
        String by = adminUsername != null && !adminUsername.isBlank() ? adminUsername : "admin";

        saveOrUpdateCharge(RoleName.RETAILER, request.retailerCharge(), now, by);
        saveOrUpdateCharge(RoleName.DISTRIBUTOR, request.distributorCharge(), now, by);
        saveOrUpdateCharge(RoleName.SUPER_DISTRIBUTOR, request.superDistributorCharge(), now, by);

        log.info("Admin {} updated ID Charges: RETAILER={}, DISTRIBUTOR={}, SUPER_DISTRIBUTOR={}",
                by, request.retailerCharge(), request.distributorCharge(), request.superDistributorCharge());

        return getRoleCharges();
    }

    private void saveOrUpdateCharge(RoleName role, BigDecimal amount, Instant now, String by) {
        IdChargeSetting setting = idChargeSettingRepository.findById(role)
                .orElseGet(() -> IdChargeSetting.builder().roleName(role).build());
        setting.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
        setting.setUpdatedAt(now);
        setting.setUpdatedBy(by);
        idChargeSettingRepository.save(setting);
    }

    private BigDecimal getChargeForRole(RoleName role) {
        return idChargeSettingRepository.findById(role)
                .map(IdChargeSetting::getAmount)
                .filter(a -> a.compareTo(BigDecimal.ZERO) > 0)
                .orElseGet(() -> getDefaultStaticCharge(role));
    }

    private BigDecimal getDefaultStaticCharge(RoleName role) {
        return switch (role) {
            case SUPER_DISTRIBUTOR -> SUPER_DISTRIBUTOR_CHARGE;
            case DISTRIBUTOR -> DISTRIBUTOR_CHARGE;
            default -> RETAILER_CHARGE;
        };
    }


    private BigDecimal calculateDiscount(BigDecimal originalAmount, BigDecimal discountPercent) {
        if (discountPercent == null || discountPercent.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return originalAmount.multiply(discountPercent)
                .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateFinalAmount(BigDecimal originalAmount, BigDecimal discountAmount) {
        BigDecimal finalAmount = originalAmount.subtract(discountAmount);
        return finalAmount.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : finalAmount.setScale(2, RoundingMode.HALF_UP);
    }

    private String getEffectiveRazorpayKeyId() {
        if (appProperties.providers() != null && appProperties.providers().payment() != null
                && appProperties.providers().payment().keyId() != null
                && !appProperties.providers().payment().keyId().isBlank()) {
            return appProperties.providers().payment().keyId();
        }
        return "rzp_test_rupiksha";
    }

    private String generateUniqueCouponCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        String code;
        int attempts = 0;
        do {
            StringBuilder sb = new StringBuilder("RUP");
            for (int i = 0; i < 6; i++) {
                sb.append(chars.charAt(secureRandom.nextInt(chars.length())));
            }
            code = sb.toString();
            attempts++;
        } while (idCouponRepository.existsByCode(code) && attempts < 50);
        return code;
    }
}
