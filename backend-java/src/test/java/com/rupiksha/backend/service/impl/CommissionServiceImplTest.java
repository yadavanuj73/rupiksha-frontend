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

        // Verify retailer user was saved with new plan
        assertEquals(paidPlan, retailer.getAepsCommissionPlan());
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
}
