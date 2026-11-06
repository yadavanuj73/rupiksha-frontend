package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.CommissionDtos;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.service.Aeps2faChargeService.ChargeExecutionResult;
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
class Aeps2faChargeServiceImplTest {

    @Mock
    private Aeps2faChargeConfigRepository aeps2faChargeConfigRepository;

    @Mock
    private Aeps2faChargeConfigAuditRepository aeps2faChargeConfigAuditRepository;

    @Mock
    private Aeps2faChargeTxnRepository aeps2faChargeTxnRepository;

    @Mock
    private CommissionPlanRepository commissionPlanRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WalletService walletService;

    @InjectMocks
    private Aeps2faChargeServiceImpl aeps2faChargeService;

    private User retailerUser;
    private User distributorUser;
    private User superDistributorUser;
    private User adminUser;
    private CommissionPlan freePlan;
    private Aeps2faChargeConfig freeConfig;
    private UUID freePlanId;
    private UUID configId;
    private UUID adminUserId;

    @BeforeEach
    void setUp() {
        Role retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);

        Role distributorRole = new Role();
        distributorRole.setName(RoleName.DISTRIBUTOR);

        Role superDistributorRole = new Role();
        superDistributorRole.setName(RoleName.SUPER_DISTRIBUTOR);

        freePlanId = UUID.randomUUID();
        freePlan = CommissionPlan.builder()
                .id(freePlanId)
                .serviceType("AEPS_1")
                .planCode("FREE")
                .planName("Free Plan")
                .isDefault(true)
                .enabled(true)
                .build();

        retailerUser = new User();
        retailerUser.setId(UUID.randomUUID());
        retailerUser.setUsername("ret_test");
        retailerUser.setFullName("Test Retailer");
        retailerUser.setRoles(Set.of(retailerRole));
        retailerUser.setAepsCommissionPlan(freePlan);

        distributorUser = new User();
        distributorUser.setId(UUID.randomUUID());
        distributorUser.setUsername("dist_test");
        distributorUser.setFullName("Test Distributor");
        distributorUser.setRoles(Set.of(distributorRole));
        distributorUser.setAepsCommissionPlan(freePlan);

        superDistributorUser = new User();
        superDistributorUser.setId(UUID.randomUUID());
        superDistributorUser.setUsername("sd_test");
        superDistributorUser.setFullName("Test Super Distributor");
        superDistributorUser.setRoles(Set.of(superDistributorRole));
        superDistributorUser.setAepsCommissionPlan(freePlan);

        adminUserId = UUID.randomUUID();
        adminUser = new User();
        adminUser.setId(adminUserId);
        adminUser.setUsername("admin_rupiksha");
        adminUser.setFullName("Rupiksha Admin");

        configId = UUID.randomUUID();
        freeConfig = Aeps2faChargeConfig.builder()
                .id(configId)
                .plan(freePlan)
                .planCode("FREE")
                .retailerCharge(new BigDecimal("2.00"))
                .distributorCharge(new BigDecimal("3.00"))
                .superDistributorCharge(new BigDecimal("4.00"))
                .enabled(true)
                .build();
    }

    private WalletDtos.WalletBalanceResponse createBalResp(BigDecimal balance) {
        return new WalletDtos.WalletBalanceResponse(
                UUID.randomUUID().toString(),
                "Agent",
                "agent",
                "9876543210",
                "RETAILER",
                balance,
                BigDecimal.ZERO,
                balance,
                BigDecimal.ZERO,
                "ACTIVE"
        );
    }

    @Test
    @DisplayName("Retailer with sufficient balance is charged ₹2.00 and closing balance is ₹8.00 (no outstanding)")
    void testProcess2faCharge_Retailer_SufficientBalance() {
        when(aeps2faChargeTxnRepository.findByOriginal2faReference("2FA-REF-001")).thenReturn(Optional.empty());
        when(aeps2faChargeConfigRepository.findByPlan_Id(freePlanId)).thenReturn(Optional.of(freeConfig));

        when(walletService.debitFor2faCharge(eq(retailerUser.getId()), eq(new BigDecimal("2.00")), anyString(), eq("AEPS 1 2FA"), anyString(), anyString()))
                .thenReturn(createBalResp(new BigDecimal("8.00")));

        ChargeExecutionResult result = aeps2faChargeService.process2faCharge(
                retailerUser, "2FA-REF-001", "FP-TXN-1", "FINGPAY", "127.0.0.1"
        );

        assertTrue(result.charged());
        assertEquals(0, result.chargeAmount().compareTo(new BigDecimal("2.00")));
        assertEquals(0, result.walletBalance().compareTo(new BigDecimal("8.00")));
        assertEquals(0, result.outstandingAmount().compareTo(BigDecimal.ZERO));
        assertEquals("SUCCESS", result.chargeStatus());

        ArgumentCaptor<Aeps2faChargeTxn> captor = ArgumentCaptor.forClass(Aeps2faChargeTxn.class);
        verify(aeps2faChargeTxnRepository).saveAndFlush(captor.capture());
        Aeps2faChargeTxn savedTxn = captor.getValue();
        assertEquals("RETAILER", savedTxn.getUserRole());
        assertEquals("NONE", savedTxn.getSettlementStatus());
        assertEquals(0, savedTxn.getOutstandingAmount().compareTo(BigDecimal.ZERO));
    }

    @Test
    @DisplayName("Retailer with insufficient balance (₹2.00 balance vs ₹5.00 charge) is debited to -₹3.00 with ₹3.00 outstanding")
    void testProcess2faCharge_InsufficientBalance_NegativeWalletAllowed() {
        Aeps2faChargeConfig highConfig = Aeps2faChargeConfig.builder()
                .id(UUID.randomUUID())
                .plan(freePlan)
                .planCode("FREE")
                .retailerCharge(new BigDecimal("5.00"))
                .enabled(true)
                .build();

        when(aeps2faChargeTxnRepository.findByOriginal2faReference("2FA-REF-002")).thenReturn(Optional.empty());
        when(aeps2faChargeConfigRepository.findByPlan_Id(freePlanId)).thenReturn(Optional.of(highConfig));

        when(walletService.debitFor2faCharge(eq(retailerUser.getId()), eq(new BigDecimal("5.00")), anyString(), eq("AEPS 1 2FA"), anyString(), anyString()))
                .thenReturn(createBalResp(new BigDecimal("-3.00")));

        ChargeExecutionResult result = aeps2faChargeService.process2faCharge(
                retailerUser, "2FA-REF-002", "FP-TXN-2", "FINGPAY", "127.0.0.1"
        );

        assertTrue(result.charged());
        assertEquals(0, result.chargeAmount().compareTo(new BigDecimal("5.00")));
        assertEquals(0, result.walletBalance().compareTo(new BigDecimal("-3.00")));
        assertEquals(0, result.outstandingAmount().compareTo(new BigDecimal("3.00")));
        assertEquals("SUCCESS", result.chargeStatus());

        ArgumentCaptor<Aeps2faChargeTxn> captor = ArgumentCaptor.forClass(Aeps2faChargeTxn.class);
        verify(aeps2faChargeTxnRepository).saveAndFlush(captor.capture());
        Aeps2faChargeTxn savedTxn = captor.getValue();
        assertEquals("UNSETTLED", savedTxn.getSettlementStatus());
        assertEquals(0, savedTxn.getOutstandingAmount().compareTo(new BigDecimal("3.00")));
    }

    @Test
    @DisplayName("Zero wallet balance (₹0.00) allows 2FA charge and drops to -₹5.00 with full ₹5.00 outstanding")
    void testProcess2faCharge_ZeroBalance_AllowsNegative() {
        Aeps2faChargeConfig highConfig = Aeps2faChargeConfig.builder()
                .id(UUID.randomUUID())
                .plan(freePlan)
                .planCode("FREE")
                .retailerCharge(new BigDecimal("5.00"))
                .enabled(true)
                .build();

        when(aeps2faChargeTxnRepository.findByOriginal2faReference("2FA-REF-003")).thenReturn(Optional.empty());
        when(aeps2faChargeConfigRepository.findByPlan_Id(freePlanId)).thenReturn(Optional.of(highConfig));

        when(walletService.debitFor2faCharge(eq(retailerUser.getId()), eq(new BigDecimal("5.00")), anyString(), eq("AEPS 1 2FA"), anyString(), anyString()))
                .thenReturn(createBalResp(new BigDecimal("-5.00")));

        ChargeExecutionResult result = aeps2faChargeService.process2faCharge(
                retailerUser, "2FA-REF-003", "FP-TXN-3", "FINGPAY", "127.0.0.1"
        );

        assertTrue(result.charged());
        assertEquals(0, result.walletBalance().compareTo(new BigDecimal("-5.00")));
        assertEquals(0, result.outstandingAmount().compareTo(new BigDecimal("5.00")));
    }

    @Test
    @DisplayName("Idempotency guard: duplicate 2FA reference returns existing charge without double debit")
    void testProcess2faCharge_IdempotentSafeguard() {
        Aeps2faChargeTxn existingTxn = Aeps2faChargeTxn.builder()
                .id(UUID.randomUUID())
                .chargeReference("2FA-CHG-20261106-EXIST1")
                .original2faReference("2FA-DUPLICATE-REF")
                .user(retailerUser)
                .amountCharged(new BigDecimal("2.00"))
                .walletClosingBalance(new BigDecimal("8.00"))
                .outstandingAmount(BigDecimal.ZERO)
                .transactionStatus("SUCCESS")
                .build();

        when(aeps2faChargeTxnRepository.findByOriginal2faReference("2FA-DUPLICATE-REF"))
                .thenReturn(Optional.of(existingTxn));

        ChargeExecutionResult result = aeps2faChargeService.process2faCharge(
                retailerUser, "2FA-DUPLICATE-REF", "FP-TXN-DUP", "FINGPAY", "127.0.0.1"
        );

        assertTrue(result.charged());
        assertEquals("2FA-CHG-20261106-EXIST1", result.chargeReference());
        assertEquals(0, result.chargeAmount().compareTo(new BigDecimal("2.00")));
        verify(walletService, never()).debitFor2faCharge(any(), any(), any(), any(), any(), any());
        verify(aeps2faChargeTxnRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("Role resolution correctly charges Distributor rate (₹3.00)")
    void testProcess2faCharge_RoleResolution_Distributor() {
        when(aeps2faChargeTxnRepository.findByOriginal2faReference("2FA-REF-DIST")).thenReturn(Optional.empty());
        when(aeps2faChargeConfigRepository.findByPlan_Id(freePlanId)).thenReturn(Optional.of(freeConfig));

        when(walletService.debitFor2faCharge(eq(distributorUser.getId()), eq(new BigDecimal("3.00")), anyString(), eq("AEPS 1 2FA"), anyString(), anyString()))
                .thenReturn(createBalResp(new BigDecimal("17.00")));

        ChargeExecutionResult result = aeps2faChargeService.process2faCharge(
                distributorUser, "2FA-REF-DIST", "FP-TXN-D", "FINGPAY", "127.0.0.1"
        );

        assertTrue(result.charged());
        assertEquals(0, result.chargeAmount().compareTo(new BigDecimal("3.00")));
        assertEquals(0, result.walletBalance().compareTo(new BigDecimal("17.00")));

        ArgumentCaptor<Aeps2faChargeTxn> captor = ArgumentCaptor.forClass(Aeps2faChargeTxn.class);
        verify(aeps2faChargeTxnRepository).saveAndFlush(captor.capture());
        assertEquals("DISTRIBUTOR", captor.getValue().getUserRole());
    }

    @Test
    @DisplayName("Role resolution correctly charges Super Distributor rate (₹4.00)")
    void testProcess2faCharge_RoleResolution_SuperDistributor() {
        when(aeps2faChargeTxnRepository.findByOriginal2faReference("2FA-REF-SD")).thenReturn(Optional.empty());
        when(aeps2faChargeConfigRepository.findByPlan_Id(freePlanId)).thenReturn(Optional.of(freeConfig));

        when(walletService.debitFor2faCharge(eq(superDistributorUser.getId()), eq(new BigDecimal("4.00")), anyString(), eq("AEPS 1 2FA"), anyString(), anyString()))
                .thenReturn(createBalResp(new BigDecimal("46.00")));

        ChargeExecutionResult result = aeps2faChargeService.process2faCharge(
                superDistributorUser, "2FA-REF-SD", "FP-TXN-SD", "FINGPAY", "127.0.0.1"
        );

        assertTrue(result.charged());
        assertEquals(0, result.chargeAmount().compareTo(new BigDecimal("4.00")));
        assertEquals(0, result.walletBalance().compareTo(new BigDecimal("46.00")));

        ArgumentCaptor<Aeps2faChargeTxn> captor = ArgumentCaptor.forClass(Aeps2faChargeTxn.class);
        verify(aeps2faChargeTxnRepository).saveAndFlush(captor.capture());
        assertEquals("SUPER_DISTRIBUTOR", captor.getValue().getUserRole());
    }

    @Test
    @DisplayName("Zero configured charge (₹0.00) bypasses wallet debit")
    void testProcess2faCharge_ZeroCharge_BypassesWalletDebit() {
        Aeps2faChargeConfig zeroConfig = Aeps2faChargeConfig.builder()
                .id(UUID.randomUUID())
                .plan(freePlan)
                .planCode("FREE")
                .retailerCharge(BigDecimal.ZERO)
                .enabled(true)
                .build();

        when(aeps2faChargeTxnRepository.findByOriginal2faReference("2FA-ZERO-REF")).thenReturn(Optional.empty());
        when(aeps2faChargeConfigRepository.findByPlan_Id(freePlanId)).thenReturn(Optional.of(zeroConfig));

        ChargeExecutionResult result = aeps2faChargeService.process2faCharge(
                retailerUser, "2FA-ZERO-REF", "FP-TXN-Z", "FINGPAY", "127.0.0.1"
        );

        assertFalse(result.charged());
        assertEquals(0, result.chargeAmount().compareTo(BigDecimal.ZERO));
        assertEquals("ZERO_CHARGE", result.chargeStatus());
        verify(walletService, never()).debitFor2faCharge(any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Admin updates 2FA config creates audit trail with old vs new charges")
    void testUpdateConfig_Success() {
        when(aeps2faChargeConfigRepository.findById(configId)).thenReturn(Optional.of(freeConfig));
        when(userRepository.findById(adminUserId)).thenReturn(Optional.of(adminUser));
        when(aeps2faChargeConfigRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        CommissionDtos.UpdateAeps2faConfigRequest req = new CommissionDtos.UpdateAeps2faConfigRequest(
                new BigDecimal("2.50"),
                new BigDecimal("3.50"),
                new BigDecimal("4.50"),
                true
        );

        CommissionDtos.Aeps2faChargeConfigDto updatedDto = aeps2faChargeService.updateConfig(
                configId, req, adminUserId, "192.168.1.10"
        );

        assertEquals(0, updatedDto.retailerCharge().compareTo(new BigDecimal("2.50")));
        assertEquals(0, updatedDto.distributorCharge().compareTo(new BigDecimal("3.50")));
        assertEquals(0, updatedDto.superDistributorCharge().compareTo(new BigDecimal("4.50")));

        ArgumentCaptor<Aeps2faChargeConfigAudit> auditCaptor = ArgumentCaptor.forClass(Aeps2faChargeConfigAudit.class);
        verify(aeps2faChargeConfigAuditRepository).save(auditCaptor.capture());
        Aeps2faChargeConfigAudit audit = auditCaptor.getValue();
        assertEquals("admin_rupiksha", audit.getAdminUsername());
        assertEquals("192.168.1.10", audit.getIpAddress());
        assertEquals(0, audit.getPrevRetailerCharge().compareTo(new BigDecimal("2.00")));
        assertEquals(0, audit.getNewRetailerCharge().compareTo(new BigDecimal("2.50")));
    }

    @Test
    @DisplayName("Admin update rejects negative charges with IllegalArgumentException")
    void testUpdateConfig_RejectsNegativeCharge() {
        when(aeps2faChargeConfigRepository.findById(configId)).thenReturn(Optional.of(freeConfig));

        CommissionDtos.UpdateAeps2faConfigRequest req = new CommissionDtos.UpdateAeps2faConfigRequest(
                new BigDecimal("-1.00"),
                new BigDecimal("3.50"),
                new BigDecimal("4.50"),
                true
        );

        assertThrows(IllegalArgumentException.class, () ->
                aeps2faChargeService.updateConfig(configId, req, adminUserId, "127.0.0.1")
        );
        verify(aeps2faChargeConfigRepository, never()).save(any());
    }
}
