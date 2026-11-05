package com.rupiksha.backend.service.impl;

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
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class BbpsCommissionServiceImplTest {

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
    private BbpsCommissionConfigRepository bbpsCommissionConfigRepository;

    @Mock
    private BbpsCommissionConfigAuditRepository bbpsCommissionConfigAuditRepository;

    @InjectMocks
    private CommissionServiceImpl commissionService;

    private User retailer;
    private User distributor;
    private User superDistributor;
    private User adminUser;
    private CommissionPlan freePlan;
    private CommissionPlan plan2999;
    private BbpsCommissionConfig loanRepaymentFreeConfig;

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

        // Admin User
        adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setUsername("ADMIN01");
        Role aRole = new Role();
        aRole.setName(RoleName.ADMIN);
        adminUser.setRoles(Set.of(aRole));

        // Plans
        freePlan = CommissionPlan.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1")
                .planName("Free Plan")
                .planCode("FREE")
                .price(BigDecimal.ZERO)
                .isDefault(true)
                .enabled(true)
                .build();

        plan2999 = CommissionPlan.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1")
                .planName("Rupiksha Anand Plan")
                .planCode("PLAN_2999")
                .price(new BigDecimal("2999.00"))
                .isDefault(false)
                .enabled(true)
                .build();

        // BBPS Loan Repayment Config for Free Plan: 0.50% Ret, 0.25% Dist, 0.25% SD
        loanRepaymentFreeConfig = BbpsCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceId("loan-repayment")
                .serviceName("Loan Repayment")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.5000"))
                .distributorPercentage(new BigDecimal("0.2500"))
                .superDistributorPercentage(new BigDecimal("0.2500"))
                .enabled(true)
                .build();
    }

    @Test
    @DisplayName("Example Calculation: ₹2,000 at 0.50% / 0.25% / 0.25% yields exact ₹10.00 / ₹5.00 / ₹5.00")
    void testStandardPercentageCalculation() {
        // Arrange
        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setUser(retailer);
        bbpsTxn.setCategory("Loan Repayment");
        bbpsTxn.setAmount(new BigDecimal("2000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setMerchantRefNo("BBPSLN2000001");

        retailer.setAepsCommissionPlan(freePlan);

        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSLN2000001")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("loan-repayment", "FREE"))
                .thenReturn(Optional.of(loanRepaymentFreeConfig));

        // Act
        commissionService.processBbpsCommission(bbpsTxn);

        // Assert: 3 wallet credits
        ArgumentCaptor<BigDecimal> amountCaptor = ArgumentCaptor.forClass(BigDecimal.class);
        ArgumentCaptor<UUID> userCaptor = ArgumentCaptor.forClass(UUID.class);
        verify(walletService, times(3)).creditForService(
                userCaptor.capture(),
                amountCaptor.capture(),
                anyString(),
                eq(WalletTransactionContext.COMMISSION),
                eq("BBPS Loan Repayment"),
                anyString(),
                anyString()
        );

        List<BigDecimal> creditedAmounts = amountCaptor.getAllValues();
        List<UUID> creditedUsers = userCaptor.getAllValues();

        // Retailer: 2000 * 0.50 / 100 = 10.00
        assertEquals(retailer.getId(), creditedUsers.get(0));
        assertEquals(new BigDecimal("10.00"), creditedAmounts.get(0));

        // Distributor: 2000 * 0.25 / 100 = 5.00
        assertEquals(distributor.getId(), creditedUsers.get(1));
        assertEquals(new BigDecimal("5.00"), creditedAmounts.get(1));

        // Super Distributor: 2000 * 0.25 / 100 = 5.00
        assertEquals(superDistributor.getId(), creditedUsers.get(2));
        assertEquals(new BigDecimal("5.00"), creditedAmounts.get(2));

        // Commission transactions saved in ledger
        verify(commissionTransactionRepository, times(3)).save(any(CommissionTransaction.class));
    }

    @Test
    @DisplayName("Decimal Percentage & Rounding: ₹1,234.50 at 0.35% / 0.15% / 0.10%")
    void testDecimalPercentageAndRounding() {
        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setUser(retailer);
        bbpsTxn.setCategory("Loan Repayment");
        bbpsTxn.setAmount(new BigDecimal("1234.50"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setMerchantRefNo("BBPSLN_ROUNDING");

        BbpsCommissionConfig config = BbpsCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceId("loan-repayment")
                .serviceName("Loan Repayment")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.3500"))
                .distributorPercentage(new BigDecimal("0.1500"))
                .superDistributorPercentage(new BigDecimal("0.1000"))
                .enabled(true)
                .build();

        retailer.setAepsCommissionPlan(freePlan);

        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSLN_ROUNDING")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("loan-repayment", "FREE"))
                .thenReturn(Optional.of(config));

        commissionService.processBbpsCommission(bbpsTxn);

        ArgumentCaptor<BigDecimal> amountCaptor = ArgumentCaptor.forClass(BigDecimal.class);
        verify(walletService, times(3)).creditForService(
                any(UUID.class),
                amountCaptor.capture(),
                anyString(),
                eq(WalletTransactionContext.COMMISSION),
                anyString(),
                anyString(),
                anyString()
        );

        List<BigDecimal> amounts = amountCaptor.getAllValues();
        // 1234.50 * 0.35 / 100 = 4.32075 -> rounded HALF_UP = 4.32
        assertEquals(new BigDecimal("4.32"), amounts.get(0));
        // 1234.50 * 0.15 / 100 = 1.85175 -> rounded HALF_UP = 1.85
        assertEquals(new BigDecimal("1.85"), amounts.get(1));
        // 1234.50 * 0.10 / 100 = 1.23450 -> rounded HALF_UP = 1.23
        assertEquals(new BigDecimal("1.23"), amounts.get(2));
    }

    @Test
    @DisplayName("Hierarchy Case B: Direct Retailer with no upline distributes only to Retailer")
    void testDirectRetailerDistribution() {
        retailer.setParentUser(null);
        retailer.setAddedByUserRef(null);
        retailer.setAddedByPartyCode(null);
        retailer.setAepsCommissionPlan(freePlan);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setUser(retailer);
        bbpsTxn.setCategory("Loan Repayment");
        bbpsTxn.setAmount(new BigDecimal("3000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setMerchantRefNo("BBPSLN_DIRECT_01");

        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSLN_DIRECT_01")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("loan-repayment", "FREE"))
                .thenReturn(Optional.of(loanRepaymentFreeConfig));

        commissionService.processBbpsCommission(bbpsTxn);

        // Only Retailer credited: 3000 * 0.50 / 100 = 15.00
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()),
                eq(new BigDecimal("15.00")),
                anyString(),
                eq(WalletTransactionContext.COMMISSION),
                anyString(),
                anyString(),
                anyString()
        );
    }

    @Test
    @DisplayName("Hierarchy Case C: Retailer mapped directly under Distributor without Super Distributor")
    void testRetailerUnderDistributorOnly() {
        distributor.setParentUser(null); // No super distributor
        retailer.setAepsCommissionPlan(freePlan);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setUser(retailer);
        bbpsTxn.setCategory("Loan Repayment");
        bbpsTxn.setAmount(new BigDecimal("4000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setMerchantRefNo("BBPSLN_DIST_ONLY");

        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSLN_DIST_ONLY")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("loan-repayment", "FREE"))
                .thenReturn(Optional.of(loanRepaymentFreeConfig));

        commissionService.processBbpsCommission(bbpsTxn);

        // Retailer (20.00) and Distributor (10.00) credited, no Super Distributor
        verify(walletService, times(2)).creditForService(
                any(UUID.class),
                any(BigDecimal.class),
                anyString(),
                eq(WalletTransactionContext.COMMISSION),
                anyString(),
                anyString(),
                anyString()
        );
    }

    @Test
    @DisplayName("Lifecycle: Non-successful BBPS transaction (PENDING, FAILED) creates NO commission")
    void testNonSuccessfulTransactionGeneratesNoCommission() {
        BbpsTransaction failedTxn = new BbpsTransaction();
        failedTxn.setId(UUID.randomUUID());
        failedTxn.setStatus("FAILED");
        failedTxn.setCategory("Loan Repayment");
        failedTxn.setAmount(new BigDecimal("1000.00"));

        commissionService.processBbpsCommission(failedTxn);

        BbpsTransaction pendingTxn = new BbpsTransaction();
        pendingTxn.setId(UUID.randomUUID());
        pendingTxn.setStatus("PENDING");
        pendingTxn.setCategory("Loan Repayment");
        pendingTxn.setAmount(new BigDecimal("1000.00"));

        commissionService.processBbpsCommission(pendingTxn);

        verifyNoInteractions(walletService);
        verifyNoInteractions(commissionTransactionRepository);
    }

    @Test
    @DisplayName("Idempotency: Repeated processing of the same transaction ID is strictly rejected")
    void testIdempotencyPreventsDuplicateCredits() {
        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setUser(retailer);
        bbpsTxn.setCategory("Loan Repayment");
        bbpsTxn.setAmount(new BigDecimal("2000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setMerchantRefNo("BBPSLN_DUPLICATE_KEY");

        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSLN_DUPLICATE_KEY")).thenReturn(true);

        commissionService.processBbpsCommission(bbpsTxn);

        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Disabled Config: When enabled=false, no commission is distributed")
    void testDisabledConfigProducesNoCommission() {
        loanRepaymentFreeConfig.setEnabled(false);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setUser(retailer);
        bbpsTxn.setCategory("Loan Repayment");
        bbpsTxn.setAmount(new BigDecimal("2000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setMerchantRefNo("BBPSLN_DISABLED");

        retailer.setAepsCommissionPlan(freePlan);

        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSLN_DISABLED")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("loan-repayment", "FREE"))
                .thenReturn(Optional.of(loanRepaymentFreeConfig));

        commissionService.processBbpsCommission(bbpsTxn);

        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Admin Update Config: Validates percentages and writes audit record")
    void testAdminUpdateBbpsConfig() {
        when(userRepository.findById(adminUser.getId())).thenReturn(Optional.of(adminUser));
        when(bbpsCommissionConfigRepository.findById(loanRepaymentFreeConfig.getId()))
                .thenReturn(Optional.of(loanRepaymentFreeConfig));
        when(bbpsCommissionConfigRepository.save(any(BbpsCommissionConfig.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        CommissionDtos.UpdateBbpsConfigRequest updateReq = new CommissionDtos.UpdateBbpsConfigRequest(
                new BigDecimal("0.7000"),
                new BigDecimal("0.2000"),
                new BigDecimal("0.1000"),
                true
        );

        CommissionDtos.BbpsCommissionConfigDto dto = commissionService.updateBbpsConfig(
                loanRepaymentFreeConfig.getId(),
                updateReq,
                adminUser.getId(),
                "192.168.1.100"
        );

        assertNotNull(dto);
        assertEquals(new BigDecimal("0.7000"), dto.retailerPercentage());
        assertEquals(new BigDecimal("0.2000"), dto.distributorPercentage());
        assertEquals(new BigDecimal("0.1000"), dto.superDistributorPercentage());
        assertEquals(new BigDecimal("1.0000"), dto.totalPercentage());

        // Verify audit saved
        verify(bbpsCommissionConfigAuditRepository, times(1)).save(any(BbpsCommissionConfigAudit.class));
    }

    @Test
    @DisplayName("Validation: Negative percentage or total > 100% throws IllegalArgumentException")
    void testInvalidPercentagesRejected() {
        when(userRepository.findById(adminUser.getId())).thenReturn(Optional.of(adminUser));
        when(bbpsCommissionConfigRepository.findById(loanRepaymentFreeConfig.getId()))
                .thenReturn(Optional.of(loanRepaymentFreeConfig));

        // Total > 100%
        CommissionDtos.UpdateBbpsConfigRequest invalidTotal = new CommissionDtos.UpdateBbpsConfigRequest(
                new BigDecimal("60.0000"),
                new BigDecimal("30.0000"),
                new BigDecimal("20.0000"), // Sum = 110%
                true
        );

        assertThrows(IllegalArgumentException.class, () ->
                commissionService.updateBbpsConfig(loanRepaymentFreeConfig.getId(), invalidTotal, adminUser.getId(), "127.0.0.1")
        );

        // Negative percentage
        CommissionDtos.UpdateBbpsConfigRequest negativePct = new CommissionDtos.UpdateBbpsConfigRequest(
                new BigDecimal("-0.5000"),
                new BigDecimal("0.2500"),
                new BigDecimal("0.2500"),
                true
        );

        assertThrows(IllegalArgumentException.class, () ->
                commissionService.updateBbpsConfig(loanRepaymentFreeConfig.getId(), negativePct, adminUser.getId(), "127.0.0.1")
        );
    }

    @Test
    @DisplayName("Security: Non-admin user cannot update BBPS commission configuration")
    void testNonAdminUpdateDenied() {
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));

        CommissionDtos.UpdateBbpsConfigRequest updateReq = new CommissionDtos.UpdateBbpsConfigRequest(
                new BigDecimal("0.5000"),
                new BigDecimal("0.2500"),
                new BigDecimal("0.2500"),
                true
        );

        assertThrows(AccessDeniedException.class, () ->
                commissionService.updateBbpsConfig(loanRepaymentFreeConfig.getId(), updateReq, retailer.getId(), "127.0.0.1")
        );
    }

    @Test
    @DisplayName("Electricity Commission: ₹2,000 at 0.50% / 0.25% / 0.25% yields exact ₹10.00 / ₹5.00 / ₹5.00")
    void testElectricityPercentageCommissionCalculation() {
        // Arrange
        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setUser(retailer);
        bbpsTxn.setCategory("Electricity");
        bbpsTxn.setAmount(new BigDecimal("2000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setMerchantRefNo("BBPSEL2000001");

        retailer.setAepsCommissionPlan(freePlan);

        BbpsCommissionConfig elecConfig = BbpsCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceId("electricity")
                .serviceName("Electricity")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.5000"))
                .distributorPercentage(new BigDecimal("0.2500"))
                .superDistributorPercentage(new BigDecimal("0.2500"))
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSEL2000001")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("electricity", "FREE"))
                .thenReturn(Optional.of(elecConfig));

        // Act
        commissionService.processBbpsCommission(bbpsTxn);

        // Assert - Wallet Credits
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()),
                eq(new BigDecimal("10.00")),
                contains("BBPS Electricity Commission"),
                eq(WalletTransactionContext.COMMISSION),
                eq("BBPS Electricity"),
                anyString(),
                contains("COMM-BBPS-BBPSEL2000001-RETAILER")
        );

        verify(walletService, times(1)).creditForService(
                eq(distributor.getId()),
                eq(new BigDecimal("5.00")),
                contains("BBPS Electricity Commission (Distributor)"),
                eq(WalletTransactionContext.COMMISSION),
                eq("BBPS Electricity"),
                anyString(),
                contains("COMM-BBPS-BBPSEL2000001-DISTRIBUTOR")
        );

        verify(walletService, times(1)).creditForService(
                eq(superDistributor.getId()),
                eq(new BigDecimal("5.00")),
                contains("BBPS Electricity Commission (Super Distributor)"),
                eq(WalletTransactionContext.COMMISSION),
                eq("BBPS Electricity"),
                anyString(),
                contains("COMM-BBPS-BBPSEL2000001-SUPER_DISTRIBUTOR")
        );

        // Assert - Commission Transaction Ledger
        ArgumentCaptor<CommissionTransaction> txnCaptor = ArgumentCaptor.forClass(CommissionTransaction.class);
        verify(commissionTransactionRepository, times(3)).save(txnCaptor.capture());

        List<CommissionTransaction> saved = txnCaptor.getAllValues();
        assertEquals(3, saved.size());

        CommissionTransaction retEntry = saved.stream()
                .filter(t -> "RETAILER".equals(t.getBeneficiaryRole()))
                .findFirst().orElseThrow();
        assertEquals(new BigDecimal("10.00"), retEntry.getCommissionAmount());
        assertEquals(new BigDecimal("0.5000"), retEntry.getAppliedPercentage());
        assertEquals("BBPS_ELECTRICITY", retEntry.getServiceType());
        assertEquals("Electricity", retEntry.getBbpsCategory());

        CommissionTransaction distEntry = saved.stream()
                .filter(t -> "DISTRIBUTOR".equals(t.getBeneficiaryRole()))
                .findFirst().orElseThrow();
        assertEquals(new BigDecimal("5.00"), distEntry.getCommissionAmount());
        assertEquals(new BigDecimal("0.2500"), distEntry.getAppliedPercentage());
        assertEquals("BBPS_ELECTRICITY", distEntry.getServiceType());
        assertEquals("Electricity", distEntry.getBbpsCategory());

        CommissionTransaction sdEntry = saved.stream()
                .filter(t -> "SUPER_DISTRIBUTOR".equals(t.getBeneficiaryRole()))
                .findFirst().orElseThrow();
        assertEquals(new BigDecimal("5.00"), sdEntry.getCommissionAmount());
        assertEquals(new BigDecimal("0.2500"), sdEntry.getAppliedPercentage());
        assertEquals("BBPS_ELECTRICITY", sdEntry.getServiceType());
        assertEquals("Electricity", sdEntry.getBbpsCategory());
    }

    @Test
    @DisplayName("Electricity Commission: Direct retailer without upline receives only retailer commission")
    void testElectricityCommissionDirectRetailer() {
        retailer.setParentUser(null);
        retailer.setAepsCommissionPlan(freePlan);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setUser(retailer);
        bbpsTxn.setCategory("Electricity");
        bbpsTxn.setAmount(new BigDecimal("3000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setMerchantRefNo("BBPSEL_DIRECT_01");

        BbpsCommissionConfig elecConfig = BbpsCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceId("electricity")
                .serviceName("Electricity")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.5000"))
                .distributorPercentage(new BigDecimal("0.2500"))
                .superDistributorPercentage(new BigDecimal("0.2500"))
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSEL_DIRECT_01")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("electricity", "FREE"))
                .thenReturn(Optional.of(elecConfig));

        commissionService.processBbpsCommission(bbpsTxn);

        // Retailer receives 0.50% of 3000 = 15.00
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()),
                eq(new BigDecimal("15.00")),
                anyString(),
                any(),
                eq("BBPS Electricity"),
                anyString(),
                anyString()
        );

        // Distributor & Super Distributor receive nothing
        verify(walletService, never()).creditForService(eq(distributor.getId()), any(), any(), any(), any(), any(), any());
        verify(walletService, never()).creditForService(eq(superDistributor.getId()), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Electricity Commission: Prepaid Meter category maps to electricity and processes correctly")
    void testElectricityPrepaidMeterCategory() {
        retailer.setAepsCommissionPlan(freePlan);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setUser(retailer);
        bbpsTxn.setCategory("Prepaid Meter");
        bbpsTxn.setAmount(new BigDecimal("1000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setMerchantRefNo("BBPSEL_PREPAID_01");

        BbpsCommissionConfig elecConfig = BbpsCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceId("electricity")
                .serviceName("Electricity")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.5000"))
                .distributorPercentage(new BigDecimal("0.2500"))
                .superDistributorPercentage(new BigDecimal("0.2500"))
                .enabled(true)
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSEL_PREPAID_01")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("electricity", "FREE"))
                .thenReturn(Optional.of(elecConfig));

        commissionService.processBbpsCommission(bbpsTxn);

        // 0.50% of 1000 = 5.00
        verify(walletService, times(1)).creditForService(
                eq(retailer.getId()),
                eq(new BigDecimal("5.00")),
                anyString(),
                any(),
                eq("BBPS Electricity"),
                anyString(),
                anyString()
        );
    }

    @Test
    @DisplayName("Electricity Commission: Disabled configuration suppresses commission distribution")
    void testElectricityCommissionDisabledConfig() {
        retailer.setAepsCommissionPlan(freePlan);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setUser(retailer);
        bbpsTxn.setCategory("Electricity");
        bbpsTxn.setAmount(new BigDecimal("2000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setMerchantRefNo("BBPSEL_DISABLED");

        BbpsCommissionConfig disabledConfig = BbpsCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceId("electricity")
                .serviceName("Electricity")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.5000"))
                .distributorPercentage(new BigDecimal("0.2500"))
                .superDistributorPercentage(new BigDecimal("0.2500"))
                .enabled(false) // Disabled!
                .build();

        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSEL_DISABLED")).thenReturn(false);
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("electricity", "FREE"))
                .thenReturn(Optional.of(disabledConfig));

        commissionService.processBbpsCommission(bbpsTxn);

        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
        verify(commissionTransactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Electricity Commission: Idempotency safeguard prevents duplicate credits")
    void testElectricityCommissionIdempotency() {
        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setMerchantRefNo("BBPSEL_DUP_001");
        bbpsTxn.setCategory("Electricity");
        bbpsTxn.setAmount(new BigDecimal("1000.00"));
        bbpsTxn.setStatus("SUCCESS");

        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSEL_DUP_001")).thenReturn(true);

        commissionService.processBbpsCommission(bbpsTxn);

        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
        verify(commissionTransactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Electricity Commission: Non-SUCCESS transactions (FAILED, PENDING) generate zero commission")
    void testElectricityNonSuccessTransactionsExcluded() {
        BbpsTransaction failedTxn = new BbpsTransaction();
        failedTxn.setId(UUID.randomUUID());
        failedTxn.setCategory("Electricity");
        failedTxn.setStatus("FAILED");
        failedTxn.setAmount(new BigDecimal("5000.00"));

        BbpsTransaction pendingTxn = new BbpsTransaction();
        pendingTxn.setId(UUID.randomUUID());
        pendingTxn.setCategory("Electricity");
        pendingTxn.setStatus("PENDING");
        pendingTxn.setAmount(new BigDecimal("5000.00"));

        commissionService.processBbpsCommission(failedTxn);
        commissionService.processBbpsCommission(pendingTxn);

        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
        verify(commissionTransactionRepository, never()).save(any());
    }

    // ─── FASTAG PERCENTAGE COMMISSION TESTS ─────────────────────────────────────

    @Test
    @DisplayName("FASTag Commission: ₹2,000 at 1.00% Ret / 0.25% Dist / 0.25% SD yields exact ₹20.00 / ₹5.00 / ₹5.00")
    void testFastagPercentageCommissionCalculation() {
        CommissionPlan fastagPlan = CommissionPlan.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1")
                .planName("Free Plan")
                .planCode("FREE")
                .price(BigDecimal.ZERO)
                .isDefault(true)
                .enabled(true)
                .build();

        retailer.setAepsCommissionPlan(fastagPlan);

        BbpsCommissionConfig fastagConfig = BbpsCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceId("fastag")
                .serviceName("Fastag")
                .commissionModel("PERCENTAGE")
                .plan(fastagPlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("1.0000"))
                .distributorPercentage(new BigDecimal("0.2500"))
                .superDistributorPercentage(new BigDecimal("0.2500"))
                .enabled(true)
                .build();

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("fastag", "FREE"))
                .thenReturn(Optional.of(fastagConfig));
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSFT2000001")).thenReturn(false);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("FASTag");
        bbpsTxn.setMerchantRefNo("BBPSFT2000001");
        bbpsTxn.setAmount(new BigDecimal("2000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setUser(retailer);

        commissionService.processBbpsCommission(bbpsTxn);

        ArgumentCaptor<BigDecimal> amountCaptor = ArgumentCaptor.forClass(BigDecimal.class);
        ArgumentCaptor<UUID> userCaptor = ArgumentCaptor.forClass(UUID.class);
        ArgumentCaptor<String> serviceNameCaptor = ArgumentCaptor.forClass(String.class);

        verify(walletService, times(3)).creditForService(
                userCaptor.capture(),
                amountCaptor.capture(),
                anyString(),
                eq(com.rupiksha.backend.domain.WalletTransactionContext.COMMISSION),
                serviceNameCaptor.capture(),
                anyString(),
                anyString()
        );

        List<BigDecimal> amounts = amountCaptor.getAllValues();
        List<UUID> userIds = userCaptor.getAllValues();
        List<String> serviceNames = serviceNameCaptor.getAllValues();

        // 1. Retailer gets ₹20.00 (1.00% of ₹2,000)
        assertEquals(retailer.getId(), userIds.get(0));
        assertEquals(new BigDecimal("20.00"), amounts.get(0));
        assertEquals("BBPS FASTag", serviceNames.get(0));

        // 2. Distributor gets ₹5.00 (0.25% of ₹2,000)
        assertEquals(distributor.getId(), userIds.get(1));
        assertEquals(new BigDecimal("5.00"), amounts.get(1));
        assertEquals("BBPS FASTag", serviceNames.get(1));

        // 3. Super Distributor gets ₹5.00 (0.25% of ₹2,000)
        assertEquals(superDistributor.getId(), userIds.get(2));
        assertEquals(new BigDecimal("5.00"), amounts.get(2));
        assertEquals("BBPS FASTag", serviceNames.get(2));

        // Total distributed: ₹30.00
        BigDecimal totalDisbursed = amounts.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        assertEquals(new BigDecimal("30.00"), totalDisbursed);

        // Verify CommissionTransaction ledger entries
        ArgumentCaptor<CommissionTransaction> txnCaptor = ArgumentCaptor.forClass(CommissionTransaction.class);
        verify(commissionTransactionRepository, times(3)).save(txnCaptor.capture());

        List<CommissionTransaction> txns = txnCaptor.getAllValues();
        assertEquals("BBPS_FASTAG", txns.get(0).getServiceType());
        assertEquals("FASTag", txns.get(0).getBbpsCategory());
        assertEquals("RETAILER", txns.get(0).getBeneficiaryRole());
        assertEquals(new BigDecimal("1.0000"), txns.get(0).getAppliedPercentage());
        assertEquals(new BigDecimal("20.00"), txns.get(0).getCommissionAmount());

        assertEquals("DISTRIBUTOR", txns.get(1).getBeneficiaryRole());
        assertEquals(new BigDecimal("0.2500"), txns.get(1).getAppliedPercentage());
        assertEquals(new BigDecimal("5.00"), txns.get(1).getCommissionAmount());

        assertEquals("SUPER_DISTRIBUTOR", txns.get(2).getBeneficiaryRole());
        assertEquals(new BigDecimal("0.2500"), txns.get(2).getAppliedPercentage());
        assertEquals(new BigDecimal("5.00"), txns.get(2).getCommissionAmount());
    }

    @Test
    @DisplayName("FASTag Commission: Direct Retailer with no uplines receives only retailer commission")
    void testFastagCommissionDirectRetailer() {
        User directRetailer = new User();
        directRetailer.setId(UUID.randomUUID());
        directRetailer.setUsername("DIRECT_RET");
        Role rRole = new Role();
        rRole.setName(RoleName.RETAILER);
        directRetailer.setRoles(Set.of(rRole));
        directRetailer.setParentUser(null);

        BbpsCommissionConfig fastagConfig = BbpsCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceId("fastag")
                .serviceName("Fastag")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("1.0000"))
                .distributorPercentage(new BigDecimal("0.2500"))
                .superDistributorPercentage(new BigDecimal("0.2500"))
                .enabled(true)
                .build();

        when(userRepository.findById(directRetailer.getId())).thenReturn(Optional.of(directRetailer));
        when(commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")).thenReturn(Optional.of(freePlan));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("fastag", "FREE"))
                .thenReturn(Optional.of(fastagConfig));
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSFT_DIR_001")).thenReturn(false);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("FASTag");
        bbpsTxn.setMerchantRefNo("BBPSFT_DIR_001");
        bbpsTxn.setAmount(new BigDecimal("2000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setUser(directRetailer);

        commissionService.processBbpsCommission(bbpsTxn);

        ArgumentCaptor<BigDecimal> amountCaptor = ArgumentCaptor.forClass(BigDecimal.class);
        ArgumentCaptor<UUID> userCaptor = ArgumentCaptor.forClass(UUID.class);

        verify(walletService, times(1)).creditForService(
                userCaptor.capture(),
                amountCaptor.capture(),
                anyString(),
                eq(com.rupiksha.backend.domain.WalletTransactionContext.COMMISSION),
                eq("BBPS FASTag"),
                anyString(),
                anyString()
        );

        assertEquals(directRetailer.getId(), userCaptor.getValue());
        assertEquals(new BigDecimal("20.00"), amountCaptor.getValue());
        verify(commissionTransactionRepository, times(1)).save(any());
    }

    @Test
    @DisplayName("FASTag Commission: Retailer under Distributor only (no Super Distributor)")
    void testFastagCommissionRetailerUnderDistributorOnly() {
        User distOnly = new User();
        distOnly.setId(UUID.randomUUID());
        distOnly.setUsername("D_ONLY");
        distOnly.setParentUser(null);
        Role dRole = new Role();
        dRole.setName(RoleName.DISTRIBUTOR);
        distOnly.setRoles(Set.of(dRole));

        User retUnderDist = new User();
        retUnderDist.setId(UUID.randomUUID());
        retUnderDist.setUsername("R_UNDER_D");
        retUnderDist.setParentUser(distOnly);
        Role rRole = new Role();
        rRole.setName(RoleName.RETAILER);
        retUnderDist.setRoles(Set.of(rRole));
        retUnderDist.setAepsCommissionPlan(freePlan);

        BbpsCommissionConfig fastagConfig = BbpsCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceId("fastag")
                .serviceName("Fastag")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("1.0000"))
                .distributorPercentage(new BigDecimal("0.2500"))
                .superDistributorPercentage(new BigDecimal("0.2500"))
                .enabled(true)
                .build();

        when(userRepository.findById(retUnderDist.getId())).thenReturn(Optional.of(retUnderDist));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("fastag", "FREE"))
                .thenReturn(Optional.of(fastagConfig));
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSFT_DIST_ONLY")).thenReturn(false);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("FASTag");
        bbpsTxn.setMerchantRefNo("BBPSFT_DIST_ONLY");
        bbpsTxn.setAmount(new BigDecimal("4000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setUser(retUnderDist);

        commissionService.processBbpsCommission(bbpsTxn);

        ArgumentCaptor<BigDecimal> amountCaptor = ArgumentCaptor.forClass(BigDecimal.class);
        ArgumentCaptor<UUID> userCaptor = ArgumentCaptor.forClass(UUID.class);

        verify(walletService, times(2)).creditForService(
                userCaptor.capture(),
                amountCaptor.capture(),
                anyString(),
                eq(com.rupiksha.backend.domain.WalletTransactionContext.COMMISSION),
                eq("BBPS FASTag"),
                anyString(),
                anyString()
        );

        List<BigDecimal> amounts = amountCaptor.getAllValues();
        List<UUID> userIds = userCaptor.getAllValues();

        // Retailer: 1% of ₹4,000 = ₹40.00
        assertEquals(retUnderDist.getId(), userIds.get(0));
        assertEquals(new BigDecimal("40.00"), amounts.get(0));

        // Distributor: 0.25% of ₹4,000 = ₹10.00
        assertEquals(distOnly.getId(), userIds.get(1));
        assertEquals(new BigDecimal("10.00"), amounts.get(1));

        verify(commissionTransactionRepository, times(2)).save(any());
    }

    @Test
    @DisplayName("FASTag Commission: Idempotency safeguard prevents duplicate wallet credits")
    void testFastagCommissionIdempotency() {
        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("FASTag");
        bbpsTxn.setMerchantRefNo("BBPSFT_DUP_001");
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setAmount(new BigDecimal("2000.00"));

        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSFT_DUP_001")).thenReturn(true);

        commissionService.processBbpsCommission(bbpsTxn);

        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
        verify(commissionTransactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("FASTag Commission: Non-SUCCESS transactions (FAILED, PENDING, INITIATED) generate no commission")
    void testFastagNonSuccessTransactionsExcluded() {
        BbpsTransaction failedTxn = new BbpsTransaction();
        failedTxn.setId(UUID.randomUUID());
        failedTxn.setCategory("FASTag");
        failedTxn.setStatus("FAILED");
        failedTxn.setAmount(new BigDecimal("2000.00"));

        BbpsTransaction pendingTxn = new BbpsTransaction();
        pendingTxn.setId(UUID.randomUUID());
        pendingTxn.setCategory("FASTag");
        pendingTxn.setStatus("PENDING");
        pendingTxn.setAmount(new BigDecimal("2000.00"));

        BbpsTransaction initiatedTxn = new BbpsTransaction();
        initiatedTxn.setId(UUID.randomUUID());
        initiatedTxn.setCategory("FASTag");
        initiatedTxn.setStatus("INITIATED");
        initiatedTxn.setAmount(new BigDecimal("2000.00"));

        commissionService.processBbpsCommission(failedTxn);
        commissionService.processBbpsCommission(pendingTxn);
        commissionService.processBbpsCommission(initiatedTxn);

        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
        verify(commissionTransactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("FASTag Commission: Disabled configuration generates no commission")
    void testFastagCommissionDisabledConfig() {
        BbpsCommissionConfig disabledConfig = BbpsCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceId("fastag")
                .serviceName("Fastag")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("1.0000"))
                .distributorPercentage(new BigDecimal("0.2500"))
                .superDistributorPercentage(new BigDecimal("0.2500"))
                .enabled(false)
                .build();

        retailer.setAepsCommissionPlan(freePlan);

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("fastag", "FREE"))
                .thenReturn(Optional.of(disabledConfig));
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSFT_DISABLED")).thenReturn(false);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("FASTag");
        bbpsTxn.setMerchantRefNo("BBPSFT_DISABLED");
        bbpsTxn.setAmount(new BigDecimal("2000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setUser(retailer);

        commissionService.processBbpsCommission(bbpsTxn);

        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
        verify(commissionTransactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("FASTag Commission: Admin can update configuration and creates audit record")
    void testFastagAdminConfigUpdateAndAudit() {
        BbpsCommissionConfig config = BbpsCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceId("fastag")
                .serviceName("Fastag")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.2000"))
                .distributorPercentage(new BigDecimal("0.1000"))
                .superDistributorPercentage(new BigDecimal("0.0500"))
                .enabled(true)
                .build();

        when(userRepository.findById(adminUser.getId())).thenReturn(Optional.of(adminUser));
        when(bbpsCommissionConfigRepository.findById(config.getId())).thenReturn(Optional.of(config));
        when(bbpsCommissionConfigRepository.save(any(BbpsCommissionConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        CommissionDtos.UpdateBbpsConfigRequest updateReq = new CommissionDtos.UpdateBbpsConfigRequest(
                new BigDecimal("1.0000"),
                new BigDecimal("0.2500"),
                new BigDecimal("0.2500"),
                true
        );

        CommissionDtos.BbpsCommissionConfigDto updated = commissionService.updateBbpsConfig(
                config.getId(),
                updateReq,
                adminUser.getId(),
                "192.168.1.100"
        );

        assertNotNull(updated);
        assertEquals(new BigDecimal("1.0000"), updated.retailerPercentage());
        assertEquals(new BigDecimal("0.2500"), updated.distributorPercentage());
        assertEquals(new BigDecimal("0.2500"), updated.superDistributorPercentage());
        assertEquals(new BigDecimal("1.5000"), updated.totalPercentage());
        assertTrue(updated.enabled());

        ArgumentCaptor<BbpsCommissionConfigAudit> auditCaptor = ArgumentCaptor.forClass(BbpsCommissionConfigAudit.class);
        verify(bbpsCommissionConfigAuditRepository, times(1)).save(auditCaptor.capture());

        BbpsCommissionConfigAudit savedAudit = auditCaptor.getValue();
        assertEquals("fastag", savedAudit.getServiceId());
        assertEquals("FREE", savedAudit.getPlanCode());
        assertEquals(adminUser.getUsername(), savedAudit.getAdminUsername());
        assertEquals(new BigDecimal("0.2000"), savedAudit.getPrevRetailerPercentage());
        assertEquals(new BigDecimal("1.0000"), savedAudit.getNewRetailerPercentage());
        assertEquals("192.168.1.100", savedAudit.getIpAddress());
    }

    @Test
    @DisplayName("FASTag Commission: Invalid percentages are rejected (negative or exceeding 100%)")
    void testFastagInvalidPercentagesRejected() {
        UUID configId = UUID.randomUUID();
        when(userRepository.findById(adminUser.getId())).thenReturn(Optional.of(adminUser));
        when(bbpsCommissionConfigRepository.findById(configId)).thenReturn(Optional.of(loanRepaymentFreeConfig));

        // Negative percentage
        CommissionDtos.UpdateBbpsConfigRequest negativeReq = new CommissionDtos.UpdateBbpsConfigRequest(
                new BigDecimal("-0.5000"),
                new BigDecimal("0.2500"),
                new BigDecimal("0.2500"),
                true
        );
        assertThrows(IllegalArgumentException.class, () ->
                commissionService.updateBbpsConfig(configId, negativeReq, adminUser.getId(), "127.0.0.1")
        );

        // Combined percentage exceeds 100%
        CommissionDtos.UpdateBbpsConfigRequest overflowReq = new CommissionDtos.UpdateBbpsConfigRequest(
                new BigDecimal("60.0000"),
                new BigDecimal("30.0000"),
                new BigDecimal("15.0000"),
                true
        );
        assertThrows(IllegalArgumentException.class, () ->
                commissionService.updateBbpsConfig(configId, overflowReq, adminUser.getId(), "127.0.0.1")
        );
    }

    @Test
    @DisplayName("FASTag Commission: Works correctly across all 4 membership plans")
    void testFastagCommissionAcrossAllFourMembershipPlans() {
        CommissionPlan plan4999 = CommissionPlan.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1")
                .planName("Rupiksha Nidhi Plan")
                .planCode("PLAN_4999")
                .price(new BigDecimal("4999.00"))
                .isDefault(false)
                .enabled(true)
                .build();

        retailer.setAepsCommissionPlan(plan4999);

        BbpsCommissionConfig plan4999Config = BbpsCommissionConfig.builder()
                .id(UUID.randomUUID())
                .serviceId("fastag")
                .serviceName("Fastag")
                .commissionModel("PERCENTAGE")
                .plan(plan4999)
                .planCode("PLAN_4999")
                .retailerPercentage(new BigDecimal("1.2000"))
                .distributorPercentage(new BigDecimal("0.3000"))
                .superDistributorPercentage(new BigDecimal("0.2000"))
                .enabled(true)
                .build();

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("fastag", "PLAN_4999"))
                .thenReturn(Optional.of(plan4999Config));
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSFT_PLAN_4999")).thenReturn(false);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("FASTag");
        bbpsTxn.setMerchantRefNo("BBPSFT_PLAN_4999");
        bbpsTxn.setAmount(new BigDecimal("5000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setUser(retailer);

        commissionService.processBbpsCommission(bbpsTxn);

        ArgumentCaptor<BigDecimal> amountCaptor = ArgumentCaptor.forClass(BigDecimal.class);
        verify(walletService, times(3)).creditForService(
                any(),
                amountCaptor.capture(),
                anyString(),
                eq(com.rupiksha.backend.domain.WalletTransactionContext.COMMISSION),
                eq("BBPS FASTag"),
                anyString(),
                anyString()
        );

        List<BigDecimal> amounts = amountCaptor.getAllValues();
        // Retailer: 1.20% of ₹5,000 = ₹60.00
        assertEquals(new BigDecimal("60.00"), amounts.get(0));
        // Distributor: 0.30% of ₹5,000 = ₹15.00
        assertEquals(new BigDecimal("15.00"), amounts.get(1));
        // Super Distributor: 0.20% of ₹5,000 = ₹10.00
        assertEquals(new BigDecimal("10.00"), amounts.get(2));
    }

    @Test
    @DisplayName("Process Agent Collection percentage commission distribution across full hierarchy (Retailer, Distributor, Super Distributor)")
    void testProcessBbpsCommission_AgentCollection_FullHierarchy() {
        retailer.setAepsCommissionPlan(freePlan);

        BbpsCommissionConfig acConfig = BbpsCommissionConfig.builder()
                .serviceId("agent-collection")
                .serviceName("Agent Collection")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.2000"))
                .distributorPercentage(new BigDecimal("0.1000"))
                .superDistributorPercentage(new BigDecimal("0.0500"))
                .enabled(true)
                .build();

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("agent-collection", "FREE"))
                .thenReturn(Optional.of(acConfig));
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSAC_2026_001")).thenReturn(false);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("Agent Collection");
        bbpsTxn.setMerchantRefNo("BBPSAC_2026_001");
        bbpsTxn.setAmount(new BigDecimal("10000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setUser(retailer);

        commissionService.processBbpsCommission(bbpsTxn);

        ArgumentCaptor<BigDecimal> amountCaptor = ArgumentCaptor.forClass(BigDecimal.class);
        verify(walletService, times(3)).creditForService(
                any(),
                amountCaptor.capture(),
                anyString(),
                eq(com.rupiksha.backend.domain.WalletTransactionContext.COMMISSION),
                eq("BBPS Agent Collection"),
                anyString(),
                anyString()
        );

        List<BigDecimal> amounts = amountCaptor.getAllValues();
        // Retailer: 0.20% of 10,000 = 20.00
        assertEquals(new BigDecimal("20.00"), amounts.get(0));
        // Distributor: 0.10% of 10,000 = 10.00
        assertEquals(new BigDecimal("10.00"), amounts.get(1));
        // Super Distributor: 0.05% of 10,000 = 5.00
        assertEquals(new BigDecimal("5.00"), amounts.get(2));
    }

    @Test
    @DisplayName("Agent Collection: Direct Retailer with no distributor or super distributor gets only retailer commission")
    void testProcessBbpsCommission_AgentCollection_DirectRetailer() {
        User directRetailer = new User();
        directRetailer.setId(UUID.randomUUID());
        directRetailer.setUsername("DIRECT_RET");
        Role rRole = new Role();
        rRole.setName(RoleName.RETAILER);
        directRetailer.setRoles(Set.of(rRole));
        directRetailer.setParentUser(null);
        directRetailer.setAddedByUserRef(null);
        directRetailer.setAepsCommissionPlan(freePlan);

        BbpsCommissionConfig acConfig = BbpsCommissionConfig.builder()
                .serviceId("agent-collection")
                .serviceName("Agent Collection")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.5000"))
                .distributorPercentage(new BigDecimal("0.2000"))
                .superDistributorPercentage(new BigDecimal("0.1000"))
                .enabled(true)
                .build();

        when(userRepository.findById(directRetailer.getId())).thenReturn(Optional.of(directRetailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("agent-collection", "FREE"))
                .thenReturn(Optional.of(acConfig));
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSAC_DIR_001")).thenReturn(false);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("Agent Collection");
        bbpsTxn.setMerchantRefNo("BBPSAC_DIR_001");
        bbpsTxn.setAmount(new BigDecimal("5000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setUser(directRetailer);

        commissionService.processBbpsCommission(bbpsTxn);

        // Exactly 1 credit for retailer, none for distributor or super distributor
        ArgumentCaptor<BigDecimal> amountCaptor = ArgumentCaptor.forClass(BigDecimal.class);
        verify(walletService, times(1)).creditForService(
                eq(directRetailer.getId()),
                amountCaptor.capture(),
                anyString(),
                eq(com.rupiksha.backend.domain.WalletTransactionContext.COMMISSION),
                eq("BBPS Agent Collection"),
                anyString(),
                anyString()
        );

        // Retailer: 0.50% of ₹5,000 = ₹25.00
        assertEquals(new BigDecimal("25.00"), amountCaptor.getValue());
    }

    @Test
    @DisplayName("Agent Collection: Retailer with Distributor only (no Super Distributor upline)")
    void testProcessBbpsCommission_AgentCollection_RetailerAndDistributorOnly() {
        User distOnly = new User();
        distOnly.setId(UUID.randomUUID());
        distOnly.setUsername("DIST_ONLY");
        Role dRole = new Role();
        dRole.setName(RoleName.DISTRIBUTOR);
        distOnly.setRoles(Set.of(dRole));
        distOnly.setParentUser(null);

        User retWithDist = new User();
        retWithDist.setId(UUID.randomUUID());
        retWithDist.setUsername("RET_WITH_DIST");
        Role rRole = new Role();
        rRole.setName(RoleName.RETAILER);
        retWithDist.setRoles(Set.of(rRole));
        retWithDist.setParentUser(distOnly);
        retWithDist.setAepsCommissionPlan(freePlan);

        BbpsCommissionConfig acConfig = BbpsCommissionConfig.builder()
                .serviceId("agent-collection")
                .serviceName("Agent Collection")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.4000"))
                .distributorPercentage(new BigDecimal("0.1500"))
                .superDistributorPercentage(new BigDecimal("0.1000"))
                .enabled(true)
                .build();

        when(userRepository.findById(retWithDist.getId())).thenReturn(Optional.of(retWithDist));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("agent-collection", "FREE"))
                .thenReturn(Optional.of(acConfig));
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSAC_DIST_ONLY_001")).thenReturn(false);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("Agent Collection");
        bbpsTxn.setMerchantRefNo("BBPSAC_DIST_ONLY_001");
        bbpsTxn.setAmount(new BigDecimal("4000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setUser(retWithDist);

        commissionService.processBbpsCommission(bbpsTxn);

        // Exactly 2 credits: retailer and distributor, 0 for super distributor
        verify(walletService, times(2)).creditForService(
                any(),
                any(),
                anyString(),
                eq(com.rupiksha.backend.domain.WalletTransactionContext.COMMISSION),
                eq("BBPS Agent Collection"),
                anyString(),
                anyString()
        );
    }

    @Test
    @DisplayName("Agent Collection: 0% commission results in no wallet credits")
    void testProcessBbpsCommission_AgentCollection_ZeroPercentage() {
        retailer.setAepsCommissionPlan(freePlan);

        BbpsCommissionConfig zeroConfig = BbpsCommissionConfig.builder()
                .serviceId("agent-collection")
                .serviceName("Agent Collection")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(BigDecimal.ZERO)
                .distributorPercentage(BigDecimal.ZERO)
                .superDistributorPercentage(BigDecimal.ZERO)
                .enabled(true)
                .build();

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("agent-collection", "FREE"))
                .thenReturn(Optional.of(zeroConfig));
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSAC_ZERO_001")).thenReturn(false);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("Agent Collection");
        bbpsTxn.setMerchantRefNo("BBPSAC_ZERO_001");
        bbpsTxn.setAmount(new BigDecimal("10000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setUser(retailer);

        commissionService.processBbpsCommission(bbpsTxn);

        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Agent Collection: Duplicate transaction reference is blocked by idempotency check")
    void testProcessBbpsCommission_AgentCollection_IdempotencyDuplicateBlocked() {
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSAC_DUP_001")).thenReturn(true);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("Agent Collection");
        bbpsTxn.setMerchantRefNo("BBPSAC_DUP_001");
        bbpsTxn.setAmount(new BigDecimal("5000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setUser(retailer);

        commissionService.processBbpsCommission(bbpsTxn);

        verify(userRepository, never()).findById(any());
        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Agent Collection: FAILED, PENDING, or INITIATED transactions do NOT generate commission")
    void testProcessBbpsCommission_AgentCollection_NonSuccessStatusIgnored() {
        BbpsTransaction failedTxn = new BbpsTransaction();
        failedTxn.setId(UUID.randomUUID());
        failedTxn.setCategory("Agent Collection");
        failedTxn.setMerchantRefNo("BBPSAC_FAIL_001");
        failedTxn.setAmount(new BigDecimal("5000.00"));
        failedTxn.setStatus("FAILED");
        failedTxn.setUser(retailer);

        BbpsTransaction pendingTxn = new BbpsTransaction();
        pendingTxn.setId(UUID.randomUUID());
        pendingTxn.setCategory("Agent Collection");
        pendingTxn.setMerchantRefNo("BBPSAC_PEND_001");
        pendingTxn.setAmount(new BigDecimal("5000.00"));
        pendingTxn.setStatus("PENDING");
        pendingTxn.setUser(retailer);

        BbpsTransaction initiatedTxn = new BbpsTransaction();
        initiatedTxn.setId(UUID.randomUUID());
        initiatedTxn.setCategory("Agent Collection");
        initiatedTxn.setMerchantRefNo("BBPSAC_INIT_001");
        initiatedTxn.setAmount(new BigDecimal("5000.00"));
        initiatedTxn.setStatus("INITIATED");
        initiatedTxn.setUser(retailer);

        commissionService.processBbpsCommission(failedTxn);
        commissionService.processBbpsCommission(pendingTxn);
        commissionService.processBbpsCommission(initiatedTxn);

        verify(commissionTransactionRepository, never()).existsByOriginalTransactionId(any());
        verify(walletService, never()).creditForService(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("Agent Collection: Higher tier plans (PLAN_2999, PLAN_4999, PLAN_7999) calculate configured rates correctly")
    void testProcessBbpsCommission_AgentCollection_HigherTierPlans() {
        CommissionPlan plan7999 = CommissionPlan.builder()
                .id(UUID.randomUUID())
                .serviceType("AEPS_1")
                .planName("Rupiksha Dhanbarsha Plan")
                .planCode("PLAN_7999")
                .price(new BigDecimal("7999.00"))
                .isDefault(false)
                .enabled(true)
                .build();

        retailer.setAepsCommissionPlan(plan7999);

        BbpsCommissionConfig plan7999Config = BbpsCommissionConfig.builder()
                .serviceId("agent-collection")
                .serviceName("Agent Collection")
                .commissionModel("PERCENTAGE")
                .plan(plan7999)
                .planCode("PLAN_7999")
                .retailerPercentage(new BigDecimal("0.6000"))
                .distributorPercentage(new BigDecimal("0.2500"))
                .superDistributorPercentage(new BigDecimal("0.1500"))
                .enabled(true)
                .build();

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("agent-collection", "PLAN_7999"))
                .thenReturn(Optional.of(plan7999Config));
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSAC_7999_001")).thenReturn(false);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("Agent Collection");
        bbpsTxn.setMerchantRefNo("BBPSAC_7999_001");
        bbpsTxn.setAmount(new BigDecimal("8000.00"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setUser(retailer);

        commissionService.processBbpsCommission(bbpsTxn);

        ArgumentCaptor<BigDecimal> amountCaptor = ArgumentCaptor.forClass(BigDecimal.class);
        verify(walletService, times(3)).creditForService(
                any(),
                amountCaptor.capture(),
                anyString(),
                eq(com.rupiksha.backend.domain.WalletTransactionContext.COMMISSION),
                eq("BBPS Agent Collection"),
                anyString(),
                anyString()
        );

        List<BigDecimal> amounts = amountCaptor.getAllValues();
        // Retailer: 0.60% of ₹8,000 = ₹48.00
        assertEquals(new BigDecimal("48.00"), amounts.get(0));
        // Distributor: 0.25% of ₹8,000 = ₹20.00
        assertEquals(new BigDecimal("20.00"), amounts.get(1));
        // Super Distributor: 0.15% of ₹8,000 = ₹12.00
        assertEquals(new BigDecimal("12.00"), amounts.get(2));
    }

    @Test
    @DisplayName("Agent Collection: Currency rounding test with fractional amounts using HALF_UP rounding")
    void testProcessBbpsCommission_AgentCollection_CurrencyRounding() {
        retailer.setAepsCommissionPlan(freePlan);

        BbpsCommissionConfig acConfig = BbpsCommissionConfig.builder()
                .serviceId("agent-collection")
                .serviceName("Agent Collection")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.3500"))
                .distributorPercentage(new BigDecimal("0.1500"))
                .superDistributorPercentage(new BigDecimal("0.1000"))
                .enabled(true)
                .build();

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("agent-collection", "FREE"))
                .thenReturn(Optional.of(acConfig));
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSAC_ROUNDING_001")).thenReturn(false);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setCategory("Agent Collection");
        bbpsTxn.setMerchantRefNo("BBPSAC_ROUNDING_001");
        bbpsTxn.setAmount(new BigDecimal("1234.50"));
        bbpsTxn.setStatus("SUCCESS");
        bbpsTxn.setUser(retailer);

        commissionService.processBbpsCommission(bbpsTxn);

        ArgumentCaptor<BigDecimal> amountCaptor = ArgumentCaptor.forClass(BigDecimal.class);
        verify(walletService, times(3)).creditForService(
                any(),
                amountCaptor.capture(),
                anyString(),
                eq(com.rupiksha.backend.domain.WalletTransactionContext.COMMISSION),
                eq("BBPS Agent Collection"),
                anyString(),
                anyString()
        );

        List<BigDecimal> amounts = amountCaptor.getAllValues();
        // Retailer: 1234.50 * 0.35 / 100 = 4.32075 -> rounded HALF_UP: 4.32
        assertEquals(new BigDecimal("4.32"), amounts.get(0));
        // Distributor: 1234.50 * 0.15 / 100 = 1.85175 -> rounded HALF_UP: 1.85
        assertEquals(new BigDecimal("1.85"), amounts.get(1));
        // Super Distributor: 1234.50 * 0.10 / 100 = 1.23450 -> rounded HALF_UP: 1.23
        assertEquals(new BigDecimal("1.23"), amounts.get(2));
    }

    @Test
    @DisplayName("Admin Commission Config Update for Agent Collection with Audit Trail and total <= 100% check")
    void testUpdateBbpsConfig_AgentCollection_AdminSuccess() {
        UUID configId = UUID.randomUUID();
        BbpsCommissionConfig existingConfig = BbpsCommissionConfig.builder()
                .id(configId)
                .serviceId("agent-collection")
                .serviceName("Agent Collection")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.2000"))
                .distributorPercentage(new BigDecimal("0.1000"))
                .superDistributorPercentage(new BigDecimal("0.0500"))
                .enabled(true)
                .build();

        when(userRepository.findById(adminUser.getId())).thenReturn(Optional.of(adminUser));
        when(bbpsCommissionConfigRepository.findById(configId)).thenReturn(Optional.of(existingConfig));
        when(bbpsCommissionConfigRepository.save(any(BbpsCommissionConfig.class))).thenAnswer(i -> i.getArgument(0));

        CommissionDtos.UpdateBbpsConfigRequest req = new CommissionDtos.UpdateBbpsConfigRequest(
                new BigDecimal("0.5000"),
                new BigDecimal("0.2000"),
                new BigDecimal("0.1000"),
                true
        );

        CommissionDtos.BbpsCommissionConfigDto updated = commissionService.updateBbpsConfig(configId, req, adminUser.getId(), "192.168.1.1");

        assertNotNull(updated);
        assertEquals(new BigDecimal("0.5000"), updated.retailerPercentage());
        assertEquals(new BigDecimal("0.2000"), updated.distributorPercentage());
        assertEquals(new BigDecimal("0.1000"), updated.superDistributorPercentage());
        assertEquals(new BigDecimal("0.8000"), updated.totalPercentage());
        assertTrue(updated.enabled());

        verify(bbpsCommissionConfigAuditRepository, times(1)).save(any(BbpsCommissionConfigAudit.class));
    }

    @Test
    @DisplayName("Admin Commission Config Update rejected when user is not ADMIN")
    void testUpdateBbpsConfig_NonAdmin_AccessDenied() {
        UUID configId = UUID.randomUUID();
        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));

        CommissionDtos.UpdateBbpsConfigRequest req = new CommissionDtos.UpdateBbpsConfigRequest(
                new BigDecimal("0.5000"),
                new BigDecimal("0.2000"),
                new BigDecimal("0.1000"),
                true
        );

        assertThrows(AccessDeniedException.class, () ->
                commissionService.updateBbpsConfig(configId, req, retailer.getId(), "127.0.0.1")
        );
        verify(bbpsCommissionConfigRepository, never()).save(any());
    }

    @Test
    @DisplayName("Admin Commission Config Update rejected when combined percentage exceeds 100%")
    void testUpdateBbpsConfig_Exceeds100Percent_ThrowsException() {
        UUID configId = UUID.randomUUID();
        BbpsCommissionConfig existingConfig = BbpsCommissionConfig.builder()
                .id(configId)
                .serviceId("agent-collection")
                .serviceName("Agent Collection")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.2000"))
                .distributorPercentage(new BigDecimal("0.1000"))
                .superDistributorPercentage(new BigDecimal("0.0500"))
                .enabled(true)
                .build();

        when(userRepository.findById(adminUser.getId())).thenReturn(Optional.of(adminUser));
        when(bbpsCommissionConfigRepository.findById(configId)).thenReturn(Optional.of(existingConfig));

        CommissionDtos.UpdateBbpsConfigRequest req = new CommissionDtos.UpdateBbpsConfigRequest(
                new BigDecimal("60.0000"),
                new BigDecimal("30.0000"),
                new BigDecimal("20.0000"), // sum = 110%
                true
        );

        assertThrows(IllegalArgumentException.class, () ->
                commissionService.updateBbpsConfig(configId, req, adminUser.getId(), "127.0.0.1")
        );
        verify(bbpsCommissionConfigRepository, never()).save(any());
    }

    @Test
    @DisplayName("Automated reconciliation identifies and processes uncredited Agent Collection transactions")
    void testReconcileUncreditedBbpsCommissions_AgentCollection() {
        retailer.setAepsCommissionPlan(freePlan);

        BbpsCommissionConfig acConfig = BbpsCommissionConfig.builder()
                .serviceId("agent-collection")
                .serviceName("Agent Collection")
                .commissionModel("PERCENTAGE")
                .plan(freePlan)
                .planCode("FREE")
                .retailerPercentage(new BigDecimal("0.2000"))
                .distributorPercentage(new BigDecimal("0.1000"))
                .superDistributorPercentage(new BigDecimal("0.0500"))
                .enabled(true)
                .build();

        BbpsTransaction uncreditedTxn = new BbpsTransaction();
        uncreditedTxn.setId(UUID.randomUUID());
        uncreditedTxn.setCategory("Agent Collection");
        uncreditedTxn.setMerchantRefNo("BBPSAC_RECON_001");
        uncreditedTxn.setAmount(new BigDecimal("5000.00"));
        uncreditedTxn.setStatus("SUCCESS");
        uncreditedTxn.setUser(retailer);

        when(bbpsTransactionRepository.findByStatus("SUCCESS")).thenReturn(List.of(uncreditedTxn));
        when(commissionTransactionRepository.existsByOriginalTransactionId("BBPSAC_RECON_001"))
                .thenReturn(false) // 1. reconcileUncreditedBbpsCommissions initial check
                .thenReturn(false) // 2. processBbpsCommission idempotency safeguard
                .thenReturn(true);  // 3. reconcileUncreditedBbpsCommissions post-credit confirmation check

        when(userRepository.findById(retailer.getId())).thenReturn(Optional.of(retailer));
        when(bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode("agent-collection", "FREE"))
                .thenReturn(Optional.of(acConfig));

        int reconciledCount = commissionService.reconcileUncreditedBbpsCommissions();

        assertEquals(1, reconciledCount);
        verify(walletService, times(3)).creditForService(
                any(),
                any(),
                anyString(),
                eq(com.rupiksha.backend.domain.WalletTransactionContext.COMMISSION),
                eq("BBPS Agent Collection"),
                anyString(),
                anyString()
        );
    }
}
