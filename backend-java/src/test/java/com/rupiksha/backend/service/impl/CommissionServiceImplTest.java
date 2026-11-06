package com.rupiksha.backend.service.impl;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.backend.api.dto.CommissionDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.service.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class CommissionServiceImplTest {

    @Mock
    private CommissionPlanRepository commissionPlanRepository;

    @Mock
    private CommissionSlabRepository commissionSlabRepository;

    @Mock
    private CommissionTransactionRepository commissionTransactionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WalletService walletService;

    @Mock
    private com.rupiksha.backend.repository.BbpsTransactionRepository bbpsTransactionRepository;

    @Mock
    private AepsMiniStatementCommissionConfigRepository aepsMiniStatementCommissionConfigRepository;

    @Mock
    private AepsMiniStatementCommissionConfigAuditRepository aepsMiniStatementCommissionConfigAuditRepository;

    @Mock
    private com.rupiksha.aeps.repository.AepsTransactionEngineRepository aepsTransactionEngineRepository;

    @Mock
    private BbpsCommissionConfigRepository bbpsCommissionConfigRepository;

    @Mock
    private BbpsCommissionConfigAuditRepository bbpsCommissionConfigAuditRepository;

    @Mock
    private RechargeCommissionConfigRepository rechargeCommissionConfigRepository;

    @Mock
    private RechargeCommissionConfigAuditRepository rechargeCommissionConfigAuditRepository;

    @Mock
    private RechargeRepository rechargeRepository;

    @InjectMocks
    private CommissionServiceImpl commissionService;

    private User retailer;
    private User distributor;
    private User superDistributor;
    private CommissionPlan freePlan;
    private List<CommissionSlab> defaultSlabs;

    @BeforeEach
    void setUp() {
        // Super Distributor
        superDistributor = new User();
        superDistributor.setId(UUID.randomUUID());
        superDistributor.setUsername("SD001");
        superDistributor.setFullName("Super Dist 1");
        Role sdRole = new Role();
        sdRole.setName(RoleName.SUPER_DISTRIBUTOR);
        superDistributor.setRoles(Set.of(sdRole));

        // Distributor
        distributor = new User();
        distributor.setId(UUID.randomUUID());
        distributor.setUsername("D001");
        distributor.setFullName("Distributor 1");
        distributor.setParentUser(superDistributor);
        Role dRole = new Role();
        dRole.setName(RoleName.DISTRIBUTOR);
        distributor.setRoles(Set.of(dRole));

        // Retailer
        retailer = new User();
        retailer.setId(UUID.randomUUID());
        retailer.setUsername("R001");
        retailer.setFullName("Retailer 1");
        retailer.setParentUser(distributor);
        Role rRole = new Role();
        rRole.setName(RoleName.RETAILER);
        retailer.setRoles(Set.of(rRole));

        // Free Plan
        freePlan = CommissionPlan.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1")
                .planName("Free")
                .planCode("FREE")
                .price(BigDecimal.ZERO)
                .isDefault(true)
                .enabled(true)
                .slabs(new ArrayList<>())
                .build();

        // Slabs
        CommissionSlab slab1 = CommissionSlab.builder()
                .id(UUID.randomUUID())
                .commissionPlan(freePlan)
                .minAmount(new BigDecimal("500.00"))
                .maxAmount(new BigDecimal("999.00"))
                .retailerCommission(new BigDecimal("1.00"))
                .distributorCommission(new BigDecimal("0.00"))
                .superDistributorCommission(new BigDecimal("0.00"))
                .enabled(true)
                .build();

        CommissionSlab slab2 = CommissionSlab.builder()
                .id(UUID.randomUUID())
                .commissionPlan(freePlan)
                .minAmount(new BigDecimal("1000.00"))
                .maxAmount(new BigDecimal("1499.00"))
                .retailerCommission(new BigDecimal("2.00"))
                .distributorCommission(new BigDecimal("0.50"))
                .superDistributorCommission(new BigDecimal("0.50"))
                .enabled(true)
                .build();

        CommissionSlab slab3 = CommissionSlab.builder()
                .id(UUID.randomUUID())
                .commissionPlan(freePlan)
                .minAmount(new BigDecimal("8000.00"))
                .maxAmount(new BigDecimal("10000.00"))
                .retailerCommission(new BigDecimal("9.00"))
                .distributorCommission(new BigDecimal("2.00"))
                .superDistributorCommission(new BigDecimal("2.00"))
                .enabled(true)
                .build();

        defaultSlabs = List.of(slab1, slab2, slab3);
        freePlan.getSlabs().addAll(defaultSlabs);
    }

    @Test
    @DisplayName("CASE 1: Direct Retailer (No Distributor) - Only Retailer gets Commission")
    void testDirectRetailerTransaction() {
        retailer.setParentUser(null); // Direct retailer

        AepsTransactionEngine txn = AepsTransactionEngine.builder()
                .transactionId("TXN_DIRECT_001")
                .serviceType("CASH_WITHDRAWAL")
                .userId(retailer.getId())
                .amount(new BigDecimal("700.00"))
                .status("SUCCESS")
                .ipAddress("127.0.0.1")
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("TXN_DIRECT_001")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")).thenReturn(Optional.of(freePlan));
        when(commissionSlabRepository.findMatchingSlabs(freePlan.getId(), new BigDecimal("700.00"))).thenReturn(List.of(defaultSlabs.get(0)));

        commissionService.processAepsCommission(txn);

        // Verify Retailer wallet credited ₹1.00
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()),
                eq(new BigDecimal("1.00")),
                contains("AEPS 1 Commission"),
                eq(WalletTransactionContext.COMMISSION),
                eq("AEPS 1"),
                anyString(),
                contains("TXN_DIRECT_001-RETAILER")
        );

        // Verify Distributor and SuperDistributor were NOT credited
        verify(walletService, never()).creditForService(
                eq(distributor.getId()), any(), any(), any(), any(), any(), any()
        );
        verify(walletService, never()).creditForService(
                eq(superDistributor.getId()), any(), any(), any(), any(), any(), any()
        );

        // Verify only 1 commission transaction saved
        verify(commissionTransactionRepository, times(1)).save(any(CommissionTransaction.class));
    }

    @Test
    @DisplayName("CASE 2: Full Hierarchy - Retailer -> Distributor -> SuperDistributor")
    void testFullHierarchyTransaction() {
        AepsTransactionEngine txn = AepsTransactionEngine.builder()
                .transactionId("TXN_HIERARCHY_002")
                .serviceType("CASH_WITHDRAWAL")
                .userId(retailer.getId())
                .amount(new BigDecimal("1200.00"))
                .status("SUCCESS")
                .ipAddress("127.0.0.1")
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("TXN_HIERARCHY_002")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")).thenReturn(Optional.of(freePlan));
        when(commissionSlabRepository.findMatchingSlabs(freePlan.getId(), new BigDecimal("1200.00"))).thenReturn(List.of(defaultSlabs.get(1)));

        commissionService.processAepsCommission(txn);

        // Retailer: +₹2.00
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()),
                eq(new BigDecimal("2.00")),
                contains("AEPS 1 Commission"),
                eq(WalletTransactionContext.COMMISSION),
                eq("AEPS 1"),
                anyString(),
                contains("TXN_HIERARCHY_002-RETAILER")
        );

        // Distributor: +₹0.50
        verify(walletService, times(1)).creditForService(
                eq(distributor.getId()),
                eq(new BigDecimal("0.50")),
                contains("AEPS 1 Commission (Distributor)"),
                eq(WalletTransactionContext.COMMISSION),
                eq("AEPS 1"),
                anyString(),
                contains("TXN_HIERARCHY_002-DISTRIBUTOR")
        );

        // Super Distributor: +₹0.50
        verify(walletService, times(1)).creditForService(
                eq(superDistributor.getId()),
                eq(new BigDecimal("0.50")),
                contains("AEPS 1 Commission (Super Distributor)"),
                eq(WalletTransactionContext.COMMISSION),
                eq("AEPS 1"),
                anyString(),
                contains("TXN_HIERARCHY_002-SUPER_DISTRIBUTOR")
        );

        // 3 ledger entries saved
        verify(commissionTransactionRepository, times(3)).save(any(CommissionTransaction.class));
    }

    @Test
    @DisplayName("CASE 7 & 8: Non-Successful Transactions (FAILED, PENDING) - Zero Commission")
    void testFailedOrPendingProducesZeroCommission() {
        AepsTransactionEngine failedTxn = AepsTransactionEngine.builder()
                .transactionId("TXN_FAIL_001")
                .serviceType("CASH_WITHDRAWAL")
                .userId(retailer.getId())
                .amount(new BigDecimal("700.00"))
                .status("FAILED")
                .build();

        commissionService.processAepsCommission(failedTxn);

        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
        verify(commissionTransactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("CASE 9: Idempotency Protection - Duplicate Callback Ignored")
    void testDuplicateCallbackProtection() {
        AepsTransactionEngine txn = AepsTransactionEngine.builder()
                .transactionId("TXN_DUP_001")
                .serviceType("CASH_WITHDRAWAL")
                .userId(retailer.getId())
                .amount(new BigDecimal("700.00"))
                .status("SUCCESS")
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("TXN_DUP_001")).thenReturn(true);

        commissionService.processAepsCommission(txn);

        // Should return early and perform no credits or saves
        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
        verify(commissionTransactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("CASE 11 & 12: Admin Validation - Reject Negative and Overlapping Slabs")
    void testAdminSlabValidationRules() {
        UUID adminId = UUID.randomUUID();
        User admin = new User();
        admin.setId(adminId);
        Role aRole = new Role();
        aRole.setName(RoleName.ADMIN);
        admin.setRoles(Set.of(aRole));

        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(commissionPlanRepository.findByIdWithSlabs(freePlan.getId())).thenReturn(Optional.of(freePlan));

        // Negative Commission
        CommissionDtos.CommissionSlabDto negativeSlab = new CommissionDtos.CommissionSlabDto(
                null, new BigDecimal("500"), new BigDecimal("999"), new BigDecimal("-1.00"), BigDecimal.ZERO, BigDecimal.ZERO, null, true
        );
        CommissionDtos.UpdateSlabsRequest negReq = new CommissionDtos.UpdateSlabsRequest(List.of(negativeSlab));
        assertThrows(IllegalArgumentException.class, () -> commissionService.updatePlanSlabs(freePlan.getId(), negReq, adminId, "127.0.0.1"));

        // Min > Max
        CommissionDtos.CommissionSlabDto invertedSlab = new CommissionDtos.CommissionSlabDto(
                null, new BigDecimal("1000"), new BigDecimal("500"), new BigDecimal("1.00"), BigDecimal.ZERO, BigDecimal.ZERO, null, true
        );
        CommissionDtos.UpdateSlabsRequest invReq = new CommissionDtos.UpdateSlabsRequest(List.of(invertedSlab));
        assertThrows(IllegalArgumentException.class, () -> commissionService.updatePlanSlabs(freePlan.getId(), invReq, adminId, "127.0.0.1"));

        // Overlapping slabs
        CommissionDtos.CommissionSlabDto slabA = new CommissionDtos.CommissionSlabDto(
                null, new BigDecimal("500"), new BigDecimal("999"), new BigDecimal("1.00"), BigDecimal.ZERO, BigDecimal.ZERO, null, true
        );
        CommissionDtos.CommissionSlabDto slabB = new CommissionDtos.CommissionSlabDto(
                null, new BigDecimal("900"), new BigDecimal("1499"), new BigDecimal("2.00"), BigDecimal.ZERO, BigDecimal.ZERO, null, true
        );
        CommissionDtos.UpdateSlabsRequest overlapReq = new CommissionDtos.UpdateSlabsRequest(List.of(slabA, slabB));
        assertThrows(IllegalArgumentException.class, () -> commissionService.updatePlanSlabs(freePlan.getId(), overlapReq, adminId, "127.0.0.1"));
    }

    @Test
    @DisplayName("CASE 12B: Admin Updates Slabs In-Place and Preserves Existing Slab IDs")
    void testAdminUpdatePlanSlabsInPlace() {
        UUID adminId = UUID.randomUUID();
        User admin = new User();
        admin.setId(adminId);
        Role aRole = new Role();
        aRole.setName(RoleName.ADMIN);
        admin.setRoles(Set.of(aRole));

        CommissionSlab existingSlab = CommissionSlab.builder()
                .id(UUID.randomUUID())
                .commissionPlan(freePlan)
                .minAmount(new BigDecimal("500.00"))
                .maxAmount(new BigDecimal("999.00"))
                .retailerCommission(new BigDecimal("1.00"))
                .distributorCommission(BigDecimal.ZERO)
                .superDistributorCommission(BigDecimal.ZERO)
                .enabled(true)
                .build();
        freePlan.setSlabs(new ArrayList<>(List.of(existingSlab)));

        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(commissionPlanRepository.findByIdWithSlabs(freePlan.getId())).thenReturn(Optional.of(freePlan));
        when(commissionPlanRepository.save(any(CommissionPlan.class))).thenAnswer(i -> i.getArgument(0));

        // Update existing slab amounts and add a new slab
        CommissionDtos.CommissionSlabDto updatedExisting = new CommissionDtos.CommissionSlabDto(
                existingSlab.getId(), new BigDecimal("500.00"), new BigDecimal("999.00"), new BigDecimal("2.50"), new BigDecimal("0.50"), new BigDecimal("0.50"), null, true
        );
        CommissionDtos.CommissionSlabDto newSlabDto = new CommissionDtos.CommissionSlabDto(
                null, new BigDecimal("1000.00"), new BigDecimal("1499.00"), new BigDecimal("3.00"), new BigDecimal("1.00"), new BigDecimal("1.00"), null, true
        );

        CommissionDtos.UpdateSlabsRequest updateReq = new CommissionDtos.UpdateSlabsRequest(List.of(updatedExisting, newSlabDto));
        CommissionDtos.CommissionPlanDto result = commissionService.updatePlanSlabs(freePlan.getId(), updateReq, adminId, "127.0.0.1");

        assertNotNull(result);
        assertEquals(2, freePlan.getSlabs().size());
        assertEquals(existingSlab.getId(), freePlan.getSlabs().get(0).getId());
        assertEquals(new BigDecimal("2.50"), freePlan.getSlabs().get(0).getRetailerCommission());
        assertEquals(new BigDecimal("0.50"), freePlan.getSlabs().get(0).getDistributorCommission());
        assertNull(freePlan.getSlabs().get(1).getId()); // New slab to be persisted
        assertEquals(new BigDecimal("3.00"), freePlan.getSlabs().get(1).getRetailerCommission());
    }

    @Test
    @DisplayName("CASE 13: Upgrade Plan - Paid Plan Debits Wallet and Updates User Plan")
    void testUpgradeRetailerPlanPaid() {
        UUID planId = UUID.randomUUID();
        CommissionPlan paidPlan = CommissionPlan.builder()
                .id(planId)
                .serviceType("AEPS_1")
                .planName("Rupiksha Anand Plan")
                .planCode("PLAN_2999")
                .price(new BigDecimal("2999.00"))
                .enabled(true)
                .slabs(new ArrayList<>(defaultSlabs))
                .build();

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(commissionPlanRepository.findByIdWithSlabs(planId)).thenReturn(Optional.of(paidPlan));

        CommissionDtos.CommissionPlanDto result = commissionService.upgradeRetailerPlan(retailer.getId(), planId, "127.0.0.1");

        assertNotNull(result);
        assertEquals("PLAN_2999", result.planCode());
        assertEquals(new BigDecimal("2999.00"), result.price());
        assertNotNull(result.planExpiresAt());
        assertNotNull(result.daysRemaining());

        // Verify wallet debited ₹2999.00
        verify(walletService, times(1)).debitForService(
                eq(retailer.getId()),
                eq(new BigDecimal("2999.00")),
                contains("Commission Plan Upgrade"),
                eq(WalletTransactionContext.PLAN_UPGRADE),
                eq("PLAN_UPGRADE"),
                eq("127.0.0.1"),
                anyString()
        );

        // Verify retailer user was saved with new plan and expiry
        assertEquals(paidPlan, retailer.getAepsCommissionPlan());
        assertNotNull(retailer.getAepsCommissionPlanExpiresAt());
        verify(userRepository, times(1)).save(retailer);
    }

    @Test
    @DisplayName("CASE 14: Upgrade Plan - Already on Same Plan Returns Early Without Debit")
    void testUpgradeRetailerPlanSamePlanNoDebit() {
        retailer.setAepsCommissionPlan(freePlan);

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(commissionPlanRepository.findByIdWithSlabs(freePlan.getId())).thenReturn(Optional.of(freePlan));

        CommissionDtos.CommissionPlanDto result = commissionService.upgradeRetailerPlan(retailer.getId(), freePlan.getId(), "127.0.0.1");

        assertNotNull(result);
        assertEquals("FREE", result.planCode());
        verify(walletService, never()).debitForService(any(), any(), any(), any(), any(), any(), any());
        verify(userRepository, never()).save(retailer);
    }

    @Test
    @DisplayName("CASE 15: Upgrade Plan Difference - Upgrading ₹2999 to ₹4999 debits only difference ₹2000 & keeps expiry")
    void testUpgradePlanDifferenceDebitAndPreservesExpiry() {
        UUID plan2999Id = UUID.randomUUID();
        CommissionPlan plan2999 = CommissionPlan.builder()
                .id(plan2999Id)
                .serviceType("AEPS_1")
                .planName("Rupiksha Anand Plan")
                .planCode("PLAN_2999")
                .price(new BigDecimal("2999.00"))
                .enabled(true)
                .slabs(new ArrayList<>(defaultSlabs))
                .build();

        UUID plan4999Id = UUID.randomUUID();
        CommissionPlan plan4999 = CommissionPlan.builder()
                .id(plan4999Id)
                .serviceType("AEPS_1")
                .planName("Rupiksha Nidhi Plan")
                .planCode("PLAN_4999")
                .price(new BigDecimal("4999.00"))
                .enabled(true)
                .slabs(new ArrayList<>(defaultSlabs))
                .build();

        Instant existingExpiry = java.time.Instant.now().plus(60, java.time.temporal.ChronoUnit.DAYS);
        Instant existingActivated = java.time.Instant.now().minus(305, java.time.temporal.ChronoUnit.DAYS);
        retailer.setAepsCommissionPlan(plan2999);
        retailer.setAepsCommissionPlanActivatedAt(existingActivated);
        retailer.setAepsCommissionPlanExpiresAt(existingExpiry);

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(commissionPlanRepository.findByIdWithSlabs(plan4999Id)).thenReturn(Optional.of(plan4999));

        CommissionDtos.CommissionPlanDto result = commissionService.upgradeRetailerPlan(retailer.getId(), plan4999Id, "127.0.0.1");

        assertNotNull(result);
        assertEquals("PLAN_4999", result.planCode());
        // Verify difference + 500 extra: ₹2500 (4999 - 2999 + 500) is debited
        verify(walletService, times(1)).debitForService(
                eq(retailer.getId()),
                eq(new BigDecimal("2500.00")),
                contains("Upgrade Difference"),
                eq(WalletTransactionContext.PLAN_UPGRADE),
                eq("PLAN_UPGRADE"),
                eq("127.0.0.1"),
                anyString()
        );
        // Verify expiry is preserved
        assertEquals(existingExpiry, retailer.getAepsCommissionPlanExpiresAt());
        assertEquals(plan4999, retailer.getAepsCommissionPlan());
    }

    @Test
    @DisplayName("CASE 16: Downgrade Prevention - Cannot downgrade from active ₹2999 plan to Free plan")
    void testDowngradeRejectedWhileActive() {
        UUID plan2999Id = UUID.randomUUID();
        CommissionPlan plan2999 = CommissionPlan.builder()
                .id(plan2999Id)
                .serviceType("AEPS_1")
                .planName("Rupiksha Anand Plan")
                .planCode("PLAN_2999")
                .price(new BigDecimal("2999.00"))
                .enabled(true)
                .slabs(new ArrayList<>(defaultSlabs))
                .build();

        Instant existingExpiry = java.time.Instant.now().plus(100, java.time.temporal.ChronoUnit.DAYS);
        retailer.setAepsCommissionPlan(plan2999);
        retailer.setAepsCommissionPlanExpiresAt(existingExpiry);

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(commissionPlanRepository.findByIdWithSlabs(freePlan.getId())).thenReturn(Optional.of(freePlan));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                commissionService.upgradeRetailerPlan(retailer.getId(), freePlan.getId(), "127.0.0.1")
        );
        assertTrue(ex.getMessage().contains("Cannot downgrade your plan"));
    }

    @Test
    @DisplayName("CASE 17: Expired Paid Plan Falls Back to Free Plan")
    void testExpiredPaidPlanFallsBackToFreePlan() {
        UUID plan2999Id = UUID.randomUUID();
        CommissionPlan plan2999 = CommissionPlan.builder()
                .id(plan2999Id)
                .serviceType("AEPS_1")
                .planName("Rupiksha Anand Plan")
                .planCode("PLAN_2999")
                .price(new BigDecimal("2999.00"))
                .enabled(true)
                .slabs(new ArrayList<>(defaultSlabs))
                .build();

        // Expired 5 days ago
        Instant expiredAt = java.time.Instant.now().minus(5, java.time.temporal.ChronoUnit.DAYS);
        retailer.setAepsCommissionPlan(plan2999);
        retailer.setAepsCommissionPlanExpiresAt(expiredAt);

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")).thenReturn(Optional.of(freePlan));

        CommissionDtos.CommissionPlanDto activePlanDto = commissionService.getRetailerActivePlan(retailer.getId());
        assertNotNull(activePlanDto);
        assertEquals("FREE", activePlanDto.planCode());
        assertTrue(activePlanDto.isExpired());
    }

    @Test
    @DisplayName("CASE 18: Hierarchy Fallback via addedByUserRef - Distributor Credited")
    void testHierarchyFallbackViaAddedByUserRef() {
        retailer.setParentUser(null);
        retailer.setAddedByUserRef(distributor.getId().toString());

        AepsTransactionEngine txn = AepsTransactionEngine.builder()
                .transactionId("TXN_FALLBACK_001")
                .serviceType("CASH_WITHDRAWAL")
                .userId(retailer.getId())
                .amount(new BigDecimal("1200.00"))
                .status("SUCCESS")
                .ipAddress("127.0.0.1")
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("TXN_FALLBACK_001")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(userRepository.findById(distributor.getId())).thenReturn(Optional.of(distributor));
        when(commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")).thenReturn(Optional.of(freePlan));
        when(commissionSlabRepository.findMatchingSlabs(freePlan.getId(), new BigDecimal("1200.00"))).thenReturn(List.of(defaultSlabs.get(1)));

        commissionService.processAepsCommission(txn);

        // Retailer: +₹2.00
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()), eq(new BigDecimal("2.00")), anyString(), eq(WalletTransactionContext.COMMISSION), anyString(), anyString(), anyString()
        );

        // Distributor: +₹0.50
        verify(walletService, times(1)).creditForService(
                eq(distributor.getId()), eq(new BigDecimal("0.50")), anyString(), eq(WalletTransactionContext.COMMISSION), anyString(), anyString(), anyString()
        );
    }

    @Test
    @DisplayName("CASE 19: Get Transactions with Null Filters Returns Correct Page")
    void testGetTransactionsRetailerFilters() {
        org.springframework.data.domain.PageRequest pageRequest = org.springframework.data.domain.PageRequest.of(0, 10);
        CommissionTransaction commTxn = CommissionTransaction.builder()
                .id(UUID.randomUUID())
                .commissionReference("COMM-20260920-TEST01")
                .originalTransactionId("TXN_001")
                .serviceType("AEPS_1")
                .planCode("FREE")
                .slabMin(new BigDecimal("500.00"))
                .slabMax(new BigDecimal("999.00"))
                .transactionAmount(new BigDecimal("700.00"))
                .beneficiaryUser(retailer)
                .beneficiaryRole("RETAILER")
                .retailerUser(retailer)
                .commissionAmount(new BigDecimal("1.00"))
                .status("SUCCESS")
                .createdAt(Instant.now())
                .build();

        org.springframework.data.domain.Page<CommissionTransaction> mockPage = new org.springframework.data.domain.PageImpl<>(List.of(commTxn), pageRequest, 1);
        when(commissionTransactionRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageRequest)))
                .thenReturn(mockPage);

        org.springframework.data.domain.Page<CommissionDtos.CommissionTransactionDto> page = commissionService.getTransactions(
                retailer.getId(), false, null, null, null, null, null, null, pageRequest
        );

        assertNotNull(page);
        assertEquals(1, page.getTotalElements());
        assertEquals("COMM-20260920-TEST01", page.getContent().get(0).commissionReference());
    }

    // ─── AEPS 1 MINI STATEMENT COMMISSION TESTS ─────────────────────────────

    @Test
    @DisplayName("MS-1: Full Hierarchy Mini Statement Commission Distribution")
    void testMiniStatement_FullHierarchy_Success() {
        // Arrange
        retailer.setAepsCommissionPlan(freePlan);
        AepsTransactionEngine txn = AepsTransactionEngine.builder()
                .transactionId("MS_TXN_FULL_001")
                .userId(retailer.getId())
                .serviceType("MINI_STATEMENT")
                .amount(BigDecimal.ZERO)
                .status("SUCCESS")
                .ipAddress("192.168.1.100")
                .build();

        AepsMiniStatementCommissionConfig config = AepsMiniStatementCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1_MINI_STATEMENT")
                .plan(freePlan)
                .planCode("FREE")
                .retailerCommission(new BigDecimal("1.00"))
                .distributorCommission(new BigDecimal("0.50"))
                .superDistributorCommission(new BigDecimal("0.25"))
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("MS_TXN_FULL_001")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(aepsMiniStatementCommissionConfigRepository.findByPlan_Id(freePlan.getId())).thenReturn(Optional.of(config));

        // Act
        commissionService.processAepsCommission(txn);

        // Assert - Retailer credited ₹1.00
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()), eq(new BigDecimal("1.00")), contains("MS_TXN_FULL_001"),
                eq(WalletTransactionContext.COMMISSION), eq("AEPS 1 Mini Statement"), eq("192.168.1.100"),
                eq("COMM-MS-MS_TXN_FULL_001-RETAILER-" + retailer.getId())
        );

        // Assert - Distributor credited ₹0.50
        verify(walletService, times(1)).creditForService(
                eq(distributor.getId()), eq(new BigDecimal("0.50")), contains("MS_TXN_FULL_001"),
                eq(WalletTransactionContext.COMMISSION), eq("AEPS 1 Mini Statement"), eq("192.168.1.100"),
                eq("COMM-MS-MS_TXN_FULL_001-DISTRIBUTOR-" + distributor.getId())
        );

        // Assert - Super Distributor credited ₹0.25
        verify(walletService, times(1)).creditForService(
                eq(superDistributor.getId()), eq(new BigDecimal("0.25")), contains("MS_TXN_FULL_001"),
                eq(WalletTransactionContext.COMMISSION), eq("AEPS 1 Mini Statement"), eq("192.168.1.100"),
                eq("COMM-MS-MS_TXN_FULL_001-SUPER_DISTRIBUTOR-" + superDistributor.getId())
        );

        // 3 ledger transactions saved
        verify(commissionTransactionRepository, times(3)).save(any(CommissionTransaction.class));
    }

    @Test
    @DisplayName("MS-2: Direct Retailer with No Hierarchy - Only Retailer Credited")
    void testMiniStatement_DirectRetailer_OnlyRetailerCredited() {
        retailer.setAepsCommissionPlan(freePlan);
        retailer.setParentUser(null);
        retailer.setAddedByUserRef(null);
        retailer.setAddedByPartyCode(null);

        AepsTransactionEngine txn = AepsTransactionEngine.builder()
                .transactionId("MS_TXN_DIRECT_002")
                .userId(retailer.getId())
                .serviceType("MINI_STATEMENT")
                .amount(BigDecimal.ZERO)
                .status("SUCCESS")
                .build();

        AepsMiniStatementCommissionConfig config = AepsMiniStatementCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1_MINI_STATEMENT")
                .plan(freePlan)
                .planCode("FREE")
                .retailerCommission(new BigDecimal("1.00"))
                .distributorCommission(new BigDecimal("0.50"))
                .superDistributorCommission(new BigDecimal("0.25"))
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("MS_TXN_DIRECT_002")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(aepsMiniStatementCommissionConfigRepository.findByPlan_Id(freePlan.getId())).thenReturn(Optional.of(config));

        commissionService.processAepsCommission(txn);

        // Only Retailer credited
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()), eq(new BigDecimal("1.00")), anyString(),
                eq(WalletTransactionContext.COMMISSION), eq("AEPS 1 Mini Statement"), anyString(), anyString()
        );

        // Distributor and Super Distributor NOT credited
        verify(walletService, never()).creditForService(
                eq(distributor.getId()), any(), any(), any(), any(), any(), any()
        );
        verify(walletService, never()).creditForService(
                eq(superDistributor.getId()), any(), any(), any(), any(), any(), any()
        );

        // Only 1 ledger record saved
        verify(commissionTransactionRepository, times(1)).save(any(CommissionTransaction.class));
    }

    @Test
    @DisplayName("MS-3: Distributor without Super Distributor - Only Retailer & Distributor Credited")
    void testMiniStatement_DistributorWithoutSuperDistributor() {
        retailer.setAepsCommissionPlan(freePlan);
        distributor.setParentUser(null);
        distributor.setAddedByUserRef(null);
        distributor.setAddedByPartyCode(null);

        AepsTransactionEngine txn = AepsTransactionEngine.builder()
                .transactionId("MS_TXN_DIST_ONLY_003")
                .userId(retailer.getId())
                .serviceType("MINI_STATEMENT")
                .amount(BigDecimal.ZERO)
                .status("SUCCESS")
                .build();

        AepsMiniStatementCommissionConfig config = AepsMiniStatementCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1_MINI_STATEMENT")
                .plan(freePlan)
                .planCode("FREE")
                .retailerCommission(new BigDecimal("1.00"))
                .distributorCommission(new BigDecimal("0.50"))
                .superDistributorCommission(new BigDecimal("0.25"))
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("MS_TXN_DIST_ONLY_003")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(aepsMiniStatementCommissionConfigRepository.findByPlan_Id(freePlan.getId())).thenReturn(Optional.of(config));

        commissionService.processAepsCommission(txn);

        // Retailer + Distributor credited
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()), eq(new BigDecimal("1.00")), anyString(),
                eq(WalletTransactionContext.COMMISSION), eq("AEPS 1 Mini Statement"), anyString(), anyString()
        );
        verify(walletService, times(1)).creditForService(
                eq(distributor.getId()), eq(new BigDecimal("0.50")), anyString(),
                eq(WalletTransactionContext.COMMISSION), eq("AEPS 1 Mini Statement"), anyString(), anyString()
        );
        // Super Distributor NOT credited
        verify(walletService, never()).creditForService(
                eq(superDistributor.getId()), any(), any(), any(), any(), any(), any()
        );

        // Exactly 2 ledger records saved
        verify(commissionTransactionRepository, times(2)).save(any(CommissionTransaction.class));
    }

    @Test
    @DisplayName("MS-4: Zero Commission Configured - No Wallet Credit")
    void testMiniStatement_ZeroCommission_NoWalletCredit() {
        retailer.setAepsCommissionPlan(freePlan);
        AepsTransactionEngine txn = AepsTransactionEngine.builder()
                .transactionId("MS_TXN_ZERO_004")
                .userId(retailer.getId())
                .serviceType("MINI_STATEMENT")
                .amount(BigDecimal.ZERO)
                .status("SUCCESS")
                .build();

        AepsMiniStatementCommissionConfig config = AepsMiniStatementCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1_MINI_STATEMENT")
                .plan(freePlan)
                .planCode("FREE")
                .retailerCommission(BigDecimal.ZERO)
                .distributorCommission(BigDecimal.ZERO)
                .superDistributorCommission(BigDecimal.ZERO)
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("MS_TXN_ZERO_004")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(aepsMiniStatementCommissionConfigRepository.findByPlan_Id(freePlan.getId())).thenReturn(Optional.of(config));

        commissionService.processAepsCommission(txn);

        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
        verify(commissionTransactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("MS-5: Non-Successful Transaction - No Commission Generated")
    void testMiniStatement_FailedOrPendingTransaction_NoCommission() {
        AepsTransactionEngine failedTxn = AepsTransactionEngine.builder()
                .transactionId("MS_TXN_FAIL_005")
                .userId(retailer.getId())
                .serviceType("MINI_STATEMENT")
                .status("FAILED")
                .build();

        AepsTransactionEngine pendingTxn = AepsTransactionEngine.builder()
                .transactionId("MS_TXN_PEND_005")
                .userId(retailer.getId())
                .serviceType("MINI_STATEMENT")
                .status("PENDING")
                .build();

        commissionService.processAepsCommission(failedTxn);
        commissionService.processAepsCommission(pendingTxn);

        verify(commissionTransactionRepository, never()).existsByOriginalTransactionId(anyString());
        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("MS-6: Idempotency Protection - Duplicate Transaction Not Re-credited")
    void testMiniStatement_Idempotency_AlreadyProcessed() {
        AepsTransactionEngine txn = AepsTransactionEngine.builder()
                .transactionId("MS_TXN_DUP_006")
                .userId(retailer.getId())
                .serviceType("MINI_STATEMENT")
                .status("SUCCESS")
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("MS_TXN_DUP_006")).thenReturn(true);

        commissionService.processAepsCommission(txn);

        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
        verify(commissionTransactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("MS-7: Different Commission Plans Use Independent Configurations")
    void testMiniStatement_DifferentPlans_Independent() {
        CommissionPlan anandPlan = CommissionPlan.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1")
                .planName("Rupiksha Anand Plan")
                .planCode("PLAN_2999")
                .price(new BigDecimal("2999.00"))
                .enabled(true)
                .build();

        retailer.setAepsCommissionPlan(anandPlan);
        retailer.setAepsCommissionPlanExpiresAt(Instant.now().plusSeconds(86400 * 30));

        AepsTransactionEngine txn = AepsTransactionEngine.builder()
                .transactionId("MS_TXN_PLAN_007")
                .userId(retailer.getId())
                .serviceType("MINI_STATEMENT")
                .status("SUCCESS")
                .build();

        AepsMiniStatementCommissionConfig anandConfig = AepsMiniStatementCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1_MINI_STATEMENT")
                .plan(anandPlan)
                .planCode("PLAN_2999")
                .retailerCommission(new BigDecimal("1.50"))
                .distributorCommission(new BigDecimal("0.75"))
                .superDistributorCommission(new BigDecimal("0.50"))
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("MS_TXN_PLAN_007")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(aepsMiniStatementCommissionConfigRepository.findByPlan_Id(anandPlan.getId())).thenReturn(Optional.of(anandConfig));

        commissionService.processAepsCommission(txn);

        // Verify Anand plan specific amounts applied
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()), eq(new BigDecimal("1.50")), anyString(), any(), any(), any(), any()
        );
        verify(walletService, times(1)).creditForService(
                eq(distributor.getId()), eq(new BigDecimal("0.75")), anyString(), any(), any(), any(), any()
        );
        verify(walletService, times(1)).creditForService(
                eq(superDistributor.getId()), eq(new BigDecimal("0.50")), anyString(), any(), any(), any(), any()
        );
    }

    @Test
    @DisplayName("MS-8: Cash Withdrawal and Mini Statement Do Not Interfere with Each Other")
    void testMiniStatement_CashWithdrawalVsMiniStatement_Independence() {
        // 1. Run Cash Withdrawal txn: Should use slabs
        AepsTransactionEngine cwTxn = AepsTransactionEngine.builder()
                .transactionId("CW_TXN_INDEP_008")
                .userId(retailer.getId())
                .serviceType("CASH_WITHDRAWAL")
                .amount(new BigDecimal("1200.00"))
                .status("SUCCESS")
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("CW_TXN_INDEP_008")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")).thenReturn(Optional.of(freePlan));
        when(commissionSlabRepository.findMatchingSlabs(freePlan.getId(), new BigDecimal("1200.00")))
                .thenReturn(List.of(defaultSlabs.get(1))); // slab 1000-1499: ret=2, dist=0.5, sd=0.5

        commissionService.processAepsCommission(cwTxn);

        // Verify Cash Withdrawal credited using slab amounts
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()), eq(new BigDecimal("2.00")), contains("AEPS 1 Commission"),
                eq(WalletTransactionContext.COMMISSION), eq("AEPS 1"), anyString(), contains("CW_TXN_INDEP_008")
        );

        // 2. Run Mini Statement txn: Should use flat config, NOT slabs
        AepsTransactionEngine msTxn = AepsTransactionEngine.builder()
                .transactionId("MS_TXN_INDEP_008")
                .userId(retailer.getId())
                .serviceType("MINI_STATEMENT")
                .amount(BigDecimal.ZERO)
                .status("SUCCESS")
                .build();

        AepsMiniStatementCommissionConfig msConfig = AepsMiniStatementCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1_MINI_STATEMENT")
                .plan(freePlan)
                .planCode("FREE")
                .retailerCommission(new BigDecimal("1.00"))
                .distributorCommission(new BigDecimal("0.50"))
                .superDistributorCommission(new BigDecimal("0.25"))
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("MS_TXN_INDEP_008")).thenReturn(false);
        when(aepsMiniStatementCommissionConfigRepository.findByPlan_Id(freePlan.getId())).thenReturn(Optional.of(msConfig));

        commissionService.processAepsCommission(msTxn);

        // Verify Mini Statement credited using flat amount
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()), eq(new BigDecimal("1.00")), contains("MS_TXN_INDEP_008"),
                eq(WalletTransactionContext.COMMISSION), eq("AEPS 1 Mini Statement"), anyString(), anyString()
        );
    }

    @Test
    @DisplayName("MS-9: Admin Update Mini Statement Config - Success and Audit Log")
    void testMiniStatement_AdminUpdateConfig_SuccessAndAudit() {
        UUID adminId = UUID.randomUUID();
        User admin = new User();
        admin.setId(adminId);
        admin.setUsername("admin");
        Role adminRole = new Role();
        adminRole.setName(RoleName.ADMIN);
        admin.setRoles(Set.of(adminRole));

        UUID configId = UUID.randomUUID();
        AepsMiniStatementCommissionConfig existingConfig = AepsMiniStatementCommissionConfig.builder()
                .id(configId)
                .serviceType("AEPS_1_MINI_STATEMENT")
                .plan(freePlan)
                .planCode("FREE")
                .retailerCommission(new BigDecimal("1.00"))
                .distributorCommission(new BigDecimal("0.50"))
                .superDistributorCommission(new BigDecimal("0.25"))
                .enabled(true)
                .build();

        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(aepsMiniStatementCommissionConfigRepository.findById(configId)).thenReturn(Optional.of(existingConfig));
        when(aepsMiniStatementCommissionConfigRepository.save(any(AepsMiniStatementCommissionConfig.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        CommissionDtos.UpdateAepsMiniStatementConfigRequest request = new CommissionDtos.UpdateAepsMiniStatementConfigRequest(
                new BigDecimal("1.50"),
                new BigDecimal("0.60"),
                new BigDecimal("0.30"),
                true
        );

        CommissionDtos.AepsMiniStatementCommissionConfigDto result = commissionService.updateAepsMiniStatementConfig(
                configId, request, adminId, "10.0.0.1"
        );

        assertNotNull(result);
        assertEquals(new BigDecimal("1.50"), result.retailerCommission());
        assertEquals(new BigDecimal("0.60"), result.distributorCommission());
        assertEquals(new BigDecimal("0.30"), result.superDistributorCommission());
        assertEquals(new BigDecimal("2.40"), result.totalCommission());

        // Verify audit record saved
        ArgumentCaptor<AepsMiniStatementCommissionConfigAudit> auditCaptor = ArgumentCaptor.forClass(AepsMiniStatementCommissionConfigAudit.class);
        verify(aepsMiniStatementCommissionConfigAuditRepository, times(1)).save(auditCaptor.capture());
        AepsMiniStatementCommissionConfigAudit audit = auditCaptor.getValue();
        assertEquals(new BigDecimal("1.00"), audit.getPrevRetailerCommission());
        assertEquals(new BigDecimal("1.50"), audit.getNewRetailerCommission());
        assertEquals("admin", audit.getAdminUsername());
        assertEquals("10.0.0.1", audit.getIpAddress());
    }

    @Test
    @DisplayName("MS-10: Negative Commission Rejected with IllegalArgumentException")
    void testMiniStatement_NegativeCommission_Rejected() {
        UUID adminId = UUID.randomUUID();
        User admin = new User();
        admin.setId(adminId);
        admin.setUsername("admin");
        Role adminRole = new Role();
        adminRole.setName(RoleName.ADMIN);
        admin.setRoles(Set.of(adminRole));

        UUID configId = UUID.randomUUID();
        AepsMiniStatementCommissionConfig existingConfig = AepsMiniStatementCommissionConfig.builder()
                .id(configId)
                .serviceType("AEPS_1_MINI_STATEMENT")
                .plan(freePlan)
                .planCode("FREE")
                .retailerCommission(new BigDecimal("1.00"))
                .distributorCommission(new BigDecimal("0.50"))
                .superDistributorCommission(new BigDecimal("0.25"))
                .enabled(true)
                .build();

        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(aepsMiniStatementCommissionConfigRepository.findById(configId)).thenReturn(Optional.of(existingConfig));

        CommissionDtos.UpdateAepsMiniStatementConfigRequest negRequest = new CommissionDtos.UpdateAepsMiniStatementConfigRequest(
                new BigDecimal("-1.00"),
                new BigDecimal("0.50"),
                new BigDecimal("0.25"),
                true
        );

        assertThrows(IllegalArgumentException.class, () ->
                commissionService.updateAepsMiniStatementConfig(configId, negRequest, adminId, "127.0.0.1")
        );
    }

    @Test
    @DisplayName("MS-11: Reconcile Credits Uncredited Mini Statement Transactions")
    void testMiniStatement_Reconciliation_CreditsUncredited() {
        retailer.setAepsCommissionPlan(freePlan);
        AepsTransactionEngine uncreditedTxn = AepsTransactionEngine.builder()
                .transactionId("MS_RECON_011")
                .userId(retailer.getId())
                .serviceType("MINI_STATEMENT")
                .amount(BigDecimal.ZERO)
                .status("SUCCESS")
                .build();

        AepsMiniStatementCommissionConfig config = AepsMiniStatementCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1_MINI_STATEMENT")
                .plan(freePlan)
                .planCode("FREE")
                .retailerCommission(new BigDecimal("1.00"))
                .distributorCommission(new BigDecimal("0.50"))
                .superDistributorCommission(new BigDecimal("0.25"))
                .enabled(true)
                .build();

        when(aepsTransactionEngineRepository.findSuccessfulMiniStatements()).thenReturn(List.of(uncreditedTxn));
        when(commissionTransactionRepository.existsByOriginalTransactionId("MS_RECON_011"))
                .thenReturn(false, false, true); // 1st: check uncredited, 2nd: idempotency inside process, 3rd: confirm credited
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(aepsMiniStatementCommissionConfigRepository.findByPlan_Id(freePlan.getId())).thenReturn(Optional.of(config));

        int reconciled = commissionService.reconcileUncreditedAepsMiniStatementCommissions();

        assertEquals(1, reconciled);
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()), eq(new BigDecimal("1.00")), anyString(), any(), any(), any(), any()
        );
    }
}
