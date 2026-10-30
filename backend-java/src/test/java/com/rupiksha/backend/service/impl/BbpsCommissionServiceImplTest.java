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
}
