package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.security.JwtPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class EmployeePermissionAndPortalTest {

    private EmployeeAuthService employeeAuthService;
    private EmployeePermissionRepository permissionRepository;
    private EmployeePermissionService permissionService;
    private EmployeeRepository employeeRepository;
    private EmployeeScopeRepository employeeScopeRepository;
    private UserRepository userRepository;
    private RoleRepository roleRepository;
    private WalletRepository walletRepository;
    private UserServiceRepository userServiceRepository;
    private EmployeeScopeService scopeService;
    private EmployeeMetricsService metricsService;
    private EmployeeAuditService auditService;
    private EmployeePortalService portalService;

    private Employee stateHead;
    private JwtPrincipal empPrincipal;
    private EmployeeScope biharScope;
    private Role retailerRole;
    private Role distributorRole;

    @BeforeEach
    void setUp() {
        employeeAuthService = mock(EmployeeAuthService.class);
        permissionRepository = mock(EmployeePermissionRepository.class);
        permissionService = new EmployeePermissionService(permissionRepository);
        employeeRepository = mock(EmployeeRepository.class);
        employeeScopeRepository = mock(EmployeeScopeRepository.class);
        userRepository = mock(UserRepository.class);
        roleRepository = mock(RoleRepository.class);
        walletRepository = mock(WalletRepository.class);
        userServiceRepository = mock(UserServiceRepository.class);
        scopeService = new EmployeeScopeService(employeeRepository, employeeScopeRepository);
        metricsService = mock(EmployeeMetricsService.class);
        auditService = mock(EmployeeAuditService.class);

        portalService = new EmployeePortalService(
                employeeAuthService,
                permissionService,
                scopeService,
                metricsService,
                auditService,
                employeeRepository,
                employeeScopeRepository,
                userRepository,
                roleRepository,
                walletRepository,
                userServiceRepository,
                new BCryptPasswordEncoder()
        );

        stateHead = new Employee();
        stateHead.setId(UUID.randomUUID());
        stateHead.setEmployeeCode("EMP-SH-01");
        stateHead.setUsername("sh.bihar");
        stateHead.setFullName("Bihar State Head");
        stateHead.setEmployeeRole(EmployeeRole.STATE_HEADER);
        stateHead.setStatus(EmployeeStatus.ACTIVE);

        empPrincipal = new JwtPrincipal(stateHead.getId().toString(), stateHead.getUsername(), List.of("EMPLOYEE", "STATE_HEADER"));

        biharScope = new EmployeeScope();
        biharScope.setEmployee(stateHead);
        biharScope.setScopeType(EmployeeScopeType.STATE);
        biharScope.setStateName("Bihar");

        retailerRole = new Role(); retailerRole.setName(RoleName.RETAILER);
        distributorRole = new Role(); distributorRole.setName(RoleName.DISTRIBUTOR);

        when(employeeAuthService.requireActiveAuthenticatedEmployee(empPrincipal)).thenReturn(stateHead);
        when(employeeAuthService.toProfileView(stateHead)).thenReturn(
                new EmployeeDtos.EmployeeProfileView(
                        stateHead.getId().toString(), stateHead.getEmployeeCode(), stateHead.getUsername(),
                        stateHead.getFullName(), "9999999999", "sh@rupiksha.in", null,
                        "STATE_HEADER", "State Head", "ACTIVE", null, "Admin", "ADMIN",
                        "Bihar", List.of(), List.of(), null, null, null
                )
        );
        when(employeeRepository.findAll()).thenReturn(List.of(stateHead));
        when(employeeScopeRepository.findByEmployeeId(stateHead.getId())).thenReturn(List.of(biharScope));
    }

    private void grantPermissions(String... codes) {
        List<EmployeePermission> eps = Arrays.stream(codes).map(code -> {
            EmployeePermission ep = new EmployeePermission();
            ep.setEmployee(stateHead);
            ep.setPermissionCode(code);
            ep.setCategory("TEST");
            return ep;
        }).toList();
        when(permissionRepository.findByEmployeeId(stateHead.getId())).thenReturn(eps);
    }

    @Test
    void defaultDenyBlocksUnassignedPermissionsAndDynamicUpdateUnlocksImmediately() {
        grantPermissions(); // No permissions initially
        assertThrows(AccessDeniedException.class, () -> portalService.getDashboard(empPrincipal, null, null));
        assertThrows(AccessDeniedException.class, () -> portalService.listScopedMembers(empPrincipal, "RETAILER", null, null));
        assertThrows(AccessDeniedException.class, () -> portalService.listSubordinateHierarchyEmployees(empPrincipal, null, null));

        // Grant VIEW_DASHBOARD dynamically without recreating employee -> immediately permitted!
        grantPermissions(EmployeePermissionCatalog.VIEW_DASHBOARD);
        EmployeeDtos.EmployeeDashboardResponse dash = portalService.getDashboard(empPrincipal, null, null);
        assertTrue(dash.hasDashboardAccess());
    }

    @Test
    void crossStateIdorAndRoleMismatchAreBlocked() {
        grantPermissions(EmployeePermissionCatalog.VIEW_RETAILERS, EmployeePermissionCatalog.VIEW_USER_DETAILS);

        User biharRet = new User();
        biharRet.setId(UUID.randomUUID());
        biharRet.setUsername("ret.patna");
        biharRet.setFullName("Patna Retailer");
        biharRet.setStateName("Bihar");
        biharRet.setOnboardedByEmployeeId(stateHead.getId());
        biharRet.setRoles(Set.of(retailerRole));

        User unownedBiharRet = new User();
        unownedBiharRet.setId(UUID.randomUUID());
        unownedBiharRet.setUsername("ret.legacy.patna");
        unownedBiharRet.setFullName("Legacy Patna Retailer");
        unownedBiharRet.setStateName("Bihar");
        unownedBiharRet.setRoles(Set.of(retailerRole));

        User mhRet = new User();
        mhRet.setId(UUID.randomUUID());
        mhRet.setUsername("ret.pune");
        mhRet.setFullName("Pune Retailer");
        mhRet.setStateName("Maharashtra");
        mhRet.setOnboardedByEmployeeId(stateHead.getId());
        mhRet.setRoles(Set.of(retailerRole));

        User biharDist = new User();
        biharDist.setId(UUID.randomUUID());
        biharDist.setUsername("dist.patna");
        biharDist.setFullName("Patna Dist");
        biharDist.setStateName("Bihar");
        biharDist.setOnboardedByEmployeeId(stateHead.getId());
        biharDist.setRoles(Set.of(distributorRole));

        when(userRepository.findAll()).thenReturn(List.of(biharRet, unownedBiharRet, mhRet, biharDist));
        when(userRepository.findById(mhRet.getId())).thenReturn(Optional.of(mhRet));
        when(userRepository.findById(unownedBiharRet.getId())).thenReturn(Optional.of(unownedBiharRet));
        when(userRepository.findById(biharRet.getId())).thenReturn(Optional.of(biharRet));
        when(walletRepository.findByUserId(biharRet.getId())).thenReturn(Optional.empty());
        when(walletRepository.findByUserIdIn(any())).thenReturn(List.of());

        List<EmployeeDtos.ScopedMemberSummary> members = portalService.listScopedMembers(empPrincipal, "ALL", null, null);
        assertEquals(1, members.size());
        assertEquals("ret.patna", members.get(0).username());

        // Requesting DISTRIBUTOR without VIEW_DISTRIBUTORS -> 403
        assertThrows(AccessDeniedException.class, () -> portalService.listScopedMembers(empPrincipal, "DISTRIBUTOR", null, null));

        // Direct ID lookup on Maharashtra retailer or unowned Bihar legacy retailer -> IDOR blocked (403)
        assertThrows(AccessDeniedException.class, () -> portalService.getScopedMemberDetail(empPrincipal, mhRet.getId()));
        assertThrows(AccessDeniedException.class, () -> portalService.getScopedMemberDetail(empPrincipal, unownedBiharRet.getId()));

        // Direct ID lookup on Bihar retailer -> allowed, and KYC status masked since VIEW_USER_KYC_STATUS not granted
        EmployeeDtos.ScopedMemberDetail detail = portalService.getScopedMemberDetail(empPrincipal, biharRet.getId());
        assertEquals("RESTRICTED", detail.summary().kycStatus());
    }

    @Test
    void controlledOnboardingEnforcesRolePermissionAndGeographicalScope() {
        grantPermissions(EmployeePermissionCatalog.CREATE_RETAILER_ACCOUNT);
        when(roleRepository.findByName(RoleName.RETAILER)).thenReturn(Optional.of(retailerRole));
        when(roleRepository.findByName(RoleName.DISTRIBUTOR)).thenReturn(Optional.of(distributorRole));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            if (u.getId() == null) u.setId(UUID.randomUUID());
            return u;
        });

        // 1. Out-of-scope state (Gujarat) -> rejected
        EmployeeDtos.OnboardMemberRequest badStateReq = new EmployeeDtos.OnboardMemberRequest(
                "ret_gj_1", "9111222333", "retgj@test.com", "Gujarat Ret", "Pass@123", null,
                "RETAILER", "Gujarat", "Surat", "Surat", null, "395001", "Shop 1", "Shop A", null,
                null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null
        );
        assertThrows(AccessDeniedException.class, () -> portalService.onboardMember(empPrincipal, badStateReq, "1.1.1.1", "JUnit"));

        // 2. Unpermitted role (DISTRIBUTOR without CREATE_DISTRIBUTOR_ACCOUNT) -> rejected
        EmployeeDtos.OnboardMemberRequest badRoleReq = new EmployeeDtos.OnboardMemberRequest(
                "dist_br_1", "9111222334", "distbr@test.com", "Bihar Dist", "Pass@123", null,
                "DISTRIBUTOR", "Bihar", "Patna", "Patna", null, "800001", "Shop 2", "Shop B", null,
                null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null
        );
        assertThrows(AccessDeniedException.class, () -> portalService.onboardMember(empPrincipal, badRoleReq, "1.1.1.1", "JUnit"));

        // 3. Privileged ADMIN creation attempt -> rejected
        EmployeeDtos.OnboardMemberRequest adminReq = new EmployeeDtos.OnboardMemberRequest(
                "adm_fake", "9111222335", "admfake@test.com", "Fake Admin", "Pass@123", null,
                "ADMIN", "Bihar", "Patna", "Patna", null, "800001", "Shop 3", "Shop C", null,
                null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null
        );
        assertThrows(AccessDeniedException.class, () -> portalService.onboardMember(empPrincipal, adminReq, "1.1.1.1", "JUnit"));

        // 4. Valid in-scope Bihar Retailer creation -> succeeds with employee binding & wallet/services setup
        EmployeeDtos.OnboardMemberRequest okReq = new EmployeeDtos.OnboardMemberRequest(
                "ret_br_1", "9111222339", "retbr@test.com", "Bihar Retailer", "Pass@123", "1234",
                "RETAILER", "Bihar", "Patna", "Patna", null, "800001", "Kankarbagh", "Patna Digital", null,
                null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null
        );
        EmployeeDtos.ScopedMemberSummary created = portalService.onboardMember(empPrincipal, okReq, "1.1.1.1", "JUnit");
        assertEquals("Bihar", created.stateName());
        assertEquals(stateHead.getId().toString(), created.onboardedByEmployeeId());
        assertEquals("EMP-SH-01", created.onboardedByEmployeeCode());
        assertTrue(created.partyCode().startsWith("RPRBR"));
        verify(walletRepository).save(any(Wallet.class));
        verify(userServiceRepository, atLeastOnce()).save(any(UserService.class));
    }
}
