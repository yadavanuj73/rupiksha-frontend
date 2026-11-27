package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.security.JwtPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminEmployeeService {

    private final EmployeeRepository employeeRepository;
    private final EmployeeScopeRepository employeeScopeRepository;
    private final EmployeePermissionRepository employeePermissionRepository;
    private final EmployeeRefreshTokenRepository employeeRefreshTokenRepository;
    private final EmployeeScopeService employeeScopeService;
    private final EmployeePermissionService employeePermissionService;
    private final EmployeeAuthService employeeAuthService;
    private final EmployeeMetricsService employeeMetricsService;
    private final EmployeeAuditService employeeAuditService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public EmployeeDtos.EmployeeProfileView createEmployee(
            EmployeeDtos.CreateEmployeeRequest request,
            JwtPrincipal adminPrincipal,
            String clientIp,
            String userAgent
    ) {
        String code = request.employeeCode().trim().toUpperCase(Locale.ROOT);
        String username = request.username().trim().toLowerCase(Locale.ROOT);
        String mobile = request.mobile().trim();
        String email = request.email().trim().toLowerCase(Locale.ROOT);

        if (employeeRepository.existsByEmployeeCodeIgnoreCase(code)) {
            throw new IllegalArgumentException("Employee ID '" + code + "' already exists.");
        }
        if (employeeRepository.existsByUsernameIgnoreCase(username) || userRepository.findByUsername(username).isPresent()) {
            throw new IllegalArgumentException("Username '" + username + "' is already in use.");
        }
        if (employeeRepository.existsByMobile(mobile)) {
            throw new IllegalArgumentException("Mobile number is already assigned to another employee.");
        }
        if (employeeRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email address is already assigned to another employee.");
        }

        EmployeeRole role = EmployeeRole.fromString(request.role());
        Employee manager = resolveAndValidateManager(null, role, request.reportingManagerId());

        Employee emp = new Employee();
        emp.setEmployeeCode(code);
        emp.setUsername(username);
        emp.setFullName(request.fullName().trim());
        emp.setMobile(mobile);
        emp.setEmail(email);
        emp.setAddress(request.address() != null ? request.address().trim() : null);
        emp.setEmployeeRole(role);
        emp.setStatus(parseStatusOrDefault(request.status(), EmployeeStatus.ACTIVE));
        emp.setPasswordHash(passwordEncoder.encode(request.initialPassword()));
        emp.setPasswordLastChanged(Instant.now());
        emp.setReportingManagerId(manager != null ? manager.getId() : null);
        emp.setSessionVersion(1);
        UUID adminUuid = tryParseUuid(adminPrincipal != null ? adminPrincipal.userId() : null);
        emp.setCreatedByAdminId(adminUuid);
        emp.setUpdatedByAdminId(adminUuid);

        Employee saved = employeeRepository.save(emp);

        List<EmployeeScope> scopes = employeeScopeService.buildValidatedScopes(
                saved, role, request.scopes(), request.territoryLabel(), manager
        );
        employeeScopeRepository.saveAll(scopes);
        saved.setTerritoryLabel(employeeScopeService.buildTerritorySummary(role, scopes));
        employeeRepository.save(saved);

        List<EmployeePermission> permissions = employeePermissionService.resolveAndBuildPermissions(
                saved, request.permissions(), adminUuid
        );
        if (!permissions.isEmpty()) {
            employeePermissionRepository.saveAll(permissions);
        }

        employeeAuditService.log(
                saved, "ADMIN",
                adminPrincipal != null ? adminPrincipal.userId() : null,
                adminPrincipal != null ? adminPrincipal.username() : "admin",
                "EMPLOYEE_CREATED", null, saved.getId(),
                "Created employee " + saved.getEmployeeCode() + " (" + role.getDisplayName() + ") with " + permissions.size() + " permissions",
                clientIp, userAgent, "SUCCESS"
        );

        return employeeAuthService.toProfileView(saved);
    }

    @Transactional
    public EmployeeDtos.EmployeeProfileView updateEmployee(
            UUID employeeId,
            EmployeeDtos.UpdateEmployeeRequest request,
            JwtPrincipal adminPrincipal,
            String clientIp,
            String userAgent
    ) {
        Employee emp = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found"));

        if (request.fullName() != null && !request.fullName().isBlank()) {
            emp.setFullName(request.fullName().trim());
        }
        if (request.mobile() != null && !request.mobile().isBlank()) {
            String mobile = request.mobile().trim();
            if (!mobile.equals(emp.getMobile()) && employeeRepository.existsByMobile(mobile)) {
                throw new IllegalArgumentException("Mobile number is already assigned to another employee.");
            }
            emp.setMobile(mobile);
        }
        if (request.email() != null && !request.email().isBlank()) {
            String email = request.email().trim().toLowerCase(Locale.ROOT);
            if (!email.equalsIgnoreCase(emp.getEmail()) && employeeRepository.existsByEmailIgnoreCase(email)) {
                throw new IllegalArgumentException("Email address is already assigned to another employee.");
            }
            emp.setEmail(email);
        }
        if (request.address() != null) {
            emp.setAddress(request.address().trim());
        }

        Employee manager = emp.getReportingManagerId() == null ? null
                : employeeRepository.findById(emp.getReportingManagerId()).orElse(null);

        if (request.reportingManagerId() != null) {
            manager = resolveAndValidateManager(emp.getId(), emp.getEmployeeRole(), request.reportingManagerId());
            emp.setReportingManagerId(manager != null ? manager.getId() : null);
        }

        if (request.scopes() != null || request.territoryLabel() != null) {
            employeeScopeRepository.deleteByEmployeeId(emp.getId());
            employeeScopeRepository.flush();
            List<EmployeeScope> scopes = employeeScopeService.buildValidatedScopes(
                    emp, emp.getEmployeeRole(), request.scopes(), request.territoryLabel(), manager
            );
            employeeScopeRepository.saveAll(scopes);
            emp.setTerritoryLabel(employeeScopeService.buildTerritorySummary(emp.getEmployeeRole(), scopes));
        }

        UUID adminUuid = tryParseUuid(adminPrincipal != null ? adminPrincipal.userId() : null);
        if (request.permissions() != null) {
            employeePermissionRepository.deleteByEmployeeId(emp.getId());
            employeePermissionRepository.flush();
            List<EmployeePermission> perms = employeePermissionService.resolveAndBuildPermissions(emp, request.permissions(), adminUuid);
            if (!perms.isEmpty()) {
                employeePermissionRepository.saveAll(perms);
            }
        }

        emp.setUpdatedByAdminId(adminUuid);
        Employee saved = employeeRepository.save(emp);

        employeeAuditService.log(
                saved, "ADMIN",
                adminPrincipal != null ? adminPrincipal.userId() : null,
                adminPrincipal != null ? adminPrincipal.username() : "admin",
                "EMPLOYEE_UPDATED", null, saved.getId(),
                "Updated employee profile/scope/hierarchy settings",
                clientIp, userAgent, "SUCCESS"
        );
        return employeeAuthService.toProfileView(saved);
    }

    @Transactional
    public EmployeeDtos.EmployeeProfileView updateEmployeeStatus(
            UUID employeeId,
            EmployeeDtos.UpdateStatusRequest request,
            JwtPrincipal adminPrincipal,
            String clientIp,
            String userAgent
    ) {
        Employee emp = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found"));

        EmployeeStatus newStatus = parseStatusOrDefault(request.status(), null);
        if (newStatus == null) {
            throw new IllegalArgumentException("Invalid status. Allowed: ACTIVE, INACTIVE, SUSPENDED");
        }
        EmployeeStatus prev = emp.getStatus();
        emp.setStatus(newStatus);
        if (newStatus != EmployeeStatus.ACTIVE) {
            emp.setSessionVersion((emp.getSessionVersion() == null ? 1 : emp.getSessionVersion()) + 1);
            employeeRefreshTokenRepository.revokeAllByEmployeeId(emp.getId());
        }
        emp.setUpdatedByAdminId(tryParseUuid(adminPrincipal != null ? adminPrincipal.userId() : null));
        Employee saved = employeeRepository.save(emp);

        employeeAuditService.log(
                saved, "ADMIN",
                adminPrincipal != null ? adminPrincipal.userId() : null,
                adminPrincipal != null ? adminPrincipal.username() : "admin",
                "EMPLOYEE_STATUS_CHANGED", null, saved.getId(),
                "Status changed from " + prev + " to " + newStatus
                        + (request.reason() != null && !request.reason().isBlank() ? " (" + request.reason().trim() + ")" : ""),
                clientIp, userAgent, "SUCCESS"
        );
        return employeeAuthService.toProfileView(saved);
    }

    @Transactional
    public void resetEmployeePassword(
            UUID employeeId,
            EmployeeDtos.ResetPasswordRequest request,
            JwtPrincipal adminPrincipal,
            String clientIp,
            String userAgent
    ) {
        Employee emp = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found"));

        emp.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        emp.setPasswordLastChanged(Instant.now());
        emp.setFailedLoginAttempts(0);
        emp.setLockedUntil(null);
        emp.setSessionVersion((emp.getSessionVersion() == null ? 1 : emp.getSessionVersion()) + 1);
        emp.setUpdatedByAdminId(tryParseUuid(adminPrincipal != null ? adminPrincipal.userId() : null));
        employeeRepository.save(emp);
        employeeRefreshTokenRepository.revokeAllByEmployeeId(emp.getId());

        employeeAuditService.log(
                emp, "ADMIN",
                adminPrincipal != null ? adminPrincipal.userId() : null,
                adminPrincipal != null ? adminPrincipal.username() : "admin",
                "EMPLOYEE_PASSWORD_RESET", null, emp.getId(),
                "Admin reset employee password and invalidated active sessions",
                clientIp, userAgent, "SUCCESS"
        );
    }

    @Transactional
    public EmployeeDtos.EmployeeProfileView updateEmployeePermissions(
            UUID employeeId,
            EmployeeDtos.UpdatePermissionsRequest request,
            JwtPrincipal adminPrincipal,
            String clientIp,
            String userAgent
    ) {
        Employee emp = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found"));

        UUID adminUuid = tryParseUuid(adminPrincipal != null ? adminPrincipal.userId() : null);
        employeePermissionRepository.deleteByEmployeeId(emp.getId());
        employeePermissionRepository.flush();

        List<EmployeePermission> perms = employeePermissionService.resolveAndBuildPermissions(
                emp, request != null ? request.permissions() : List.of(), adminUuid
        );
        if (!perms.isEmpty()) {
            employeePermissionRepository.saveAll(perms);
        }

        emp.setUpdatedByAdminId(adminUuid);
        Employee saved = employeeRepository.save(emp);

        employeeAuditService.log(
                saved, "ADMIN",
                adminPrincipal != null ? adminPrincipal.userId() : null,
                adminPrincipal != null ? adminPrincipal.username() : "admin",
                "EMPLOYEE_PERMISSIONS_UPDATED", null, saved.getId(),
                "Updated permission matrix to " + perms.size() + " granted permissions",
                clientIp, userAgent, "SUCCESS"
        );
        return employeeAuthService.toProfileView(saved);
    }

    @Transactional(readOnly = true)
    public List<EmployeeDtos.EmployeeProfileView> listEmployees(String roleFilter, String statusFilter, String search) {
        String cleanSearch = search == null || search.isBlank() ? null : search.trim().toLowerCase(Locale.ROOT);
        EmployeeRole targetRole = null;
        if (roleFilter != null && !roleFilter.isBlank() && !"ALL".equalsIgnoreCase(roleFilter.trim())) {
            targetRole = EmployeeRole.fromString(roleFilter);
        }
        EmployeeStatus targetStatus = parseStatusOrDefault(statusFilter, null);

        EmployeeRole finalRole = targetRole;
        return employeeRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(e -> finalRole == null || e.getEmployeeRole() == finalRole)
                .filter(e -> targetStatus == null || e.getStatus() == targetStatus)
                .filter(e -> cleanSearch == null
                        || contains(e.getFullName(), cleanSearch)
                        || contains(e.getEmployeeCode(), cleanSearch)
                        || contains(e.getUsername(), cleanSearch)
                        || contains(e.getMobile(), cleanSearch)
                        || contains(e.getTerritoryLabel(), cleanSearch))
                .map(employeeAuthService::toProfileView)
                .toList();
    }

    @Transactional(readOnly = true)
    public EmployeeDtos.EmployeeProfileView getEmployeeProfile(UUID employeeId) {
        Employee emp = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found"));
        return employeeAuthService.toProfileView(emp);
    }

    @Transactional(readOnly = true)
    public List<EmployeeDtos.EmployeeProfileView> listEligibleManagers(String rawChildRole) {
        EmployeeRole childRole = EmployeeRole.fromString(rawChildRole);
        if (childRole == EmployeeRole.NATIONAL_HEADER) {
            return List.of();
        }
        List<EmployeeRole> allowedManagerRoles = childRole == EmployeeRole.STATE_HEADER
                ? List.of(EmployeeRole.NATIONAL_HEADER)
                : List.of(EmployeeRole.STATE_HEADER, EmployeeRole.NATIONAL_HEADER);

        return employeeRepository.findByEmployeeRoleInAndStatus(allowedManagerRoles, EmployeeStatus.ACTIVE).stream()
                .map(employeeAuthService::toProfileView)
                .toList();
    }

    @Transactional(readOnly = true)
    public EmployeeDtos.EmployeePerformanceItem getEmployeePerformance(
            UUID employeeId,
            String fromDate,
            String toDate
    ) {
        Employee emp = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found"));
        List<Employee> allEmployees = employeeRepository.findAll();
        List<User> allMemberUsers = userRepository.findAll().stream()
                .filter(employeeScopeService::isMemberUser)
                .toList();

        Instant start = EmployeeMetricsService.parseFromInstant(fromDate);
        Instant end = EmployeeMetricsService.parseToInstant(toDate);

        return buildPerformanceItem(emp, allEmployees, allMemberUsers, start, end);
    }

    @Transactional(readOnly = true)
    public List<EmployeeDtos.EmployeePerformanceItem> listPerformanceSummary(
            String roleFilter,
            String statusFilter,
            String search,
            String fromDate,
            String toDate
    ) {
        List<Employee> allEmployees = employeeRepository.findAllByOrderByCreatedAtDesc();
        List<User> allMemberUsers = userRepository.findAll().stream()
                .filter(employeeScopeService::isMemberUser)
                .toList();

        EmployeeRole targetRole = null;
        if (roleFilter != null && !roleFilter.isBlank() && !"ALL".equalsIgnoreCase(roleFilter.trim())) {
            targetRole = EmployeeRole.fromString(roleFilter);
        }
        EmployeeStatus targetStatus = parseStatusOrDefault(statusFilter, null);
        String cleanSearch = search == null || search.isBlank() ? null : search.trim().toLowerCase(Locale.ROOT);
        Instant start = EmployeeMetricsService.parseFromInstant(fromDate);
        Instant end = EmployeeMetricsService.parseToInstant(toDate);

        EmployeeRole finalRole = targetRole;
        return allEmployees.stream()
                .filter(e -> finalRole == null || e.getEmployeeRole() == finalRole)
                .filter(e -> targetStatus == null || e.getStatus() == targetStatus)
                .filter(e -> cleanSearch == null
                        || contains(e.getFullName(), cleanSearch)
                        || contains(e.getEmployeeCode(), cleanSearch)
                        || contains(e.getUsername(), cleanSearch)
                        || contains(e.getTerritoryLabel(), cleanSearch))
                .map(emp -> buildPerformanceItem(emp, allEmployees, allMemberUsers, start, end))
                .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getReadOnlyPermissionPreview(UUID employeeId) {
        EmployeeDtos.EmployeeProfileView profile = getEmployeeProfile(employeeId);
        List<EmployeeDtos.PermissionCategoryView> catalog = employeePermissionService.getCatalogView();
        Set<String> granted = new HashSet<>(profile.permissions());

        List<Map<String, Object>> matrix = catalog.stream().map(cat -> {
            List<Map<String, Object>> items = cat.items().stream().map(item -> Map.<String, Object>of(
                    "code", item.code(),
                    "label", item.label(),
                    "allowed", granted.contains(item.code()),
                    "onboardingWrite", item.onboardingWrite()
            )).toList();
            return Map.<String, Object>of(
                    "category", cat.category(),
                    "categoryLabel", cat.categoryLabel(),
                    "items", items
            );
        }).toList();

        return Map.of(
                "employee", profile,
                "readOnlyPreview", true,
                "canModifyUsersOrWallets", false,
                "canOnboardRetailer", granted.contains(EmployeePermissionCatalog.CREATE_RETAILER_ACCOUNT),
                "canOnboardDistributor", granted.contains(EmployeePermissionCatalog.CREATE_DISTRIBUTOR_ACCOUNT),
                "canOnboardSuperDistributor", granted.contains(EmployeePermissionCatalog.CREATE_SUPER_DISTRIBUTOR_ACCOUNT),
                "matrix", matrix
        );
    }

    @Transactional(readOnly = true)
    public List<EmployeeDtos.EmployeeAuditLogView> getAuditLogs(UUID employeeId) {
        if (employeeId == null) {
            return employeeAuditService.getRecentAll();
        }
        return employeeAuditService.getRecentForEmployee(employeeId, 150);
    }

    private EmployeeDtos.EmployeePerformanceItem buildPerformanceItem(
            Employee emp,
            List<Employee> allEmployees,
            List<User> allMemberUsers,
            Instant start,
            Instant end
    ) {
        EmployeeDtos.EmployeeProfileView profile = employeeAuthService.toProfileView(emp);
        List<EmployeeScope> scopes = employeeScopeRepository.findByEmployeeId(emp.getId());
        Set<UUID> subordinateIds = employeeScopeService.resolveSubordinateEmployeeIds(emp.getId(), allEmployees);

        long directUsers = 0;
        long directRetailers = 0;
        long directDistributors = 0;
        long directSuperDistributors = 0;

        Map<UUID, User> hierarchyScopedUsers = new LinkedHashMap<>();
        long hierarchyRetailers = 0;
        long hierarchyDistributors = 0;
        long hierarchySuperDistributors = 0;

        for (User u : allMemberUsers) {
            boolean createdInRange = (start == null || !u.getCreatedAt().isBefore(start))
                    && (end == null || !u.getCreatedAt().isAfter(end));

            RoleName roleName = primaryRole(u);
            if (emp.getId().equals(u.getOnboardedByEmployeeId()) && createdInRange) {
                directUsers++;
                if (roleName == RoleName.RETAILER) directRetailers++;
                else if (roleName == RoleName.DISTRIBUTOR) directDistributors++;
                else if (roleName == RoleName.SUPER_DISTRIBUTOR) directSuperDistributors++;
            }

            boolean inScope = employeeScopeService.isUserInEmployeeScope(u, emp, scopes)
                    || (u.getOnboardedByEmployeeId() != null
                    && (emp.getId().equals(u.getOnboardedByEmployeeId()) || subordinateIds.contains(u.getOnboardedByEmployeeId())));

            if (inScope) {
                hierarchyScopedUsers.put(u.getId(), u);
                if (roleName == RoleName.RETAILER) hierarchyRetailers++;
                else if (roleName == RoleName.DISTRIBUTOR) hierarchyDistributors++;
                else if (roleName == RoleName.SUPER_DISTRIBUTOR) hierarchySuperDistributors++;
            }
        }

        EmployeeMetricsService.MetricsResult metrics = employeeMetricsService.computeMetrics(
                hierarchyScopedUsers,
                null,
                start,
                end,
                "ALL",
                null,
                null
        );

        return new EmployeeDtos.EmployeePerformanceItem(
                profile.id(),
                profile.employeeCode(),
                profile.username(),
                profile.fullName(),
                profile.mobile(),
                profile.email(),
                profile.role(),
                profile.roleDisplayName(),
                profile.status(),
                profile.reportingManagerId(),
                profile.reportingManagerName(),
                profile.reportingManagerCode(),
                profile.territoryLabel(),
                profile.scopes(),
                profile.permissions(),
                directUsers,
                directRetailers,
                directDistributors,
                directSuperDistributors,
                hierarchyScopedUsers.size(),
                hierarchyRetailers,
                hierarchyDistributors,
                hierarchySuperDistributors,
                subordinateIds.size(),
                metrics.totalTransactions(),
                metrics.successTransactions(),
                metrics.failedTransactions(),
                metrics.pendingTransactions(),
                metrics.totalVolume(),
                profile.lastLoginAt(),
                profile.createdAt(),
                metrics.serviceBreakdown(),
                metrics.dailyTrend()
        );
    }

    private Employee resolveAndValidateManager(UUID selfId, EmployeeRole childRole, String managerIdRaw) {
        if (managerIdRaw == null || managerIdRaw.isBlank() || "ADMIN".equalsIgnoreCase(managerIdRaw.trim())) {
            return null;
        }
        if (childRole == EmployeeRole.NATIONAL_HEADER) {
            throw new IllegalArgumentException("National Head reports directly to Admin and cannot have an employee manager.");
        }
        UUID mgrId = tryParseUuid(managerIdRaw);
        if (mgrId == null) {
            throw new IllegalArgumentException("Invalid reporting manager ID.");
        }
        if (selfId != null && selfId.equals(mgrId)) {
            throw new IllegalArgumentException("Employee cannot report to themselves.");
        }
        Employee manager = employeeRepository.findById(mgrId)
                .orElseThrow(() -> new IllegalArgumentException("Reporting manager not found."));
        if (!manager.getEmployeeRole().canManage(childRole)) {
            throw new IllegalArgumentException(
                    manager.getEmployeeRole().getDisplayName() + " cannot manage a " + childRole.getDisplayName() + "."
            );
        }
        if (selfId != null) {
            Set<UUID> subTree = employeeScopeService.resolveSubordinateEmployeeIds(selfId);
            if (subTree.contains(mgrId)) {
                throw new IllegalArgumentException("Circular reporting hierarchy is not allowed.");
            }
        }
        return manager;
    }

    private RoleName primaryRole(User u) {
        if (u.getRoles() == null || u.getRoles().isEmpty()) return RoleName.RETAILER;
        return u.getRoles().iterator().next().getName();
    }

    private EmployeeStatus parseStatusOrDefault(String raw, EmployeeStatus fallback) {
        if (raw == null || raw.isBlank() || "ALL".equalsIgnoreCase(raw.trim())) {
            return fallback;
        }
        try {
            return EmployeeStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }

    private UUID tryParseUuid(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return UUID.fromString(s.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private boolean contains(String v, String s) {
        return v != null && v.toLowerCase(Locale.ROOT).contains(s);
    }
}
