package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.Employee;
import com.rupiksha.backend.domain.EmployeeRefreshToken;
import com.rupiksha.backend.domain.EmployeeScope;
import com.rupiksha.backend.domain.EmployeeStatus;
import com.rupiksha.backend.repository.EmployeeRefreshTokenRepository;
import com.rupiksha.backend.repository.EmployeeRepository;
import com.rupiksha.backend.repository.EmployeeScopeRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class EmployeeAuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final long LOCK_DURATION_SECONDS = 900;

    private final EmployeeRepository employeeRepository;
    private final EmployeeScopeRepository employeeScopeRepository;
    private final EmployeeRefreshTokenRepository employeeRefreshTokenRepository;
    private final EmployeePermissionService employeePermissionService;
    private final EmployeeAuditService employeeAuditService;
    private final EmployeeAuthRateLimiter rateLimiter;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AppProperties appProperties;

    @Transactional(noRollbackFor = {BadCredentialsException.class, AccessDeniedException.class})
    public EmployeeDtos.EmployeeAuthResponse login(
            EmployeeDtos.EmployeeLoginRequest request,
            String clientIp,
            String userAgent
    ) {
        String identifier = request.identifier() == null ? "" : request.identifier().trim();
        rateLimiter.checkLoginAllowed(clientIp, identifier);

        Optional<Employee> empOpt = employeeRepository.findByUsernameIgnoreCase(identifier)
                .or(() -> employeeRepository.findByEmployeeCodeIgnoreCase(identifier));

        if (empOpt.isEmpty()) {
            rateLimiter.recordAttempt(clientIp, identifier);
            employeeAuditService.log(
                    null, "EMPLOYEE", null, identifier,
                    "EMPLOYEE_LOGIN_FAILED", null, null,
                    "Unknown employee identifier attempted login",
                    clientIp, userAgent, "FAILURE"
            );
            throw new BadCredentialsException("Invalid employee credentials");
        }

        Employee emp = empOpt.get();

        if (emp.getLockedUntil() != null && emp.getLockedUntil().isAfter(Instant.now())) {
            employeeAuditService.log(
                    emp, "EMPLOYEE", emp.getId().toString(), emp.getUsername(),
                    "EMPLOYEE_LOGIN_BLOCKED", null, null,
                    "Attempt while account temporarily locked",
                    clientIp, userAgent, "DENIED"
            );
            throw new AccessDeniedException("Employee account is temporarily locked due to repeated failed attempts. Please try again later.");
        }

        if (emp.getStatus() != EmployeeStatus.ACTIVE) {
            employeeAuditService.log(
                    emp, "EMPLOYEE", emp.getId().toString(), emp.getUsername(),
                    "EMPLOYEE_LOGIN_BLOCKED", null, null,
                    "Blocked login for employee status " + emp.getStatus().name(),
                    clientIp, userAgent, "DENIED"
            );
            throw new AccessDeniedException("Your employee account is " + emp.getStatus().name().toLowerCase() + ". Contact Admin.");
        }

        if (!passwordEncoder.matches(request.password(), emp.getPasswordHash())) {
            int attempts = (emp.getFailedLoginAttempts() == null ? 0 : emp.getFailedLoginAttempts()) + 1;
            emp.setFailedLoginAttempts(attempts);
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                emp.setLockedUntil(Instant.now().plusSeconds(LOCK_DURATION_SECONDS));
            }
            employeeRepository.save(emp);
            rateLimiter.recordAttempt(clientIp, identifier);
            employeeAuditService.log(
                    emp, "EMPLOYEE", emp.getId().toString(), emp.getUsername(),
                    "EMPLOYEE_LOGIN_FAILED", null, null,
                    "Invalid password (attempt " + attempts + ")",
                    clientIp, userAgent, "FAILURE"
            );
            throw new BadCredentialsException("Invalid employee credentials");
        }

        emp.setFailedLoginAttempts(0);
        emp.setLockedUntil(null);
        emp.setLastLoginAt(Instant.now());
        emp.setLastLoginIp(clientIp);
        if (emp.getSessionVersion() == null || emp.getSessionVersion() < 1) {
            emp.setSessionVersion(1);
        }
        employeeRepository.save(emp);
        rateLimiter.clearAccountAttempts(identifier);

        employeeAuditService.log(
                emp, "EMPLOYEE", emp.getId().toString(), emp.getUsername(),
                "EMPLOYEE_LOGIN_SUCCESS", null, null,
                "Employee authenticated successfully as " + emp.getEmployeeRole().getDisplayName(),
                clientIp, userAgent, "SUCCESS"
        );

        return issueEmployeeTokens(emp);
    }

    @Transactional
    public EmployeeDtos.EmployeeAuthResponse refresh(
            EmployeeDtos.EmployeeRefreshRequest request,
            String clientIp,
            String userAgent
    ) {
        String hash = sha256(request.refreshToken());
        EmployeeRefreshToken rt = employeeRefreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new BadCredentialsException("Invalid employee refresh token"));
        if (rt.isRevoked() || rt.getExpiresAt().isBefore(Instant.now())) {
            throw new BadCredentialsException("Employee refresh token expired or revoked");
        }
        Employee emp = rt.getEmployee();
        if (emp.getStatus() != EmployeeStatus.ACTIVE) {
            throw new AccessDeniedException("Employee account is not active");
        }
        rt.setRevoked(true);
        employeeRefreshTokenRepository.save(rt);

        employeeAuditService.log(
                emp, "EMPLOYEE", emp.getId().toString(), emp.getUsername(),
                "EMPLOYEE_TOKEN_REFRESH", null, null,
                "Refreshed employee access token",
                clientIp, userAgent, "SUCCESS"
        );
        return issueEmployeeTokens(emp);
    }

    @Transactional
    public void logout(String refreshToken, JwtPrincipal principal, String clientIp, String userAgent) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            employeeRefreshTokenRepository.findByTokenHash(sha256(refreshToken.trim()))
                    .ifPresent(rt -> {
                        rt.setRevoked(true);
                        employeeRefreshTokenRepository.save(rt);
                    });
        }
        if (principal != null && principal.userId() != null) {
            UUID empId = tryParseUuid(principal.userId());
            if (empId != null) {
                employeeRepository.findById(empId).ifPresent(emp -> {
                    emp.setSessionVersion((emp.getSessionVersion() == null ? 1 : emp.getSessionVersion()) + 1);
                    employeeRepository.save(emp);
                    employeeRefreshTokenRepository.revokeAllByEmployeeId(emp.getId());
                    employeeAuditService.log(
                            emp, "EMPLOYEE", emp.getId().toString(), emp.getUsername(),
                            "EMPLOYEE_LOGOUT", null, null,
                            "Employee logged out and session invalidated",
                            clientIp, userAgent, "SUCCESS"
                    );
                });
            }
        }
    }

    @Transactional(readOnly = true)
    public EmployeeDtos.EmployeeProfileView getCurrentProfile(JwtPrincipal principal) {
        Employee emp = requireActiveAuthenticatedEmployee(principal);
        return toProfileView(emp);
    }

    @Transactional(readOnly = true)
    public Employee requireActiveAuthenticatedEmployee(JwtPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new AccessDeniedException("Employee authentication required");
        }
        boolean isEmployeePrincipal = principal.roles() != null && principal.roles().stream()
                .anyMatch(r -> "EMPLOYEE".equalsIgnoreCase(r));
        if (!isEmployeePrincipal) {
            throw new AccessDeniedException("Only employee sessions may access this resource");
        }
        UUID empId = tryParseUuid(principal.userId());
        if (empId == null) {
            throw new AccessDeniedException("Invalid employee principal");
        }
        Employee emp = employeeRepository.findById(empId)
                .orElseThrow(() -> new AccessDeniedException("Employee record not found"));
        if (emp.getStatus() != EmployeeStatus.ACTIVE) {
            throw new AccessDeniedException("Employee account is " + emp.getStatus().name().toLowerCase());
        }
        return emp;
    }

    @Transactional(readOnly = true)
    public EmployeeDtos.EmployeeProfileView toProfileView(Employee emp) {
        List<EmployeeScope> scopes = employeeScopeRepository.findByEmployeeId(emp.getId());
        List<String> permissions = new ArrayList<>(employeePermissionService.getPermissionCodes(emp.getId()));
        Employee manager = emp.getReportingManagerId() == null ? null
                : employeeRepository.findById(emp.getReportingManagerId()).orElse(null);

        List<EmployeeDtos.ScopeItem> scopeItems = scopes.stream()
                .map(s -> new EmployeeDtos.ScopeItem(
                        s.getScopeType().name(),
                        s.getStateName(),
                        s.getZoneName(),
                        s.getCityOrDistrict()
                ))
                .toList();

        return new EmployeeDtos.EmployeeProfileView(
                emp.getId().toString(),
                emp.getEmployeeCode(),
                emp.getUsername(),
                emp.getFullName(),
                emp.getMobile(),
                emp.getEmail(),
                emp.getAddress(),
                emp.getEmployeeRole().name(),
                emp.getEmployeeRole().getDisplayName(),
                emp.getStatus().name(),
                manager != null ? manager.getId().toString() : null,
                manager != null ? manager.getFullName() : "Admin",
                manager != null ? manager.getEmployeeCode() : "ADMIN",
                emp.getTerritoryLabel(),
                scopeItems,
                permissions,
                emp.getLastLoginAt(),
                emp.getCreatedAt(),
                emp.getUpdatedAt()
        );
    }

    private EmployeeDtos.EmployeeAuthResponse issueEmployeeTokens(Employee emp) {
        String accessToken = jwtService.createEmployeeAccessToken(
                emp.getId(),
                emp.getUsername(),
                emp.getEmployeeRole().name(),
                emp.getSessionVersion()
        );
        String refreshRaw = UUID.randomUUID() + "." + UUID.randomUUID();
        EmployeeRefreshToken rt = new EmployeeRefreshToken();
        rt.setEmployee(emp);
        rt.setTokenHash(sha256(refreshRaw));
        rt.setExpiresAt(Instant.now().plusSeconds(appProperties.jwt().refreshTokenDays() * 86400));
        employeeRefreshTokenRepository.save(rt);

        return new EmployeeDtos.EmployeeAuthResponse(
                accessToken,
                refreshRaw,
                "Bearer",
                appProperties.jwt().accessTokenMinutes() * 60,
                toProfileView(emp)
        );
    }

    private UUID tryParseUuid(String raw) {
        try {
            return UUID.fromString(raw.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to hash token");
        }
    }
}
