package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.IdPaymentDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.integration.payment.RazorpayPaymentGatewayProvider;
import com.rupiksha.backend.repository.IdCouponRepository;
import com.rupiksha.backend.repository.IdPaymentTransactionRepository;
import com.rupiksha.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IdPaymentServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private IdCouponRepository idCouponRepository;

    @Mock
    private IdPaymentTransactionRepository idPaymentTransactionRepository;

    @Mock
    private com.rupiksha.backend.repository.IdChargeSettingRepository idChargeSettingRepository;

    @Mock
    private RazorpayPaymentGatewayProvider razorpayPaymentGatewayProvider;

    @Mock
    private AppProperties appProperties;

    @InjectMocks
    private IdPaymentServiceImpl idPaymentService;

    private User retailerUser;
    private User distributorUser;
    private User superDistributorUser;
    private Role retailerRole;
    private Role distributorRole;
    private Role superDistributorRole;
    private IdCoupon validCoupon;

    @BeforeEach
    void setUp() {
        retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);

        distributorRole = new Role();
        distributorRole.setName(RoleName.DISTRIBUTOR);

        superDistributorRole = new Role();
        superDistributorRole.setName(RoleName.SUPER_DISTRIBUTOR);

        retailerUser = new User();
        retailerUser.setId(UUID.randomUUID());
        retailerUser.setUsername("testretailer");
        retailerUser.setMobile("9876543210");
        retailerUser.setFullName("Test Retailer");
        retailerUser.setEmail("retailer@rupiksha.com");
        retailerUser.setRoles(new HashSet<>(Set.of(retailerRole)));
        retailerUser.setIdPaymentStatus(IdPaymentStatus.PENDING);

        distributorUser = new User();
        distributorUser.setId(UUID.randomUUID());
        distributorUser.setUsername("testdistributor");
        distributorUser.setMobile("9876543211");
        distributorUser.setFullName("Test Distributor");
        distributorUser.setRoles(new HashSet<>(Set.of(distributorRole)));
        distributorUser.setIdPaymentStatus(IdPaymentStatus.PENDING);

        superDistributorUser = new User();
        superDistributorUser.setId(UUID.randomUUID());
        superDistributorUser.setUsername("testsd");
        superDistributorUser.setMobile("9876543212");
        superDistributorUser.setFullName("Test Super Distributor");
        superDistributorUser.setRoles(new HashSet<>(Set.of(superDistributorRole)));
        superDistributorUser.setIdPaymentStatus(IdPaymentStatus.PENDING);

        validCoupon = new IdCoupon();
        validCoupon.setId(UUID.randomUUID());
        validCoupon.setUser(retailerUser);
        validCoupon.setCode("RUPDISC20");
        validCoupon.setDiscountPercent(new BigDecimal("20.00"));
        validCoupon.setValidFrom(Instant.now().minus(1, ChronoUnit.HOURS));
        validCoupon.setValidTo(Instant.now().plus(23, ChronoUnit.HOURS));
        validCoupon.setIsUsed(false);
        validCoupon.setCreatedBy("admin");

        lenient().when(idPaymentTransactionRepository.save(any(IdPaymentTransaction.class)))
                .thenAnswer(inv -> {
                    IdPaymentTransaction t = inv.getArgument(0);
                    if (t.getId() == null) t.setId(UUID.randomUUID());
                    return t;
                });
        lenient().when(idCouponRepository.save(any(IdCoupon.class)))
                .thenAnswer(inv -> {
                    IdCoupon c = inv.getArgument(0);
                    if (c.getId() == null) c.setId(UUID.randomUUID());
                    return c;
                });
        lenient().when(userRepository.save(any(User.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("getPaymentDetails: Calculates standard 2999 amount for Retailer without coupon")
    void testGetPaymentDetails_RetailerNoCoupon() {
        when(userRepository.findByMobile("9876543210")).thenReturn(Optional.of(retailerUser));
        when(idCouponRepository.findByUserIdAndIsUsedFalseAndValidToAfter(eq(retailerUser.getId()), any(Instant.class)))
                .thenReturn(Optional.empty());

        IdPaymentDtos.PaymentDetailsResponse res = idPaymentService.getPaymentDetails("9876543210");

        assertNotNull(res);
        assertEquals(new BigDecimal("2999.00"), res.originalAmount());
        assertEquals(new BigDecimal("0.00"), res.discountAmount());
        assertEquals(new BigDecimal("2999.00"), res.finalAmount());
        assertEquals("PENDING", res.paymentStatus());
    }

    @Test
    @DisplayName("getPaymentDetails: Calculates 5999 for Distributor and 9999 for Super Distributor")
    void testGetPaymentDetails_DistributorAndSuperDistributor() {
        when(userRepository.findByMobile("9876543211")).thenReturn(Optional.of(distributorUser));
        when(userRepository.findByMobile("9876543212")).thenReturn(Optional.of(superDistributorUser));

        IdPaymentDtos.PaymentDetailsResponse distRes = idPaymentService.getPaymentDetails("9876543211");
        assertEquals(new BigDecimal("5999.00"), distRes.originalAmount());
        assertEquals(new BigDecimal("5999.00"), distRes.finalAmount());

        IdPaymentDtos.PaymentDetailsResponse sdRes = idPaymentService.getPaymentDetails("9876543212");
        assertEquals(new BigDecimal("9999.00"), sdRes.originalAmount());
        assertEquals(new BigDecimal("9999.00"), sdRes.finalAmount());
    }

    @Test
    @DisplayName("applyCoupon: Valid 20% coupon calculates correct discount")
    void testApplyCoupon_Valid() {
        when(userRepository.findByMobile("9876543210")).thenReturn(Optional.of(retailerUser));
        when(idCouponRepository.findByCode("RUPDISC20")).thenReturn(Optional.of(validCoupon));

        IdPaymentDtos.ApplyCouponResponse res = idPaymentService.applyCoupon("9876543210", "RUPDISC20");

        assertTrue(res.valid());
        assertEquals(new BigDecimal("20.00"), res.discountPercent());
        assertEquals(new BigDecimal("2999.00"), res.originalAmount());
        // 2999 * 0.20 = 599.80
        assertEquals(new BigDecimal("599.80"), res.discountAmount());
        // 2999 - 599.80 = 2399.20
        assertEquals(new BigDecimal("2399.20"), res.finalAmount());
    }

    @Test
    @DisplayName("applyCoupon: Expired coupon is rejected")
    void testApplyCoupon_Expired() {
        validCoupon.setValidTo(Instant.now().minus(2, ChronoUnit.HOURS));
        when(userRepository.findByMobile("9876543210")).thenReturn(Optional.of(retailerUser));
        when(idCouponRepository.findByCode("RUPDISC20")).thenReturn(Optional.of(validCoupon));

        IdPaymentDtos.ApplyCouponResponse res = idPaymentService.applyCoupon("9876543210", "RUPDISC20");

        assertFalse(res.valid());
        assertEquals("This coupon has expired", res.message());
        assertEquals(new BigDecimal("2999.00"), res.finalAmount());
    }

    @Test
    @DisplayName("applyCoupon: Already used coupon is rejected")
    void testApplyCoupon_AlreadyUsed() {
        validCoupon.setIsUsed(true);
        when(userRepository.findByMobile("9876543210")).thenReturn(Optional.of(retailerUser));
        when(idCouponRepository.findByCode("RUPDISC20")).thenReturn(Optional.of(validCoupon));

        IdPaymentDtos.ApplyCouponResponse res = idPaymentService.applyCoupon("9876543210", "RUPDISC20");

        assertFalse(res.valid());
        assertEquals("This coupon has already been used", res.message());
    }

    @Test
    @DisplayName("applyCoupon: Wrong user coupon is rejected")
    void testApplyCoupon_WrongUser() {
        when(userRepository.findByMobile("9876543211")).thenReturn(Optional.of(distributorUser));
        when(idCouponRepository.findByCode("RUPDISC20")).thenReturn(Optional.of(validCoupon));

        IdPaymentDtos.ApplyCouponResponse res = idPaymentService.applyCoupon("9876543211", "RUPDISC20");

        assertFalse(res.valid());
        assertEquals("This coupon is not assigned to your account", res.message());
    }

    @Test
    @DisplayName("createOrder: Creates transaction and returns order ID")
    void testCreateOrder_Success() {
        when(userRepository.findByMobile("9876543210")).thenReturn(Optional.of(retailerUser));
        when(idPaymentTransactionRepository.findTopByUserIdAndStatusOrderByCreatedAtDesc(eq(retailerUser.getId()), eq(IdPaymentStatus.PENDING)))
                .thenReturn(Optional.empty());

        IdPaymentDtos.CreateIdOrderResponse res = idPaymentService.createOrder("9876543210", null);

        assertNotNull(res);
        assertNotNull(res.orderId());
        assertEquals(new BigDecimal("2999.00"), res.amount());
        assertEquals(new BigDecimal("2999.00"), res.finalAmount());
        assertEquals("PENDING", res.status());
        verify(idPaymentTransactionRepository, times(1)).save(any(IdPaymentTransaction.class));
    }

    @Test
    @DisplayName("createOrder: Fails if user ID payment is already SUCCESS")
    void testCreateOrder_AlreadySuccess() {
        retailerUser.setIdPaymentStatus(IdPaymentStatus.SUCCESS);
        when(userRepository.findByMobile("9876543210")).thenReturn(Optional.of(retailerUser));

        assertThrows(IllegalArgumentException.class, () -> idPaymentService.createOrder("9876543210", null));
    }

    @Test
    @DisplayName("verifyPayment: Marks transaction and User SUCCESS and consumes coupon")
    void testVerifyPayment_Success() {
        IdPaymentTransaction txn = new IdPaymentTransaction();
        txn.setId(UUID.randomUUID());
        txn.setUser(retailerUser);
        txn.setRazorpayOrderId("order_test_123");
        txn.setAmount(new BigDecimal("2999.00"));
        txn.setFinalAmount(new BigDecimal("2399.20"));
        txn.setStatus(IdPaymentStatus.PENDING);
        txn.setCoupon(validCoupon);

        when(idPaymentTransactionRepository.findByRazorpayOrderId("order_test_123")).thenReturn(Optional.of(txn));

        IdPaymentDtos.VerifyPaymentRequest req = new IdPaymentDtos.VerifyPaymentRequest(
                "order_test_123", "pay_test_999", "sig_test_abc"
        );

        IdPaymentDtos.VerifyPaymentResponse res = idPaymentService.verifyPayment(req);

        assertTrue(res.success());
        assertEquals("SUCCESS", res.paymentStatus());
        assertEquals(IdPaymentStatus.SUCCESS, txn.getStatus());
        assertEquals("pay_test_999", txn.getRazorpayPaymentId());
        assertNotNull(txn.getPaidAt());
        assertTrue(validCoupon.getIsUsed());
        assertEquals(IdPaymentStatus.SUCCESS, retailerUser.getIdPaymentStatus());
        assertNotNull(retailerUser.getIdPaymentPaidAt());
    }

    @Test
    @DisplayName("Admin generateCoupon: Successfully creates 24h single-use coupon for pending user")
    void testGenerateCoupon_Success() {
        UUID userId = retailerUser.getId();
        when(userRepository.findById(userId)).thenReturn(Optional.of(retailerUser));
        when(idCouponRepository.existsByCode(anyString())).thenReturn(false);

        IdPaymentDtos.CouponResponse res = idPaymentService.generateCoupon(userId, new BigDecimal("30.00"), "admin_super");

        assertNotNull(res);
        assertNotNull(res.code());
        assertTrue(res.code().startsWith("RUP"));
        assertEquals(new BigDecimal("30.00"), res.discountPercent());
        assertEquals("admin_super", res.createdBy());
        assertFalse(res.isUsed());
        assertNotNull(res.validTo());
        verify(idCouponRepository, times(1)).save(any(IdCoupon.class));
    }

    @Test
    @DisplayName("Admin generateCoupon: Fails for invalid discount percentage")
    void testGenerateCoupon_InvalidPercent() {
        UUID userId = retailerUser.getId();
        when(userRepository.findById(userId)).thenReturn(Optional.of(retailerUser));

        assertThrows(IllegalArgumentException.class, () ->
                idPaymentService.generateCoupon(userId, new BigDecimal("0.00"), "admin")
        );
        assertThrows(IllegalArgumentException.class, () ->
                idPaymentService.generateCoupon(userId, new BigDecimal("150.00"), "admin")
        );
    }

    @Test
    @DisplayName("Admin getRoleCharges: Returns configured or default charges for all 3 roles")
    void testGetRoleCharges_ReturnsAllRoles() {
        when(idChargeSettingRepository.findById(RoleName.RETAILER)).thenReturn(Optional.of(
                IdChargeSetting.builder().roleName(RoleName.RETAILER).amount(new BigDecimal("1999.00")).build()
        ));
        when(idChargeSettingRepository.findById(RoleName.DISTRIBUTOR)).thenReturn(Optional.empty());
        when(idChargeSettingRepository.findById(RoleName.SUPER_DISTRIBUTOR)).thenReturn(Optional.empty());

        IdPaymentDtos.RoleChargesResponse res = idPaymentService.getRoleCharges();

        assertNotNull(res);
        assertTrue(res.success());
        assertEquals(3, res.charges().size());

        IdPaymentDtos.RoleChargeItem retailer = res.charges().stream().filter(c -> c.role().equals("RETAILER")).findFirst().orElseThrow();
        assertEquals(new BigDecimal("1999.00"), retailer.amount());

        IdPaymentDtos.RoleChargeItem distributor = res.charges().stream().filter(c -> c.role().equals("DISTRIBUTOR")).findFirst().orElseThrow();
        assertEquals(new BigDecimal("5999.00"), distributor.amount()); // default fallback
    }

    @Test
    @DisplayName("Admin updateRoleCharges: Successfully updates charges for all roles")
    void testUpdateRoleCharges_Success() {
        when(idChargeSettingRepository.findById(any())).thenReturn(Optional.empty());

        IdPaymentDtos.UpdateRoleChargesRequest req = new IdPaymentDtos.UpdateRoleChargesRequest(
                new BigDecimal("1499.00"),
                new BigDecimal("3499.00"),
                new BigDecimal("7499.00")
        );

        IdPaymentDtos.RoleChargesResponse res = idPaymentService.updateRoleCharges(req, "admin_user");

        assertNotNull(res);
        assertTrue(res.success());
        verify(idChargeSettingRepository, times(3)).save(any(IdChargeSetting.class));
    }
}

