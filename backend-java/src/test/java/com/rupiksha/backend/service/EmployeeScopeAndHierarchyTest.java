package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.security.JwtPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class EmployeeScopeAndHierarchyTest {

    private EmployeeRepository employeeRepository;
    private EmployeeScopeRepository employeeScopeRepository;
    private EmployeePermissionRepository employeePermissionRepository;
    private EmployeeRefreshTokenRepository refreshTokenRepository;
    private EmployeeScopeService scopeService;
    private EmployeePermissionService permissionService;
    private AdminEmployeeService adminEmployeeService;

    @BeforeEach
    void setUp() {
        employeeRepository = mock(EmployeeRepository.class);
        employeeScopeRepository = mock(EmployeeScopeRepository.class);
        employeePermissionRepository = mock(EmployeePermissionRepository.class);
        refreshTokenRepository = mock(EmployeeRefreshTokenRepository.class);

        scopeService = new EmployeeScopeService(employeeRepository, employeeScopeRepository);
        permissionService = new EmployeePermissionService(employeePermissionRepository);

        adminEmployeeService = new AdminEmployeeService(
                employeeRepository,
                employeeScopeRepository,
                employeePermissionRepository,
                refreshTokenRepository,
                scopeService,
                permissionService,
                mock(EmployeeAuthService.class),
                mock(EmployeeMetricsService.class),
                mock(EmployeeAuditService.class),
                mock(UserRepository.class),
                new BCryptPasswordEncoder()
        );
    }

    private User makeUser(RoleName roleName, String state, String city, String zone) {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setUsername(roleName.name().toLowerCase() + "_" + UUID.randomUUID().toString().substring(0, 6));
        u.setFullName("Test " + roleName.name());
        u.setStateName(state);
        u.setCity(city);
        u.setZoneName(zone);
        Role r = new Role();
        r.setName(roleName);
        u.setRoles(Set.of(r));
        return u;
    }

    @Test
    void stateHeadOnlySeesAssignedStatesAndNeverAdmins() {
        Employee stateHead = new Employee();
        stateHead.setId(UUID.randomUUID());
        stateHead.setEmployeeRole(EmployeeRole.STATE_HEADER);

        EmployeeScope biharScope = new EmployeeScope();
        biharScope.setEmployee(stateHead);
        biharScope.setScopeType(EmployeeScopeType.STATE);
        biharScope.setStateName("Bihar");

        User biharRetailer = makeUser(RoleName.RETAILER, "Bihar", "Patna", "East Zone");
        User mhRetailer = makeUser(RoleName.RETAILER, "Maharashtra", "Pune", "West Zone");
        User adminUser = makeUser(RoleName.ADMIN, "Bihar", "Patna", "East Zone");

        assertTrue(scopeService.isUserInEmployeeScope(biharRetailer, stateHead, List.of(biharScope)));
        assertFalse(scopeService.isUserInEmployeeScope(mhRetailer, stateHead, List.of(biharScope)));
        assertFalse(scopeService.isUserInEmployeeScope(adminUser, stateHead, List.of(biharScope)));
    }

    @Test
    void zonalHeadEnforcesZoneAndCityClusterBoundaries() {
        Employee zonalHead = new Employee();
        zonalHead.setId(UUID.randomUUID());
        zonalHead.setEmployeeRole(EmployeeRole.REGIONAL_HEADER);

        EmployeeScope northZone = new EmployeeScope();
        northZone.setEmployee(zonalHead);
        northZone.setScopeType(EmployeeScopeType.ZONE);
        northZone.setZoneName("North Zone");

        User delhiDist = makeUser(RoleName.DISTRIBUTOR, "Delhi", "New Delhi", null);
        User odishaDist = makeUser(RoleName.DISTRIBUTOR, "Odisha", "Cuttack", null);

        assertTrue(scopeService.isUserInEmployeeScope(delhiDist, zonalHead, List.of(northZone)));
        assertFalse(scopeService.isUserInEmployeeScope(odishaDist, zonalHead, List.of(northZone)));

        // Cluster-restricted Zonal Head
        EmployeeScope patnaCluster = new EmployeeScope();
        patnaCluster.setEmployee(zonalHead);
        patnaCluster.setScopeType(EmployeeScopeType.ZONE);
        patnaCluster.setStateName("Bihar");
        patnaCluster.setCityOrDistrict("Patna");

        User patnaRet = makeUser(RoleName.RETAILER, "Bihar", "Patna", null);
        User gayaRet = makeUser(RoleName.RETAILER, "Bihar", "Gaya", null);

        assertTrue(scopeService.isUserInEmployeeScope(patnaRet, zonalHead, List.of(patnaCluster)));
        assertFalse(scopeService.isUserInEmployeeScope(gayaRet, zonalHead, List.of(patnaCluster)));
    }

    @Test
    void subordinateHierarchyExcludesSiblingsUnrelatedAndManagers() {
        Employee nh1 = new Employee(); nh1.setId(UUID.randomUUID()); nh1.setEmployeeRole(EmployeeRole.NATIONAL_HEADER);
        Employee nh2 = new Employee(); nh2.setId(UUID.randomUUID()); nh2.setEmployeeRole(EmployeeRole.NATIONAL_HEADER);
        Employee sh1 = new Employee(); sh1.setId(UUID.randomUUID()); sh1.setEmployeeRole(EmployeeRole.STATE_HEADER); sh1.setReportingManagerId(nh1.getId());
        Employee sh2 = new Employee(); sh2.setId(UUID.randomUUID()); sh2.setEmployeeRole(EmployeeRole.STATE_HEADER); sh2.setReportingManagerId(nh2.getId());
        Employee zh1 = new Employee(); zh1.setId(UUID.randomUUID()); zh1.setEmployeeRole(EmployeeRole.REGIONAL_HEADER); zh1.setReportingManagerId(sh1.getId());

        List<Employee> all = List.of(nh1, nh2, sh1, sh2, zh1);
        Set<UUID> nh1Subtree = scopeService.resolveSubordinateEmployeeIds(nh1.getId(), all);

        assertEquals(Set.of(sh1.getId(), zh1.getId()), nh1Subtree);
        assertFalse(nh1Subtree.contains(nh2.getId()));
        assertFalse(nh1Subtree.contains(sh2.getId()));
        assertFalse(nh1Subtree.contains(nh1.getId()));

        Set<UUID> zh1Subtree = scopeService.resolveSubordinateEmployeeIds(zh1.getId(), all);
        assertTrue(zh1Subtree.isEmpty());
    }

    @Test
    void adminBlocksInvalidHierarchyContainmentAndForbiddenPermissions() {
        Employee biharSh = new Employee();
        biharSh.setId(UUID.randomUUID());
        biharSh.setEmployeeRole(EmployeeRole.STATE_HEADER);
        EmployeeScope shScope = new EmployeeScope();
        shScope.setEmployee(biharSh);
        shScope.setScopeType(EmployeeScopeType.STATE);
        shScope.setStateName("Bihar");

        when(employeeRepository.findById(biharSh.getId())).thenReturn(Optional.of(biharSh));
        when(employeeScopeRepository.findByEmployeeId(biharSh.getId())).thenReturn(List.of(shScope));
        when(employeeRepository.save(any())).thenAnswer(inv -> {
            Employee e = inv.getArgument(0);
            if (e.getId() == null) e.setId(UUID.randomUUID());
            return e;
        });

        JwtPrincipal admin = new JwtPrincipal(UUID.randomUUID().toString(), "admin", List.of("ADMIN"));

        // Attempt assigning Maharashtra under Bihar State Head -> must reject
        EmployeeDtos.CreateEmployeeRequest badScopeReq = new EmployeeDtos.CreateEmployeeRequest(
                "EMP-ZH-9", "zh.bad", "Bad Zone", "9998887776", "zhbad@rupiksha.in", null,
                "REGIONAL_HEADER", "Pass@1234", biharSh.getId().toString(), null,
                List.of(new EmployeeDtos.ScopeItem("ZONE", "Maharashtra", null, "Mumbai")),
                List.of(EmployeePermissionCatalog.VIEW_DASHBOARD),
                "ACTIVE"
        );
        assertThrows(IllegalArgumentException.class, () ->
                adminEmployeeService.createEmployee(badScopeReq, admin, "127.0.0.1", "JUnit")
        );

        // Attempt assigning forbidden commission/service/admin permission -> must reject
        EmployeeDtos.CreateEmployeeRequest forbiddenPermReq = new EmployeeDtos.CreateEmployeeRequest(
                "EMP-ZH-10", "zh.perm", "Perm Test", "9998887775", "zhperm@rupiksha.in", null,
                "REGIONAL_HEADER", "Pass@1234", biharSh.getId().toString(), null,
                List.of(new EmployeeDtos.ScopeItem("ZONE", "Bihar", null, "Patna")),
                List.of("Configure Commissions"),
                "ACTIVE"
        );
        assertThrows(IllegalArgumentException.class, () ->
                adminEmployeeService.createEmployee(forbiddenPermReq, admin, "127.0.0.1", "JUnit")
        );
    }
}
