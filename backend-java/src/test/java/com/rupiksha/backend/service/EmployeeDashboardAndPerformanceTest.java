package com.rupiksha.backend.service;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.repository.AepsTransactionEngineRepository;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EmployeeDashboardAndPerformanceTest {

    private AepsTransactionEngineRepository aepsRepository;
    private PayoutTransactionRepository payoutRepository;
    private RechargeRepository rechargeRepository;
    private BbpsTransactionRepository bbpsRepository;
    private WalletTransferRepository walletTransferRepository;
    private TxnRepository txnRepository;
    private EmployeeMetricsService metricsService;

    private EmployeeRepository employeeRepository;
    private EmployeeScopeRepository employeeScopeRepository;
    private EmployeePermissionRepository permissionRepository;
    private EmployeeRefreshTokenRepository refreshTokenRepository;
    private EmployeeScopeService scopeService;
    private EmployeePermissionService permissionService;
    private UserRepository userRepository;
    private AdminEmployeeService adminEmployeeService;

    @BeforeEach
    void setUp() {
        aepsRepository = mock(AepsTransactionEngineRepository.class);
        payoutRepository = mock(PayoutTransactionRepository.class);
        rechargeRepository = mock(RechargeRepository.class);
        bbpsRepository = mock(BbpsTransactionRepository.class);
        walletTransferRepository = mock(WalletTransferRepository.class);
        txnRepository = mock(TxnRepository.class);

        metricsService = new EmployeeMetricsService(
                aepsRepository, payoutRepository, rechargeRepository,
                bbpsRepository, walletTransferRepository, txnRepository
        );

        employeeRepository = mock(EmployeeRepository.class);
        employeeScopeRepository = mock(EmployeeScopeRepository.class);
        permissionRepository = mock(EmployeePermissionRepository.class);
        refreshTokenRepository = mock(EmployeeRefreshTokenRepository.class);
        scopeService = new EmployeeScopeService(employeeRepository, employeeScopeRepository);
        permissionService = new EmployeePermissionService(permissionRepository);
        userRepository = mock(UserRepository.class);
        EmployeeAuditService auditService = mock(EmployeeAuditService.class);
        EmployeeAuthService authService = mock(EmployeeAuthService.class);

        when(authService.toProfileView(any())).thenAnswer(inv -> {
            Employee e = inv.getArgument(0);
            return new EmployeeDtos.EmployeeProfileView(
                    e.getId().toString(), e.getEmployeeCode(), e.getUsername(), e.getFullName(),
                    e.getMobile(), e.getEmail(), e.getAddress(),
                    e.getEmployeeRole().name(), e.getEmployeeRole().getDisplayName(), e.getStatus().name(),
                    null, "Admin", "ADMIN", e.getTerritoryLabel(), List.of(), List.of(),
                    e.getLastLoginAt(), e.getCreatedAt(), e.getUpdatedAt()
            );
        });

        adminEmployeeService = new AdminEmployeeService(
                employeeRepository, employeeScopeRepository, permissionRepository,
                refreshTokenRepository, scopeService, permissionService, authService,
                metricsService, auditService, userRepository, new BCryptPasswordEncoder()
        );
    }

    @Test
    void emptyScopeReturnsZeroStateWithZeroHardcodedNumbers() {
        Employee emp = new Employee();
        emp.setId(UUID.randomUUID());
        emp.setEmployeeCode("EMP-ZH-0");
        emp.setUsername("zh.empty");
        emp.setFullName("Empty Zonal");
        emp.setEmployeeRole(EmployeeRole.REGIONAL_HEADER);
        emp.setStatus(EmployeeStatus.ACTIVE);

        when(employeeRepository.findById(emp.getId())).thenReturn(Optional.of(emp));
        when(employeeRepository.findAll()).thenReturn(List.of(emp));
        when(employeeScopeRepository.findByEmployeeId(emp.getId())).thenReturn(List.of());
        when(userRepository.findAll()).thenReturn(List.of());

        EmployeeDtos.EmployeePerformanceItem perf = adminEmployeeService.getEmployeePerformance(emp.getId(), null, null);
        assertEquals(0, perf.directUsersOnboarded());
        assertEquals(0, perf.hierarchyTotalUsers());
        assertEquals(0, perf.totalTransactions());
        assertEquals(BigDecimal.ZERO, perf.totalVolume());
        assertTrue(perf.serviceBreakdown().isEmpty());
        assertTrue(perf.dailyPerformance().isEmpty());
    }

    @Test
    void computesRealScopedMetricsAcrossServicesWithoutDoubleCounting() {
        Employee emp = new Employee();
        emp.setId(UUID.randomUUID());
        emp.setEmployeeCode("EMP-SH-BIHAR");
        emp.setUsername("sh.bihar");
        emp.setFullName("Bihar Head");
        emp.setEmployeeRole(EmployeeRole.STATE_HEADER);
        emp.setStatus(EmployeeStatus.ACTIVE);
        emp.setTerritoryLabel("Bihar");

        EmployeeScope scope = new EmployeeScope();
        scope.setEmployee(emp);
        scope.setScopeType(EmployeeScopeType.STATE);
        scope.setStateName("Bihar");

        Role retRole = new Role(); retRole.setName(RoleName.RETAILER);
        User inScopeUser = new User();
        inScopeUser.setId(UUID.randomUUID());
        inScopeUser.setUsername("ret.patna");
        inScopeUser.setFullName("Patna Store");
        inScopeUser.setStateName("Bihar");
        inScopeUser.setOnboardedByEmployeeId(emp.getId());
        inScopeUser.setRoles(Set.of(retRole));

        User outScopeUser = new User();
        outScopeUser.setId(UUID.randomUUID());
        outScopeUser.setUsername("ret.delhi");
        outScopeUser.setFullName("Delhi Store");
        outScopeUser.setStateName("Delhi");
        outScopeUser.setRoles(Set.of(retRole));

        AepsTransactionEngine aepsSuccess = AepsTransactionEngine.builder()
                .transactionId("AEPS-1").referenceNumber("REF-1").serviceType("CASH_WITHDRAWAL")
                .provider("FINGPAY").merchantId("M1").userId(inScopeUser.getId())
                .amount(new BigDecimal("1500.00")).status("SUCCESS").workflowState("DONE")
                .initiatedAt(LocalDateTime.now()).lastUpdated(LocalDateTime.now()).build();

        AepsTransactionEngine aepsOutScope = AepsTransactionEngine.builder()
                .transactionId("AEPS-OUT").referenceNumber("REF-OUT").serviceType("CASH_WITHDRAWAL")
                .provider("FINGPAY").merchantId("M2").userId(outScopeUser.getId())
                .amount(new BigDecimal("99999.00")).status("SUCCESS").workflowState("DONE")
                .initiatedAt(LocalDateTime.now()).lastUpdated(LocalDateTime.now()).build();

        PayoutTransaction payoutPending = PayoutTransaction.builder()
                .orderId("PO-1").userId(inScopeUser.getId().toString())
                .amount(new BigDecimal("500.00")).status("PENDING")
                .beneficiaryName("Test").accountNumber("1234567890").ifsc("SBIN0000001")
                .transferMode("IMPS").createdAt(LocalDateTime.now()).build();

        Txn bbpsTxn = new Txn();
        bbpsTxn.setId(UUID.randomUUID());
        bbpsTxn.setUser(inScopeUser);
        bbpsTxn.setServiceType("BBPS_BILL");
        bbpsTxn.setAmount(new BigDecimal("250.00"));
        bbpsTxn.setStatus(TransactionStatus.SUCCESS);

        BbpsTransaction bbps = new BbpsTransaction();
        bbps.setId(UUID.randomUUID());
        bbps.setUser(inScopeUser);
        bbps.setTxn(bbpsTxn);
        bbps.setMerchantRefNo("BBPS-1");
        bbps.setRequestId("REQ-1");
        bbps.setBillerId("BIL-1");
        bbps.setBillerName("NBPDCL");
        bbps.setMobileNumber("9999999999");
        bbps.setAmount(new BigDecimal("250.00"));
        bbps.setStatus("SUCCESS");

        when(aepsRepository.findAll()).thenReturn(List.of(aepsSuccess, aepsOutScope));
        when(payoutRepository.findAll()).thenReturn(List.of(payoutPending));
        when(rechargeRepository.findAll()).thenReturn(List.of());
        when(bbpsRepository.findAll()).thenReturn(List.of(bbps));
        when(walletTransferRepository.findAll()).thenReturn(List.of());
        when(txnRepository.findAll()).thenReturn(List.of(bbpsTxn));

        when(employeeRepository.findById(emp.getId())).thenReturn(Optional.of(emp));
        when(employeeRepository.findAll()).thenReturn(List.of(emp));
        when(employeeScopeRepository.findByEmployeeId(emp.getId())).thenReturn(List.of(scope));
        when(userRepository.findAll()).thenReturn(List.of(inScopeUser, outScopeUser));

        EmployeeDtos.EmployeePerformanceItem perf = adminEmployeeService.getEmployeePerformance(emp.getId(), null, null);
        assertEquals(1, perf.directUsersOnboarded());
        assertEquals(1, perf.retailersOnboarded());
        assertEquals(1, perf.hierarchyTotalUsers());
        // Total = 3 (1 AEPS + 1 PAYOUT + 1 BBPS; linked Txn not double counted, out-of-scope AEPS excluded)
        assertEquals(3, perf.totalTransactions());
        assertEquals(2, perf.successTransactions());
        assertEquals(1, perf.pendingTransactions());
        assertEquals(0, perf.failedTransactions());
        assertEquals(0, new BigDecimal("1750.00").compareTo(perf.totalVolume()));

        Map<String, Object> preview = adminEmployeeService.getReadOnlyPermissionPreview(emp.getId());
        assertEquals(true, preview.get("readOnlyPreview"));
        assertEquals(false, preview.get("canModifyUsersOrWallets"));
    }

    @Test
    void readMethodsDeclareTransactionalReadOnlyAndHandleCrossScopeWalletRecipient() throws Exception {
        Transactional listPerfTx = AdminEmployeeService.class
                .getMethod("listPerformanceSummary", String.class, String.class, String.class, String.class, String.class)
                .getAnnotation(Transactional.class);
        assertNotNull(listPerfTx);
        assertTrue(listPerfTx.readOnly());

        Transactional singlePerfTx = AdminEmployeeService.class
                .getMethod("getEmployeePerformance", UUID.class, String.class, String.class)
                .getAnnotation(Transactional.class);
        assertNotNull(singlePerfTx);
        assertTrue(singlePerfTx.readOnly());

        Transactional computeTx = EmployeeMetricsService.class
                .getMethod("computeMetrics", Map.class, Set.class, Instant.class, Instant.class, String.class, String.class, String.class)
                .getAnnotation(Transactional.class);
        assertNotNull(computeTx);
        assertTrue(computeTx.readOnly());

        Transactional portalDashTx = EmployeePortalService.class
                .getMethod("getDashboard", com.rupiksha.backend.security.JwtPrincipal.class, String.class, String.class)
                .getAnnotation(Transactional.class);
        assertNotNull(portalDashTx);
        assertTrue(portalDashTx.readOnly());

        // Verify WalletTransfer where sender is in scope and recipient is outside scope works cleanly
        User senderInScope = new User();
        senderInScope.setId(UUID.randomUUID());
        senderInScope.setUsername("sender.north");
        senderInScope.setFullName("Sender North");
        senderInScope.setStateName("Delhi");
        Role r = new Role(); r.setName(RoleName.DISTRIBUTOR);
        senderInScope.setRoles(Set.of(r));

        User recipientOutScope = new User();
        recipientOutScope.setId(UUID.randomUUID());
        recipientOutScope.setUsername("recipient.south");

        WalletTransfer wt = new WalletTransfer();
        wt.setId(UUID.randomUUID());
        wt.setTransferReference("W2W-TEST-1");
        wt.setSender(senderInScope);
        wt.setRecipient(recipientOutScope);
        wt.setAmount(new BigDecimal("400.00"));
        wt.setStatus("SUCCESS");
        wt.setRemarks("Partner transfer");

        when(aepsRepository.findAll()).thenReturn(List.of());
        when(payoutRepository.findAll()).thenReturn(List.of());
        when(rechargeRepository.findAll()).thenReturn(List.of());
        when(bbpsRepository.findAll()).thenReturn(List.of());
        when(walletTransferRepository.findAll()).thenReturn(List.of(wt));
        when(txnRepository.findAll()).thenReturn(List.of());

        EmployeeMetricsService.MetricsResult res = metricsService.computeMetrics(
                Map.of(senderInScope.getId(), senderInScope), null, null, null, "ALL", null, null
        );
        assertEquals(1, res.totalTransactions());
        assertEquals(0, new BigDecimal("400.00").compareTo(res.totalVolume()));
        assertEquals("recipient.south", res.transactions().get(0).targetAccountOrMobile());
    }

    @Test
    void freshEmployeeReturnsZeroEvenWhenLegacyUsersExistInSameGeographicalZone() {
        Employee freshZonal = new Employee();
        freshZonal.setId(UUID.randomUUID());
        freshZonal.setEmployeeCode("EMP-001");
        freshZonal.setUsername("anuj001");
        freshZonal.setFullName("Fresh Zonal");
        freshZonal.setEmployeeRole(EmployeeRole.REGIONAL_HEADER);
        freshZonal.setStatus(EmployeeStatus.ACTIVE);
        freshZonal.setTerritoryLabel("North Zone");

        EmployeeScope northZone = new EmployeeScope();
        northZone.setEmployee(freshZonal);
        northZone.setScopeType(EmployeeScopeType.ZONE);
        northZone.setZoneName("North Zone");

        Role retRole = new Role(); retRole.setName(RoleName.RETAILER);
        User legacyNorthUser = new User();
        legacyNorthUser.setId(UUID.randomUUID());
        legacyNorthUser.setUsername("legacy.delhi");
        legacyNorthUser.setFullName("Legacy Delhi Retailer");
        legacyNorthUser.setStateName("Delhi");
        legacyNorthUser.setRoles(Set.of(retRole));

        AepsTransactionEngine oldTxn = AepsTransactionEngine.builder()
                .transactionId("OLD-AEPS-1").referenceNumber("OLD-REF").serviceType("CASH_WITHDRAWAL")
                .provider("FINGPAY").merchantId("M9").userId(legacyNorthUser.getId())
                .amount(new BigDecimal("7.00")).status("SUCCESS").workflowState("DONE")
                .initiatedAt(LocalDateTime.now().minusMonths(2)).lastUpdated(LocalDateTime.now().minusMonths(2)).build();

        when(employeeRepository.findById(freshZonal.getId())).thenReturn(Optional.of(freshZonal));
        when(employeeRepository.findAll()).thenReturn(List.of(freshZonal));
        when(employeeScopeRepository.findByEmployeeId(freshZonal.getId())).thenReturn(List.of(northZone));
        when(userRepository.findAll()).thenReturn(List.of(legacyNorthUser));
        when(aepsRepository.findAll()).thenReturn(List.of(oldTxn));
        when(payoutRepository.findAll()).thenReturn(List.of());
        when(rechargeRepository.findAll()).thenReturn(List.of());
        when(bbpsRepository.findAll()).thenReturn(List.of());
        when(walletTransferRepository.findAll()).thenReturn(List.of());
        when(txnRepository.findAll()).thenReturn(List.of());

        EmployeeDtos.EmployeePerformanceItem perf = adminEmployeeService.getEmployeePerformance(freshZonal.getId(), null, null);
        assertEquals(0, perf.directUsersOnboarded());
        assertEquals(0, perf.hierarchyTotalUsers());
        assertEquals(0, perf.totalTransactions());
        assertEquals(0, BigDecimal.ZERO.compareTo(perf.totalVolume()));
        assertTrue(perf.serviceBreakdown().isEmpty());
        assertTrue(perf.dailyPerformance().isEmpty());
    }
}
