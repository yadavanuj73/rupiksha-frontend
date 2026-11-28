package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.security.JwtPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmployeePortalService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final EmployeeAuthService employeeAuthService;
    private final EmployeePermissionService employeePermissionService;
    private final EmployeeScopeService employeeScopeService;
    private final EmployeeMetricsService employeeMetricsService;
    private final EmployeeAuditService employeeAuditService;
    private final EmployeeRepository employeeRepository;
    private final EmployeeScopeRepository employeeScopeRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final WalletRepository walletRepository;
    private final UserServiceRepository userServiceRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public EmployeeDtos.EmployeeDashboardResponse getDashboard(
            JwtPrincipal principal,
            String fromDate,
            String toDate
    ) {
        Employee emp = employeeAuthService.requireActiveAuthenticatedEmployee(principal);
        employeePermissionService.requirePermission(emp.getId(), EmployeePermissionCatalog.VIEW_DASHBOARD);

        Set<String> granted = employeePermissionService.getPermissionCodes(emp.getId());
        List<Employee> allEmployees = employeeRepository.findAll();
        List<EmployeeScope> scopes = employeeScopeRepository.findByEmployeeId(emp.getId());
        Set<UUID> subordinateIds = employeeScopeService.resolveSubordinateEmployeeIds(emp.getId(), allEmployees);
        Map<UUID, User> scopedUsers = resolveScopedUsersMap(emp, scopes, subordinateIds);

        boolean canViewUsers = granted.contains(EmployeePermissionCatalog.VIEW_USER_STATISTICS)
                || granted.contains(EmployeePermissionCatalog.VIEW_RETAILERS)
                || granted.contains(EmployeePermissionCatalog.VIEW_DISTRIBUTORS)
                || granted.contains(EmployeePermissionCatalog.VIEW_SUPER_DISTRIBUTORS);

        long totalRetailers = 0;
        long totalDistributors = 0;
        long totalSuperDistributors = 0;
        long directOnboarded = 0;
        for (User u : scopedUsers.values()) {
            if (emp.getId().equals(u.getOnboardedByEmployeeId())) {
                directOnboarded++;
            }
            if (canViewUsers) {
                RoleName rn = primaryRole(u);
                if (rn == RoleName.RETAILER) totalRetailers++;
                else if (rn == RoleName.DISTRIBUTOR) totalDistributors++;
                else if (rn == RoleName.SUPER_DISTRIBUTOR) totalSuperDistributors++;
            }
        }

        long subordinateCount = granted.contains(EmployeePermissionCatalog.VIEW_EMPLOYEE_STATISTICS)
                || granted.contains(EmployeePermissionCatalog.VIEW_EMPLOYEES_UNDER_HIERARCHY)
                ? subordinateIds.size() : 0;

        boolean canViewTxnMetrics = granted.contains(EmployeePermissionCatalog.VIEW_TRANSACTION_METRICS)
                || granted.contains(EmployeePermissionCatalog.VIEW_SALES_METRICS)
                || granted.contains(EmployeePermissionCatalog.VIEW_TRANSACTIONS);

        EmployeeMetricsService.MetricsResult metrics;
        if (canViewTxnMetrics) {
            Set<String> allowedCats = resolveAllowedTransactionCategories(granted, true);
            Instant start = EmployeeMetricsService.parseFromInstant(fromDate);
            Instant end = EmployeeMetricsService.parseToInstant(toDate);
            metrics = employeeMetricsService.computeMetrics(scopedUsers, allowedCats, start, end, "ALL", null, null);
        } else {
            metrics = new EmployeeMetricsService.MetricsResult(0, 0, 0, 0, BigDecimal.ZERO, List.of(), List.of(), List.of());
        }

        boolean showVolume = granted.contains(EmployeePermissionCatalog.VIEW_SALES_METRICS)
                || granted.contains(EmployeePermissionCatalog.VIEW_TRANSACTION_METRICS);
        boolean showRecentTxns = granted.contains(EmployeePermissionCatalog.VIEW_TRANSACTIONS);

        return new EmployeeDtos.EmployeeDashboardResponse(
                employeeAuthService.toProfileView(emp),
                true,
                canViewUsers ? scopedUsers.size() : 0,
                canViewUsers ? totalRetailers : 0,
                canViewUsers ? totalDistributors : 0,
                canViewUsers ? totalSuperDistributors : 0,
                subordinateCount,
                directOnboarded,
                metrics.totalTransactions(),
                metrics.successTransactions(),
                metrics.failedTransactions(),
                metrics.pendingTransactions(),
                showVolume ? metrics.totalVolume() : BigDecimal.ZERO,
                metrics.serviceBreakdown(),
                showVolume ? metrics.dailyTrend() : List.of(),
                showRecentTxns ? metrics.transactions().stream().limit(15).toList() : List.of()
        );
    }

    @Transactional(readOnly = true)
    public List<EmployeeDtos.ScopedMemberSummary> listScopedMembers(
            JwtPrincipal principal,
            String roleFilter,
            String statusFilter,
            String search
    ) {
        Employee emp = employeeAuthService.requireActiveAuthenticatedEmployee(principal);
        Set<String> granted = employeePermissionService.getPermissionCodes(emp.getId());

        Set<RoleName> allowedRoles = new LinkedHashSet<>();
        if (granted.contains(EmployeePermissionCatalog.VIEW_RETAILERS)) allowedRoles.add(RoleName.RETAILER);
        if (granted.contains(EmployeePermissionCatalog.VIEW_DISTRIBUTORS)) allowedRoles.add(RoleName.DISTRIBUTOR);
        if (granted.contains(EmployeePermissionCatalog.VIEW_SUPER_DISTRIBUTORS)) allowedRoles.add(RoleName.SUPER_DISTRIBUTOR);

        if (allowedRoles.isEmpty()) {
            throw new AccessDeniedException("You do not have permission to view member accounts.");
        }

        RoleName requestedRole = null;
        if (roleFilter != null && !roleFilter.isBlank() && !"ALL".equalsIgnoreCase(roleFilter.trim())) {
            requestedRole = parseMemberRole(roleFilter);
            if (!allowedRoles.contains(requestedRole)) {
                throw new AccessDeniedException("You do not have permission to view " + requestedRole.name() + " accounts.");
            }
        }

        List<Employee> allEmployees = employeeRepository.findAll();
        List<EmployeeScope> scopes = employeeScopeRepository.findByEmployeeId(emp.getId());
        Set<UUID> subordinateIds = employeeScopeService.resolveSubordinateEmployeeIds(emp.getId(), allEmployees);
        Map<UUID, User> scopedUsers = resolveScopedUsersMap(emp, scopes, subordinateIds);

        String cleanStatus = statusFilter == null || statusFilter.isBlank() || "ALL".equalsIgnoreCase(statusFilter.trim())
                ? null : statusFilter.trim().toUpperCase(Locale.ROOT);
        String cleanSearch = search == null || search.isBlank()
                ? null : search.trim().toLowerCase(Locale.ROOT);

        RoleName finalReqRole = requestedRole;
        List<User> matching = scopedUsers.values().stream()
                .filter(u -> allowedRoles.contains(primaryRole(u)))
                .filter(u -> finalReqRole == null || primaryRole(u) == finalReqRole)
                .filter(u -> cleanStatus == null || (u.getStatus() != null && u.getStatus().name().equalsIgnoreCase(cleanStatus)))
                .filter(u -> cleanSearch == null
                        || contains(u.getFullName(), cleanSearch)
                        || contains(u.getUsername(), cleanSearch)
                        || contains(u.getMobile(), cleanSearch)
                        || contains(u.getPartyCode(), cleanSearch)
                        || contains(u.getBusinessName(), cleanSearch)
                        || contains(u.getStateName(), cleanSearch)
                        || contains(u.getCity(), cleanSearch))
                .sorted(Comparator.comparing(User::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        List<UUID> ids = matching.stream().map(User::getId).toList();
        Map<UUID, BigDecimal> walletMap = ids.isEmpty() ? Map.of() :
                walletRepository.findByUserIdIn(ids).stream()
                        .filter(w -> w.getUser() != null)
                        .collect(Collectors.toMap(
                                w -> w.getUser().getId(),
                                w -> w.getBalance() != null ? w.getBalance() : BigDecimal.ZERO,
                                (a, b) -> a
                        ));

        boolean canViewKyc = granted.contains(EmployeePermissionCatalog.VIEW_USER_KYC_STATUS);
        return matching.stream()
                .map(u -> toMemberSummary(u, walletMap.getOrDefault(u.getId(), BigDecimal.ZERO), canViewKyc))
                .toList();
    }

    @Transactional(readOnly = true)
    public EmployeeDtos.ScopedMemberDetail getScopedMemberDetail(JwtPrincipal principal, UUID memberId) {
        Employee emp = employeeAuthService.requireActiveAuthenticatedEmployee(principal);
        Set<String> granted = employeePermissionService.getPermissionCodes(emp.getId());
        employeePermissionService.requirePermission(emp.getId(), EmployeePermissionCatalog.VIEW_USER_DETAILS);

        User target = userRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Member not found"));

        if (!employeeScopeService.isMemberUser(target)) {
            throw new AccessDeniedException("Restricted account cannot be accessed by employees.");
        }

        RoleName targetRole = primaryRole(target);
        if (targetRole == RoleName.RETAILER && !granted.contains(EmployeePermissionCatalog.VIEW_RETAILERS)) {
            throw new AccessDeniedException("Missing permission to view retailer details.");
        }
        if (targetRole == RoleName.DISTRIBUTOR && !granted.contains(EmployeePermissionCatalog.VIEW_DISTRIBUTORS)) {
            throw new AccessDeniedException("Missing permission to view distributor details.");
        }
        if (targetRole == RoleName.SUPER_DISTRIBUTOR && !granted.contains(EmployeePermissionCatalog.VIEW_SUPER_DISTRIBUTORS)) {
            throw new AccessDeniedException("Missing permission to view super distributor details.");
        }

        List<Employee> allEmployees = employeeRepository.findAll();
        List<EmployeeScope> scopes = employeeScopeRepository.findByEmployeeId(emp.getId());
        Set<UUID> subordinateIds = employeeScopeService.resolveSubordinateEmployeeIds(emp.getId(), allEmployees);
        boolean inScope = employeeScopeService.isUserInHierarchyAndScope(target, emp, scopes, subordinateIds);

        if (!inScope) {
            employeeAuditService.log(
                    emp, "EMPLOYEE", emp.getId().toString(), emp.getUsername(),
                    "EMPLOYEE_ACCESS_DENIED", target.getId(), null,
                    "Attempted cross-scope member access for user " + target.getId(),
                    null, null, "DENIED"
            );
            throw new AccessDeniedException("Requested user is outside your assigned hierarchy scope.");
        }

        BigDecimal walletBalance = walletRepository.findByUserId(target.getId())
                .map(Wallet::getBalance)
                .orElse(BigDecimal.ZERO);

        boolean canViewKyc = granted.contains(EmployeePermissionCatalog.VIEW_USER_KYC_STATUS);
        return new EmployeeDtos.ScopedMemberDetail(
                toMemberSummary(target, walletBalance, canViewKyc),
                target.getFatherName(),
                target.getDob(),
                target.getGender(),
                target.getBusinessType(),
                target.getGstNumber(),
                target.getAddressLine1(),
                target.getShopAddress(),
                target.getShopDistrict(),
                target.getShopPincode(),
                target.getPermanentAddress(),
                canViewKyc ? maskIdentity(target.getPanNumber(), 4) : "RESTRICTED",
                canViewKyc ? maskIdentity(target.getAadhaarNumber(), 4) : "RESTRICTED",
                target.getBankName(),
                target.getBankIfsc(),
                maskIdentity(target.getBankAccountNumber(), 4)
        );
    }

    @Transactional(readOnly = true)
    public List<EmployeeDtos.ScopedMemberSummary> getCandidateParents(JwtPrincipal principal, String targetRoleRaw) {
        Employee emp = employeeAuthService.requireActiveAuthenticatedEmployee(principal);
        RoleName targetRole = parseMemberRole(targetRoleRaw);
        requireCreatePermission(emp.getId(), targetRole);

        if (targetRole == RoleName.SUPER_DISTRIBUTOR) {
            return List.of();
        }

        Set<RoleName> validParentRoles = targetRole == RoleName.RETAILER
                ? Set.of(RoleName.DISTRIBUTOR, RoleName.SUPER_DISTRIBUTOR)
                : Set.of(RoleName.SUPER_DISTRIBUTOR);

        List<Employee> allEmployees = employeeRepository.findAll();
        List<EmployeeScope> scopes = employeeScopeRepository.findByEmployeeId(emp.getId());
        Set<UUID> subordinateIds = employeeScopeService.resolveSubordinateEmployeeIds(emp.getId(), allEmployees);
        Map<UUID, User> scopedUsers = resolveScopedUsersMap(emp, scopes, subordinateIds);

        return scopedUsers.values().stream()
                .filter(u -> u.getStatus() == UserStatus.ACTIVE || u.getStatus() == UserStatus.APPROVED)
                .filter(u -> validParentRoles.contains(primaryRole(u)))
                .map(u -> toMemberSummary(u, BigDecimal.ZERO, false))
                .toList();
    }

    @Transactional
    public EmployeeDtos.ScopedMemberSummary onboardMember(
            JwtPrincipal principal,
            EmployeeDtos.OnboardMemberRequest request,
            String clientIp,
            String userAgent
    ) {
        Employee emp = employeeAuthService.requireActiveAuthenticatedEmployee(principal);
        RoleName roleName = parseMemberRole(request.role());
        requireCreatePermission(emp.getId(), roleName);

        List<EmployeeScope> scopes = employeeScopeRepository.findByEmployeeId(emp.getId());
        String effectiveState = firstNonBlank(request.state(), request.shopState(), request.permState());
        String effectiveCity = firstNonBlank(request.city(), request.shopCity(), request.shopDistrict(), request.permCity(), request.permDistrict());
        String effectiveZone = firstNonBlank(request.zoneName(), employeeScopeService.inferZoneForState(effectiveState));

        try {
            employeeScopeService.validateLocationWithinEmployeeScope(emp, scopes, effectiveState, effectiveCity, effectiveZone);
        } catch (IllegalArgumentException ex) {
            employeeAuditService.log(
                    emp, "EMPLOYEE", emp.getId().toString(), emp.getUsername(),
                    "EMPLOYEE_ACCESS_DENIED", null, null,
                    "Blocked out-of-scope member onboarding attempt for state=" + effectiveState + ", zone=" + effectiveZone,
                    clientIp, userAgent, "DENIED"
            );
            throw new AccessDeniedException(ex.getMessage());
        }

        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new IllegalStateException("Role seed missing: " + roleName));

        String mobile = request.mobile().trim();
        String email = request.email().trim();
        if (userRepository.findByMobileAndRole(mobile, roleName).isPresent()) {
            throw new IllegalArgumentException("Mobile number already registered for " + roleName.name().toLowerCase() + " role.");
        }
        if (userRepository.findByEmailAndRole(email, roleName).isPresent()) {
            throw new IllegalArgumentException("Email already registered for " + roleName.name().toLowerCase() + " role.");
        }

        String targetUsername = request.username().trim();
        if (userRepository.findByUsername(targetUsername).isPresent()) {
            targetUsername = targetUsername + "_" + roleName.name();
            if (userRepository.findByUsername(targetUsername).isPresent()) {
                throw new IllegalArgumentException("Username already exists.");
            }
        }

        User user = new User();
        user.setUsername(targetUsername);
        user.setMobile(mobile);
        user.setEmail(email);
        user.setFullName(request.fullName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        if (hasText(request.pin())) {
            user.setPinHash(passwordEncoder.encode(request.pin().trim()));
            user.setPinLastChanged(Instant.now());
        }
        user.setPasswordLastChanged(Instant.now());
        user.setOtpVerified(true);

        // Employees onboard users without bypassing Admin KYC approval workflow
        boolean hasDocs = hasText(request.aadhaarNumber()) || hasText(request.panNumber())
                || hasText(request.aadhaarPhotoUrl()) || hasText(request.panPhotoUrl());
        user.setStatus(UserStatus.ACTIVE);
        user.setRegistrationStatus(RegistrationStatus.ACCOUNT_CREATED);
        user.setKycStatus(hasDocs ? KycStatus.PENDING : KycStatus.NOT_SUBMITTED);
        if (hasDocs) {
            user.setKycSubmittedAt(Instant.now());
        }
        user.setIdPaymentStatus(IdPaymentStatus.PENDING);
        user.getRoles().add(role);

        String canonicalState = effectiveState != null ? employeeScopeService.canonicalStateName(effectiveState) : null;
        user.setPartyCode(generatePartyCode(canonicalState, roleName));
        user.setStateName(canonicalState);
        user.setCity(effectiveCity);
        user.setZoneName(effectiveZone);
        if (hasText(request.pincode())) user.setPincode(request.pincode().trim());
        if (hasText(request.address())) user.setAddressLine1(request.address().trim());
        if (hasText(request.businessName())) user.setBusinessName(request.businessName().trim());
        if (hasText(request.firstName())) user.setFirstName(request.firstName().trim());
        if (hasText(request.lastName())) user.setLastName(request.lastName().trim());
        if (hasText(request.dob())) user.setDob(request.dob().trim());
        if (hasText(request.fatherName())) user.setFatherName(request.fatherName().trim());
        if (hasText(request.gender())) user.setGender(request.gender().trim());
        if (hasText(request.businessType())) user.setBusinessType(request.businessType().trim());
        if (hasText(request.gstNumber())) user.setGstNumber(request.gstNumber().trim());

        if (hasText(request.shopLandmark())) user.setShopLandmark(request.shopLandmark().trim());
        if (hasText(request.shopAddress())) user.setShopAddress(request.shopAddress().trim());
        user.setShopState(hasText(request.shopState()) ? employeeScopeService.canonicalStateName(request.shopState()) : canonicalState);
        if (hasText(request.shopDistrict())) user.setShopDistrict(request.shopDistrict().trim());
        user.setShopCity(hasText(request.shopCity()) ? request.shopCity().trim() : effectiveCity);
        if (hasText(request.shopPincode())) user.setShopPincode(request.shopPincode().trim());

        if (hasText(request.permanentAddress())) user.setPermanentAddress(request.permanentAddress().trim());
        if (hasText(request.permState())) user.setPermState(employeeScopeService.canonicalStateName(request.permState()));
        if (hasText(request.permDistrict())) user.setPermDistrict(request.permDistrict().trim());
        if (hasText(request.permCity())) user.setPermCity(request.permCity().trim());
        if (hasText(request.permPincode())) user.setPermPincode(request.permPincode().trim());

        if (hasText(request.aadhaarNumber())) user.setAadhaarNumber(request.aadhaarNumber().trim());
        if (hasText(request.panNumber())) user.setPanNumber(request.panNumber().trim().toUpperCase(Locale.ROOT));
        if (hasText(request.bankAccountHolder())) user.setBankAccountHolder(request.bankAccountHolder().trim());
        if (hasText(request.bankName())) user.setBankName(request.bankName().trim());
        if (hasText(request.bankAccountNumber())) user.setBankAccountNumber(request.bankAccountNumber().trim());
        if (hasText(request.bankIfsc())) user.setBankIfsc(request.bankIfsc().trim().toUpperCase(Locale.ROOT));
        if (hasText(request.bankBranch())) user.setBankBranch(request.bankBranch().trim());

        if (hasText(request.photoUrl())) user.setPhotoUrl(request.photoUrl().trim());
        if (hasText(request.aadhaarPhotoUrl())) user.setAadhaarPhotoUrl(request.aadhaarPhotoUrl().trim());
        if (hasText(request.aadhaarBackPhotoUrl())) user.setAadhaarBackPhotoUrl(request.aadhaarBackPhotoUrl().trim());
        if (hasText(request.panPhotoUrl())) user.setPanPhotoUrl(request.panPhotoUrl().trim());
        if (hasText(request.shopPhotoUrl())) user.setShopPhotoUrl(request.shopPhotoUrl().trim());
        if (hasText(request.bankPassbookUrl())) user.setBankPassbookUrl(request.bankPassbookUrl().trim());
        if (hasText(request.liveSelfieUrl())) user.setLiveSelfieUrl(request.liveSelfieUrl().trim());

        // Validate & associate partner parent within permitted scope
        resolveAndValidateParentForEmployee(user, roleName, request.parentUserId(), emp, scopes);

        // Bind Employee Hierarchy & Attribution
        user.setOnboardedByEmployeeId(emp.getId());
        user.setOnboardedByEmployeeCode(emp.getEmployeeCode());
        if (user.getAddedByName() == null) {
            user.setAddedByUserRef(emp.getId().toString());
            user.setAddedByName(emp.getFullName());
            user.setAddedByRole(emp.getEmployeeRole().name());
            user.setAddedByPartyCode(emp.getEmployeeCode());
        }

        User saved = userRepository.save(user);

        if (walletRepository.findByUserId(saved.getId()).isEmpty()) {
            Wallet wallet = new Wallet();
            wallet.setUser(saved);
            wallet.setBalance(BigDecimal.ZERO);
            wallet.setLockedBalance(BigDecimal.ZERO);
            walletRepository.save(wallet);
        }

        initializeUserServices(saved);

        employeeAuditService.log(
                emp, "EMPLOYEE", emp.getId().toString(), emp.getUsername(),
                "EMPLOYEE_ONBOARDED_MEMBER", saved.getId(), null,
                "Onboarded " + roleName.name() + " user " + saved.getUsername() + " (" + saved.getPartyCode() + ") in " + canonicalState,
                clientIp, userAgent, "SUCCESS"
        );

        return toMemberSummary(saved, BigDecimal.ZERO, true);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> listScopedTransactions(
            JwtPrincipal principal,
            String category,
            String status,
            String search,
            String fromDate,
            String toDate,
            int page,
            int size
    ) {
        Employee emp = employeeAuthService.requireActiveAuthenticatedEmployee(principal);
        Set<String> granted = employeePermissionService.getPermissionCodes(emp.getId());
        Set<String> allowedCats = resolveAllowedTransactionCategories(granted, false);
        if (allowedCats.isEmpty()) {
            throw new AccessDeniedException("You do not have permission to view transactions.");
        }

        String reqCat = category == null || category.isBlank() ? "ALL" : category.trim().toUpperCase(Locale.ROOT);
        if (!"ALL".equals(reqCat) && !allowedCats.contains(reqCat)) {
            throw new AccessDeniedException("Missing permission for transaction category: " + reqCat);
        }

        Map<UUID, User> scopedUsers = resolveScopedUsersMap(emp);
        Instant start = EmployeeMetricsService.parseFromInstant(fromDate);
        Instant end = EmployeeMetricsService.parseToInstant(toDate);

        EmployeeMetricsService.MetricsResult result = employeeMetricsService.computeMetrics(
                scopedUsers, allowedCats, start, end, reqCat, status, search
        );

        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        int total = result.transactions().size();
        int fromIdx = Math.min(safePage * safeSize, total);
        int toIdx = Math.min(fromIdx + safeSize, total);

        return Map.of(
                "items", result.transactions().subList(fromIdx, toIdx),
                "totalElements", total,
                "totalPages", (int) Math.ceil((double) total / safeSize),
                "page", safePage,
                "size", safeSize,
                "summary", Map.of(
                        "totalTransactions", result.totalTransactions(),
                        "successTransactions", result.successTransactions(),
                        "failedTransactions", result.failedTransactions(),
                        "pendingTransactions", result.pendingTransactions(),
                        "totalVolume", result.totalVolume()
                ),
                "serviceBreakdown", result.serviceBreakdown()
        );
    }

    @Transactional(readOnly = true)
    public EmployeeDtos.ScopedTransactionItem getScopedTransactionDetail(JwtPrincipal principal, String txnId) {
        Employee emp = employeeAuthService.requireActiveAuthenticatedEmployee(principal);
        Set<String> granted = employeePermissionService.getPermissionCodes(emp.getId());
        employeePermissionService.requirePermission(emp.getId(), EmployeePermissionCatalog.VIEW_TRANSACTION_DETAILS);

        Set<String> allowedCats = resolveAllowedTransactionCategories(granted, false);
        if (allowedCats.isEmpty()) {
            throw new AccessDeniedException("No permitted transaction categories available.");
        }

        Map<UUID, User> scopedUsers = resolveScopedUsersMap(emp);
        return employeeMetricsService.findSingleTransactionInScope(txnId, scopedUsers, allowedCats)
                .orElseThrow(() -> new AccessDeniedException("Transaction not found or outside your permitted hierarchy scope."));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getScopedReports(
            JwtPrincipal principal,
            String category,
            String fromDate,
            String toDate
    ) {
        Employee emp = employeeAuthService.requireActiveAuthenticatedEmployee(principal);
        Set<String> granted = employeePermissionService.getPermissionCodes(emp.getId());
        employeePermissionService.requirePermission(emp.getId(), EmployeePermissionCatalog.VIEW_TRANSACTION_REPORTS);

        Set<String> allowedCats = resolveAllowedTransactionCategories(granted, true);
        if (allowedCats.isEmpty()) {
            throw new AccessDeniedException("No permitted transaction categories available for reports.");
        }

        String reqCat = category == null || category.isBlank() ? "ALL" : category.trim().toUpperCase(Locale.ROOT);
        if (!"ALL".equals(reqCat) && !allowedCats.contains(reqCat)) {
            throw new AccessDeniedException("Missing permission for transaction category: " + reqCat);
        }

        Map<UUID, User> scopedUsers = resolveScopedUsersMap(emp);
        Instant start = EmployeeMetricsService.parseFromInstant(fromDate);
        Instant end = EmployeeMetricsService.parseToInstant(toDate);

        EmployeeMetricsService.MetricsResult metrics = employeeMetricsService.computeMetrics(
                scopedUsers, allowedCats, start, end, reqCat, null, null
        );

        return Map.of(
                "totalTransactions", metrics.totalTransactions(),
                "successTransactions", metrics.successTransactions(),
                "failedTransactions", metrics.failedTransactions(),
                "pendingTransactions", metrics.pendingTransactions(),
                "totalVolume", metrics.totalVolume(),
                "serviceBreakdown", metrics.serviceBreakdown(),
                "dailyTrend", metrics.dailyTrend()
        );
    }

    @Transactional(readOnly = true)
    public List<EmployeeDtos.ScopedTransactionItem> exportScopedTransactions(
            JwtPrincipal principal,
            String category,
            String status,
            String search,
            String fromDate,
            String toDate,
            String clientIp,
            String userAgent
    ) {
        Employee emp = employeeAuthService.requireActiveAuthenticatedEmployee(principal);
        Set<String> granted = employeePermissionService.getPermissionCodes(emp.getId());
        employeePermissionService.requirePermission(emp.getId(), EmployeePermissionCatalog.DOWNLOAD_PERMITTED_REPORTS);

        Set<String> allowedCats = resolveAllowedTransactionCategories(granted, true);
        if (allowedCats.isEmpty()) {
            throw new AccessDeniedException("You do not have permission to view/export any transaction category.");
        }

        String reqCat = category == null || category.isBlank() ? "ALL" : category.trim().toUpperCase(Locale.ROOT);
        if (!"ALL".equals(reqCat) && !allowedCats.contains(reqCat)) {
            throw new AccessDeniedException("Missing permission for transaction category: " + reqCat);
        }

        Map<UUID, User> scopedUsers = resolveScopedUsersMap(emp);
        Instant start = EmployeeMetricsService.parseFromInstant(fromDate);
        Instant end = EmployeeMetricsService.parseToInstant(toDate);

        EmployeeMetricsService.MetricsResult metrics = employeeMetricsService.computeMetrics(
                scopedUsers, allowedCats, start, end, reqCat, status, search
        );

        List<EmployeeDtos.ScopedTransactionItem> rows = metrics.transactions().stream().limit(3000).toList();
        employeeAuditService.log(
                emp, "EMPLOYEE", emp.getId().toString(), emp.getUsername(),
                "EMPLOYEE_REPORT_EXPORTED", null, null,
                "Exported " + rows.size() + " scoped transactions (category=" + reqCat + ")",
                clientIp, userAgent, "SUCCESS"
        );
        return rows;
    }

    @Transactional(readOnly = true)
    public List<EmployeeDtos.EmployeePerformanceItem> listSubordinateHierarchyEmployees(
            JwtPrincipal principal,
            String fromDate,
            String toDate
    ) {
        Employee emp = employeeAuthService.requireActiveAuthenticatedEmployee(principal);
        Set<String> granted = employeePermissionService.getPermissionCodes(emp.getId());
        employeePermissionService.requirePermission(emp.getId(), EmployeePermissionCatalog.VIEW_EMPLOYEES_UNDER_HIERARCHY);

        boolean canViewPerf = granted.contains(EmployeePermissionCatalog.VIEW_EMPLOYEE_PERFORMANCE);
        List<Employee> allEmployees = employeeRepository.findAll();
        Set<UUID> directAndIndirectSubordinates = employeeScopeService.resolveSubordinateEmployeeIds(emp.getId(), allEmployees);

        if (directAndIndirectSubordinates.isEmpty()) {
            return List.of();
        }

        List<User> allMemberUsers = userRepository.findAll().stream()
                .filter(employeeScopeService::isMemberUser)
                .toList();
        Instant start = EmployeeMetricsService.parseFromInstant(fromDate);
        Instant end = EmployeeMetricsService.parseToInstant(toDate);

        Map<UUID, Employee> empMap = allEmployees.stream().collect(Collectors.toMap(Employee::getId, e -> e));

        return directAndIndirectSubordinates.stream()
                .map(empMap::get)
                .filter(Objects::nonNull)
                .map(sub -> buildSubordinatePerformanceItem(sub, allEmployees, allMemberUsers, start, end, canViewPerf))
                .toList();
    }

    private EmployeeDtos.EmployeePerformanceItem buildSubordinatePerformanceItem(
            Employee sub,
            List<Employee> allEmployees,
            List<User> allMemberUsers,
            Instant start,
            Instant end,
            boolean includePerformanceMetrics
    ) {
        EmployeeDtos.EmployeeProfileView profile = employeeAuthService.toProfileView(sub);
        if (!includePerformanceMetrics) {
            return new EmployeeDtos.EmployeePerformanceItem(
                    profile.id(), profile.employeeCode(), profile.username(), profile.fullName(),
                    profile.mobile(), profile.email(), profile.role(), profile.roleDisplayName(),
                    profile.status(), profile.reportingManagerId(), profile.reportingManagerName(),
                    profile.reportingManagerCode(), profile.territoryLabel(), profile.scopes(),
                    List.of(), 0, 0, 0, 0, 0, 0, 0, 0, 0,
                    0, 0, 0, 0, BigDecimal.ZERO, profile.lastLoginAt(), profile.createdAt(),
                    List.of(), List.of()
            );
        }

        List<EmployeeScope> subScopes = employeeScopeRepository.findByEmployeeId(sub.getId());
        Set<UUID> nestedSubIds = employeeScopeService.resolveSubordinateEmployeeIds(sub.getId(), allEmployees);

        long directUsers = 0, directR = 0, directD = 0, directSD = 0;
        long hR = 0, hD = 0, hSD = 0;
        Map<UUID, User> scopedUsers = new LinkedHashMap<>();

        for (User u : allMemberUsers) {
            RoleName rn = primaryRole(u);
            if (sub.getId().equals(u.getOnboardedByEmployeeId())) {
                directUsers++;
                if (rn == RoleName.RETAILER) directR++;
                else if (rn == RoleName.DISTRIBUTOR) directD++;
                else if (rn == RoleName.SUPER_DISTRIBUTOR) directSD++;
            }
            boolean inScope = employeeScopeService.isUserInHierarchyAndScope(u, sub, subScopes, nestedSubIds);
            if (inScope) {
                scopedUsers.put(u.getId(), u);
                if (rn == RoleName.RETAILER) hR++;
                else if (rn == RoleName.DISTRIBUTOR) hD++;
                else if (rn == RoleName.SUPER_DISTRIBUTOR) hSD++;
            }
        }

        EmployeeMetricsService.MetricsResult metrics = employeeMetricsService.computeMetrics(
                scopedUsers, null, start, end, "ALL", null, null
        );

        return new EmployeeDtos.EmployeePerformanceItem(
                profile.id(), profile.employeeCode(), profile.username(), profile.fullName(),
                profile.mobile(), profile.email(), profile.role(), profile.roleDisplayName(),
                profile.status(), profile.reportingManagerId(), profile.reportingManagerName(),
                profile.reportingManagerCode(), profile.territoryLabel(), profile.scopes(),
                List.of(),
                directUsers, directR, directD, directSD,
                scopedUsers.size(), hR, hD, hSD, nestedSubIds.size(),
                metrics.totalTransactions(), metrics.successTransactions(), metrics.failedTransactions(),
                metrics.pendingTransactions(), metrics.totalVolume(), profile.lastLoginAt(), profile.createdAt(),
                metrics.serviceBreakdown(), metrics.dailyTrend()
        );
    }

    private Map<UUID, User> resolveScopedUsersMap(Employee emp) {
        List<Employee> allEmployees = employeeRepository.findAll();
        List<EmployeeScope> scopes = employeeScopeRepository.findByEmployeeId(emp.getId());
        Set<UUID> subordinateIds = employeeScopeService.resolveSubordinateEmployeeIds(emp.getId(), allEmployees);
        return resolveScopedUsersMap(emp, scopes, subordinateIds);
    }

    private Map<UUID, User> resolveScopedUsersMap(Employee emp, List<EmployeeScope> scopes, Set<UUID> subordinateIds) {
        Map<UUID, User> result = new LinkedHashMap<>();
        for (User u : userRepository.findAll()) {
            if (employeeScopeService.isUserInHierarchyAndScope(u, emp, scopes, subordinateIds)) {
                result.put(u.getId(), u);
            }
        }
        return result;
    }

    private Set<String> resolveAllowedTransactionCategories(Set<String> granted, boolean allowReportFallback) {
        Set<String> cats = new LinkedHashSet<>();
        if (granted.contains(EmployeePermissionCatalog.VIEW_AEPS_TRANSACTIONS)) cats.add(EmployeeMetricsService.CAT_AEPS);
        if (granted.contains(EmployeePermissionCatalog.VIEW_RECHARGE_TRANSACTIONS)) cats.add(EmployeeMetricsService.CAT_RECHARGE);
        if (granted.contains(EmployeePermissionCatalog.VIEW_BBPS_TRANSACTIONS)) cats.add(EmployeeMetricsService.CAT_BBPS);
        if (granted.contains(EmployeePermissionCatalog.VIEW_PAYOUT_TRANSACTIONS)) cats.add(EmployeeMetricsService.CAT_PAYOUT);
        if (granted.contains(EmployeePermissionCatalog.VIEW_WALLET_TRANSACTIONS)) cats.add(EmployeeMetricsService.CAT_WALLET);

        // If employee has top-level View Transactions or Report access and NO granular category was toggled off explicitly:
        // Keep strict default-deny unless top-level transaction permission grants summary OR granular service permissions exist.
        if (cats.isEmpty() && (granted.contains(EmployeePermissionCatalog.VIEW_TRANSACTIONS)
                || (allowReportFallback && granted.contains(EmployeePermissionCatalog.VIEW_TRANSACTION_REPORTS))
                || granted.contains(EmployeePermissionCatalog.VIEW_TRANSACTION_METRICS)
                || granted.contains(EmployeePermissionCatalog.VIEW_SALES_METRICS))) {
            cats.add(EmployeeMetricsService.CAT_AEPS);
            cats.add(EmployeeMetricsService.CAT_RECHARGE);
            cats.add(EmployeeMetricsService.CAT_BBPS);
            cats.add(EmployeeMetricsService.CAT_PAYOUT);
            cats.add(EmployeeMetricsService.CAT_WALLET);
            cats.add(EmployeeMetricsService.CAT_OTHER);
        }
        return cats;
    }

    private void requireCreatePermission(UUID employeeId, RoleName roleName) {
        switch (roleName) {
            case RETAILER -> employeePermissionService.requirePermission(employeeId, EmployeePermissionCatalog.CREATE_RETAILER_ACCOUNT);
            case DISTRIBUTOR -> employeePermissionService.requirePermission(employeeId, EmployeePermissionCatalog.CREATE_DISTRIBUTOR_ACCOUNT);
            case SUPER_DISTRIBUTOR -> employeePermissionService.requirePermission(employeeId, EmployeePermissionCatalog.CREATE_SUPER_DISTRIBUTOR_ACCOUNT);
            default -> throw new AccessDeniedException("Employees can only create Retailer, Distributor, or Super Distributor accounts.");
        }
    }

    private RoleName parseMemberRole(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Account type is required.");
        }
        String norm = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        return switch (norm) {
            case "RETAILER" -> RoleName.RETAILER;
            case "DISTRIBUTOR" -> RoleName.DISTRIBUTOR;
            case "SUPER_DISTRIBUTOR", "SUPERDISTRIBUTOR" -> RoleName.SUPER_DISTRIBUTOR;
            default -> throw new AccessDeniedException("Employees cannot create or view role: " + raw);
        };
    }

    private void resolveAndValidateParentForEmployee(
            User child,
            RoleName childRole,
            String parentUserIdRaw,
            Employee emp,
            List<EmployeeScope> scopes
    ) {
        if (!hasText(parentUserIdRaw)) {
            return;
        }
        UUID parentUuid;
        try {
            parentUuid = UUID.fromString(parentUserIdRaw.trim());
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid parent user ID.");
        }
        User parent = userRepository.findById(parentUuid)
                .orElseThrow(() -> new IllegalArgumentException("Selected parent user does not exist."));
        if (!employeeScopeService.isMemberUser(parent)) {
            throw new AccessDeniedException("Selected parent cannot be an Admin or invalid account.");
        }
        if (parent.getStatus() != UserStatus.ACTIVE && parent.getStatus() != UserStatus.APPROVED) {
            throw new IllegalArgumentException("Selected parent user is not active.");
        }

        RoleName parentRole = primaryRole(parent);
        boolean validRank = switch (childRole) {
            case RETAILER -> parentRole == RoleName.DISTRIBUTOR || parentRole == RoleName.SUPER_DISTRIBUTOR;
            case DISTRIBUTOR -> parentRole == RoleName.SUPER_DISTRIBUTOR;
            case SUPER_DISTRIBUTOR -> false;
            default -> false;
        };
        if (!validRank) {
            throw new IllegalArgumentException("Parent role " + parentRole + " cannot sponsor a " + childRole + ".");
        }
        if (!employeeScopeService.isUserInEmployeeScope(parent, emp, scopes)) {
            throw new AccessDeniedException("Selected parent account is outside your permitted hierarchy scope.");
        }

        child.setParentUser(parent);
        child.setAddedByUserRef(parent.getId().toString());
        child.setAddedByName(parent.getFullName());
        child.setAddedByPartyCode(parent.getPartyCode());
        child.setAddedByRole(parentRole.name());
    }

    private void initializeUserServices(User user) {
        for (ServiceType type : ServiceType.values()) {
            boolean defaultEnable = switch (type) {
                case AEPS, BBPS, PAYOUT, DMT -> false;
                default -> true;
            };
            if (userServiceRepository.findByUserIdAndServiceType(user.getId(), type).isEmpty()) {
                UserService s = new UserService();
                s.setUser(user);
                s.setServiceType(type);
                s.setIsEnabled(defaultEnable);
                s.setEnabledBy("system");
                s.setEnabledAt(Instant.now());
                userServiceRepository.save(s);
            }
        }
    }

    private String generatePartyCode(String state, RoleName roleName) {
        String rolePrefix = switch (roleName) {
            case SUPER_DISTRIBUTOR -> "RPSD";
            case DISTRIBUTOR -> "RPD";
            default -> "RPR";
        };
        String statePlate = resolveStatePlateCode(state);
        String prefix = rolePrefix + statePlate;
        String candidate;
        int attempts = 0;
        do {
            int random5Digit = 10000 + SECURE_RANDOM.nextInt(90000);
            candidate = prefix + random5Digit;
            attempts++;
        } while (userRepository.existsByPartyCode(candidate) && attempts < 100);
        return candidate;
    }

    private String resolveStatePlateCode(String rawState) {
        if (rawState == null || rawState.isBlank()) return "IN";
        String upper = rawState.trim().toUpperCase(Locale.ROOT);
        if (upper.contains("BIHAR")) return "BR";
        if (upper.contains("MAHARASHTRA")) return "MH";
        if (upper.contains("UTTAR PRADESH")) return "UP";
        if (upper.contains("DELHI")) return "DL";
        if (upper.contains("WEST BENGAL")) return "WB";
        if (upper.contains("RAJASTHAN")) return "RJ";
        if (upper.contains("PUNJAB")) return "PB";
        if (upper.contains("HARYANA")) return "HR";
        if (upper.contains("GUJARAT")) return "GJ";
        if (upper.contains("KARNATAKA")) return "KA";
        if (upper.contains("TAMIL NADU")) return "TN";
        if (upper.contains("TELANGANA")) return "TS";
        if (upper.contains("ANDHRA")) return "AP";
        if (upper.contains("MADHYA PRADESH")) return "MP";
        if (upper.contains("ODISHA")) return "OD";
        if (upper.contains("JHARKHAND")) return "JH";
        if (upper.contains("CHHATTISGARH")) return "CG";
        if (upper.contains("ASSAM")) return "AS";
        if (upper.contains("KERALA")) return "KL";
        if (upper.contains("UTTARAKHAND")) return "UK";
        if (upper.contains("HIMACHAL")) return "HP";
        if (upper.contains("JAMMU")) return "JK";
        if (upper.contains("GOA")) return "GA";
        return upper.length() >= 2 ? upper.substring(0, 2).replaceAll("[^A-Z]", "X") : "IN";
    }

    private EmployeeDtos.ScopedMemberSummary toMemberSummary(User u, BigDecimal balance, boolean canViewKyc) {
        String pName = u.getParentUser() != null ? u.getParentUser().getFullName() : u.getAddedByName();
        String pCode = u.getParentUser() != null ? u.getParentUser().getPartyCode() : u.getAddedByPartyCode();
        String kyc = canViewKyc && u.getKycStatus() != null ? u.getKycStatus().name() : "RESTRICTED";
        return new EmployeeDtos.ScopedMemberSummary(
                u.getId().toString(),
                u.getUsername(),
                u.getFullName(),
                u.getBusinessName(),
                u.getMobile(),
                u.getEmail(),
                primaryRole(u).name(),
                u.getPartyCode(),
                u.getStatus() != null ? u.getStatus().name() : "ACTIVE",
                kyc,
                firstNonBlank(u.getStateName(), u.getShopState(), u.getPermState()),
                firstNonBlank(u.getCity(), u.getShopCity(), u.getShopDistrict()),
                u.getZoneName(),
                pName,
                pCode,
                u.getOnboardedByEmployeeId() != null ? u.getOnboardedByEmployeeId().toString() : null,
                u.getOnboardedByEmployeeCode(),
                balance,
                u.getCreatedAt()
        );
    }

    private RoleName primaryRole(User u) {
        if (u.getRoles() == null || u.getRoles().isEmpty()) return RoleName.RETAILER;
        return u.getRoles().iterator().next().getName();
    }

    private String maskIdentity(String value, int visibleTail) {
        if (value == null || value.isBlank()) return null;
        String clean = value.trim();
        if (clean.length() <= visibleTail) return clean;
        return "X".repeat(clean.length() - visibleTail) + clean.substring(clean.length() - visibleTail);
    }

    private boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (hasText(v)) return v.trim();
        }
        return null;
    }

    private boolean contains(String v, String s) {
        return v != null && v.toLowerCase(Locale.ROOT).contains(s);
    }
}
