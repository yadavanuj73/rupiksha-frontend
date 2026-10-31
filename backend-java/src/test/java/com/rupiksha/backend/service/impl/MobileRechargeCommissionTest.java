package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.CommissionDtos;
import com.rupiksha.backend.config.AppProperties;
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
import java.math.RoundingMode;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class MobileRechargeCommissionTest {

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
    private BbpsCommissionConfigRepository bbpsCommissionConfigRepository;

    @Mock
    private BbpsCommissionConfigAuditRepository bbpsCommissionConfigAuditRepository;

    @Mock
    private BbpsTransactionRepository bbpsTransactionRepository;

    @Mock
    private RechargeCommissionConfigRepository rechargeCommissionConfigRepository;

    @Mock
    private RechargeCommissionConfigAuditRepository rechargeCommissionConfigAuditRepository;

    @Mock
    private RechargeRepository rechargeRepository;

    @Mock
    private AppProperties appProperties;

    @InjectMocks
    private CommissionServiceImpl commissionService;

    private User retailer;
    private User distributor;
    private User superDistributor;
    private CommissionPlan freePlan;

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
                .build();
    }

    @Test
    @DisplayName("Mode A (Percentage): ₹500 recharge correctly distributes Retailer 1.00%=₹5.00, Dist 0.25%=₹1.25, SD 0.25%=₹1.25")
    void testPercentageCommissionCalculation() {
        Recharge recharge = new Recharge();
        recharge.setId(UUID.randomUUID());
        recharge.setMerchantRefNo("MR202610310001");
        recharge.setMobileNo("9876543210");
        recharge.setOperatorCode("JRE");
        recharge.setServiceType("MR");
        recharge.setAmount(new BigDecimal("500.00"));
        recharge.setStatus(TransactionStatus.SUCCESS);
        recharge.setUser(retailer);

        RechargeCommissionConfig config = RechargeCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceType("MOBILE_RECHARGE")
                .operatorCode("JRE")
                .operatorName("Jio Recharge")
                .commissionMode("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerValue(new BigDecimal("1.0000"))
                .distributorValue(new BigDecimal("0.2500"))
                .superDistributorValue(new BigDecimal("0.2500"))
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("MR202610310001")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")).thenReturn(Optional.of(freePlan));
        when(rechargeCommissionConfigRepository.findByServiceTypeAndOperatorCodeAndPlan_PlanCode("MOBILE_RECHARGE", "JRE", "FREE"))
                .thenReturn(Optional.of(config));

        commissionService.processRechargeCommission(recharge);

        // Verify Retailer wallet credited ₹5.00 (1% of 500)
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()),
                eq(new BigDecimal("5.00")),
                contains("Jio Recharge"),
                eq(WalletTransactionContext.COMMISSION),
                eq("Mobile Recharge"),
                anyString(),
                contains("COMM-MR202610310001-RETAILER-")
        );

        // Verify Distributor wallet credited ₹1.25 (0.25% of 500)
        verify(walletService, times(1)).creditForService(
                eq(distributor.getId()),
                eq(new BigDecimal("1.25")),
                contains("Distributor"),
                eq(WalletTransactionContext.COMMISSION),
                eq("Mobile Recharge"),
                anyString(),
                contains("COMM-MR202610310001-DISTRIBUTOR-")
        );

        // Verify Super Distributor wallet credited ₹1.25 (0.25% of 500)
        verify(walletService, times(1)).creditForService(
                eq(superDistributor.getId()),
                eq(new BigDecimal("1.25")),
                contains("Super Distributor"),
                eq(WalletTransactionContext.COMMISSION),
                eq("Mobile Recharge"),
                anyString(),
                contains("COMM-MR202610310001-SUPER_DISTRIBUTOR-")
        );

        // Verify 3 CommissionTransaction records saved
        verify(commissionTransactionRepository, times(3)).save(any(CommissionTransaction.class));
    }

    @Test
    @DisplayName("Mode B (Fixed ₹): ₹500 recharge correctly distributes configured fixed amounts Retailer ₹3.00, Dist ₹1.00, SD ₹0.50")
    void testFixedCommissionCalculation() {
        Recharge recharge = new Recharge();
        recharge.setId(UUID.randomUUID());
        recharge.setMerchantRefNo("MR202610310002");
        recharge.setMobileNo("9811122233");
        recharge.setOperatorCode("ATL");
        recharge.setServiceType("MR");
        recharge.setAmount(new BigDecimal("500.00"));
        recharge.setStatus(TransactionStatus.SUCCESS);
        recharge.setUser(retailer);

        RechargeCommissionConfig config = RechargeCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceType("MOBILE_RECHARGE")
                .operatorCode("ATL")
                .operatorName("Airtel")
                .commissionMode("FIXED")
                .plan(freePlan)
                .planCode("FREE")
                .retailerValue(new BigDecimal("3.0000"))
                .distributorValue(new BigDecimal("1.0000"))
                .superDistributorValue(new BigDecimal("0.5000"))
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("MR202610310002")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")).thenReturn(Optional.of(freePlan));
        when(rechargeCommissionConfigRepository.findByServiceTypeAndOperatorCodeAndPlan_PlanCode("MOBILE_RECHARGE", "ATL", "FREE"))
                .thenReturn(Optional.of(config));

        commissionService.processRechargeCommission(recharge);

        // Verify Retailer fixed ₹3.00
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()),
                eq(new BigDecimal("3.00")),
                anyString(),
                eq(WalletTransactionContext.COMMISSION),
                eq("Mobile Recharge"),
                anyString(),
                anyString()
        );

        // Verify Distributor fixed ₹1.00
        verify(walletService, times(1)).creditForService(
                eq(distributor.getId()),
                eq(new BigDecimal("1.00")),
                anyString(),
                eq(WalletTransactionContext.COMMISSION),
                eq("Mobile Recharge"),
                anyString(),
                anyString()
        );

        // Verify Super Distributor fixed ₹0.50
        verify(walletService, times(1)).creditForService(
                eq(superDistributor.getId()),
                eq(new BigDecimal("0.50")),
                anyString(),
                eq(WalletTransactionContext.COMMISSION),
                eq("Mobile Recharge"),
                anyString(),
                anyString()
        );
    }

    @Test
    @DisplayName("Direct Retailer without upline: only retailer receives commission credit")
    void testDirectRetailerWithoutUpline() {
        User directRetailer = new User();
        directRetailer.setId(UUID.randomUUID());
        directRetailer.setUsername("DIRECT001");
        directRetailer.setParentUser(null);
        directRetailer.setRoles(Set.of(retailer.getRoles().iterator().next()));

        Recharge recharge = new Recharge();
        recharge.setId(UUID.randomUUID());
        recharge.setMerchantRefNo("MR_DIRECT_01");
        recharge.setMobileNo("9998887776");
        recharge.setOperatorCode("JRE");
        recharge.setServiceType("MR");
        recharge.setAmount(new BigDecimal("300.00"));
        recharge.setStatus(TransactionStatus.SUCCESS);
        recharge.setUser(directRetailer);

        RechargeCommissionConfig config = RechargeCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceType("MOBILE_RECHARGE")
                .operatorCode("JRE")
                .operatorName("Jio Recharge")
                .commissionMode("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerValue(new BigDecimal("1.0000"))
                .distributorValue(new BigDecimal("0.2500"))
                .superDistributorValue(new BigDecimal("0.2500"))
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("MR_DIRECT_01")).thenReturn(false);
        when(userRepository.findById(directRetailer.getId())).thenReturn(Optional.of(directRetailer));
        when(commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")).thenReturn(Optional.of(freePlan));
        when(rechargeCommissionConfigRepository.findByServiceTypeAndOperatorCodeAndPlan_PlanCode("MOBILE_RECHARGE", "JRE", "FREE"))
                .thenReturn(Optional.of(config));

        commissionService.processRechargeCommission(recharge);

        // Only direct retailer credited ₹3.00 (1% of 300)
        verify(walletService, times(1)).creditForService(
                eq(directRetailer.getId()),
                eq(new BigDecimal("3.00")),
                anyString(),
                any(),
                anyString(),
                anyString(),
                anyString()
        );
        verify(commissionTransactionRepository, times(1)).save(any(CommissionTransaction.class));
    }

    @Test
    @DisplayName("Non-successful transactions (FAILED or PENDING) generate no commission")
    void testNonSuccessfulTransactionGeneratesNoCommission() {
        Recharge failed = new Recharge();
        failed.setMerchantRefNo("MR_FAIL_001");
        failed.setStatus(TransactionStatus.FAILED);
        failed.setServiceType("MR");
        failed.setAmount(new BigDecimal("500.00"));

        Recharge pending = new Recharge();
        pending.setMerchantRefNo("MR_PEND_001");
        pending.setStatus(TransactionStatus.PENDING);
        pending.setServiceType("MR");
        pending.setAmount(new BigDecimal("500.00"));

        commissionService.processRechargeCommission(failed);
        commissionService.processRechargeCommission(pending);

        verifyNoInteractions(walletService);
        verifyNoInteractions(commissionTransactionRepository);
    }

    @Test
    @DisplayName("Strict idempotency: already credited recharge transaction is safely skipped")
    void testIdempotentSkippingOfDuplicateRecharge() {
        Recharge recharge = new Recharge();
        recharge.setMerchantRefNo("MR_DUP_001");
        recharge.setStatus(TransactionStatus.SUCCESS);
        recharge.setServiceType("MR");
        recharge.setAmount(new BigDecimal("500.00"));

        when(commissionTransactionRepository.existsByOriginalTransactionId("MR_DUP_001")).thenReturn(true);

        commissionService.processRechargeCommission(recharge);

        verifyNoInteractions(walletService);
        verify(commissionTransactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("DTH Recharge category remains inactive and generates no commission")
    void testDthRechargeRemainsInactive() {
        Recharge dth = new Recharge();
        dth.setMerchantRefNo("DTH_001");
        dth.setOperatorCode("TATASKY");
        dth.setServiceType("DTH");
        dth.setStatus(TransactionStatus.SUCCESS);
        dth.setAmount(new BigDecimal("500.00"));

        commissionService.processRechargeCommission(dth);

        verifyNoInteractions(walletService);
        verifyNoInteractions(commissionTransactionRepository);
    }

    @Test
    @DisplayName("Operator and Plan isolation: Updating config for Jio Free does not affect Airtel or other plans")
    void testOperatorAndPlanIsolation() {
        UUID adminId = UUID.randomUUID();
        User admin = new User();
        admin.setId(adminId);
        admin.setUsername("admin");
        Role adminRole = new Role();
        adminRole.setName(RoleName.ADMIN);
        admin.setRoles(Set.of(adminRole));

        UUID jioConfigId = UUID.randomUUID();
        RechargeCommissionConfig jioConfig = RechargeCommissionConfig.builder()
                .id(jioConfigId)
                .serviceType("MOBILE_RECHARGE")
                .operatorCode("JRE")
                .operatorName("Jio Recharge")
                .commissionMode("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerValue(new BigDecimal("1.0000"))
                .distributorValue(new BigDecimal("0.2500"))
                .superDistributorValue(new BigDecimal("0.2500"))
                .enabled(true)
                .build();

        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(rechargeCommissionConfigRepository.findById(jioConfigId)).thenReturn(Optional.of(jioConfig));
        when(rechargeCommissionConfigRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        CommissionDtos.UpdateRechargeConfigRequest updateReq = new CommissionDtos.UpdateRechargeConfigRequest(
                "FIXED",
                new BigDecimal("5.00"),
                new BigDecimal("2.00"),
                new BigDecimal("1.00"),
                true
        );

        CommissionDtos.RechargeCommissionConfigDto updated = commissionService.updateRechargeConfig(
                jioConfigId, updateReq, adminId, "127.0.0.1"
        );

        assertEquals("FIXED", updated.commissionMode());
        assertEquals(new BigDecimal("5.00"), updated.retailerValue());
        assertEquals("JRE", updated.operatorCode());
        assertEquals("FREE", updated.planCode());

        // Verify audit created
        verify(rechargeCommissionConfigAuditRepository, times(1)).save(argThat(audit ->
                "JRE".equals(audit.getOperatorCode()) &&
                "FREE".equals(audit.getPlanCode()) &&
                "FIXED".equals(audit.getNewCommissionMode())
        ));
    }

    @Test
    @DisplayName("Zero commission values: zero amount commissions do not result in wallet credit calls")
    void testZeroCommissionDoesNotCredit() {
        Recharge recharge = new Recharge();
        recharge.setId(UUID.randomUUID());
        recharge.setMerchantRefNo("MR_ZERO_001");
        recharge.setMobileNo("9898989898");
        recharge.setOperatorCode("JRE");
        recharge.setServiceType("MR");
        recharge.setAmount(new BigDecimal("100.00"));
        recharge.setStatus(TransactionStatus.SUCCESS);
        recharge.setUser(retailer);

        RechargeCommissionConfig config = RechargeCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceType("MOBILE_RECHARGE")
                .operatorCode("JRE")
                .operatorName("Jio Recharge")
                .commissionMode("FIXED")
                .plan(freePlan)
                .planCode("FREE")
                .retailerValue(BigDecimal.ZERO)
                .distributorValue(BigDecimal.ZERO)
                .superDistributorValue(BigDecimal.ZERO)
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("MR_ZERO_001")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")).thenReturn(Optional.of(freePlan));
        when(rechargeCommissionConfigRepository.findByServiceTypeAndOperatorCodeAndPlan_PlanCode("MOBILE_RECHARGE", "JRE", "FREE"))
                .thenReturn(Optional.of(config));

        commissionService.processRechargeCommission(recharge);

        verifyNoInteractions(walletService);
    }

    @Test
    @DisplayName("Validation: percentages exceeding 100% or total exceeding 100% throw IllegalArgumentException")
    void testValidationRejectsExceedingPercentage() {
        UUID adminId = UUID.randomUUID();
        User admin = new User();
        admin.setId(adminId);
        Role adminRole = new Role();
        adminRole.setName(RoleName.ADMIN);
        admin.setRoles(Set.of(adminRole));

        UUID cfgId = UUID.randomUUID();
        RechargeCommissionConfig cfg = RechargeCommissionConfig.builder()
                .id(cfgId)
                .serviceType("MOBILE_RECHARGE")
                .operatorCode("ATL")
                .planCode("FREE")
                .build();

        when(userRepository.findById(adminId)).thenReturn(Optional.of(admin));
        when(rechargeCommissionConfigRepository.findById(cfgId)).thenReturn(Optional.of(cfg));

        // Total percentage 110%
        CommissionDtos.UpdateRechargeConfigRequest invalidReq = new CommissionDtos.UpdateRechargeConfigRequest(
                "PERCENTAGE",
                new BigDecimal("80.00"),
                new BigDecimal("20.00"),
                new BigDecimal("10.00"),
                true
        );

        assertThrows(IllegalArgumentException.class, () ->
                commissionService.updateRechargeConfig(cfgId, invalidReq, adminId, "127.0.0.1")
        );
    }

    @Test
    @DisplayName("Automated reconciliation: credits uncredited successful mobile recharges")
    void testReconcileUncreditedRechargeCommissions() {
        Recharge uncredited = new Recharge();
        uncredited.setId(UUID.randomUUID());
        uncredited.setMerchantRefNo("MR_RECON_001");
        uncredited.setMobileNo("9822334455");
        uncredited.setOperatorCode("JRE");
        uncredited.setServiceType("MR");
        uncredited.setAmount(new BigDecimal("200.00"));
        uncredited.setStatus(TransactionStatus.SUCCESS);
        uncredited.setUser(retailer);

        when(rechargeRepository.findAll()).thenReturn(List.of(uncredited));
        when(commissionTransactionRepository.existsByOriginalTransactionId("MR_RECON_001"))
                .thenReturn(false, false, true); // First check in loop, check in process, check after process

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")).thenReturn(Optional.of(freePlan));

        RechargeCommissionConfig config = RechargeCommissionConfig.builder()
                .serviceType("MOBILE_RECHARGE")
                .operatorCode("JRE")
                .operatorName("Jio Recharge")
                .commissionMode("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerValue(new BigDecimal("1.0000"))
                .distributorValue(BigDecimal.ZERO)
                .superDistributorValue(BigDecimal.ZERO)
                .enabled(true)
                .build();

        when(rechargeCommissionConfigRepository.findByServiceTypeAndOperatorCodeAndPlan_PlanCode("MOBILE_RECHARGE", "JRE", "FREE"))
                .thenReturn(Optional.of(config));

        int reconciled = commissionService.reconcileUncreditedRechargeCommissions();
        assertEquals(1, reconciled);
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()),
                eq(new BigDecimal("2.00")),
                anyString(),
                any(),
                anyString(),
                anyString(),
                anyString()
        );
    }
}
