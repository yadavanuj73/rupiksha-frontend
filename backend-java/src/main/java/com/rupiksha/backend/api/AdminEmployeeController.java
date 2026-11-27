package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.AdminEmployeeService;
import com.rupiksha.backend.service.EmployeePermissionService;
import com.rupiksha.backend.service.EmployeeScopeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/employees")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminEmployeeController {

    private final AdminEmployeeService adminEmployeeService;
    private final EmployeePermissionService employeePermissionService;
    private final EmployeeScopeService employeeScopeService;

    @GetMapping("/permissions/catalog")
    public List<EmployeeDtos.PermissionCategoryView> getPermissionCatalog() {
        return employeePermissionService.getCatalogView();
    }

    @GetMapping("/zones/catalog")
    public EmployeeDtos.ZoneCatalogResponse getZoneCatalog() {
        return employeeScopeService.getZoneCatalog();
    }

    @GetMapping("/managers")
    public List<EmployeeDtos.EmployeeProfileView> listEligibleManagers(@RequestParam String role) {
        return adminEmployeeService.listEligibleManagers(role);
    }

    @GetMapping
    public List<EmployeeDtos.EmployeeProfileView> listEmployees(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search
    ) {
        return adminEmployeeService.listEmployees(role, status, search);
    }

    @PostMapping
    public EmployeeDtos.EmployeeProfileView createEmployee(
            @Valid @RequestBody EmployeeDtos.CreateEmployeeRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        return adminEmployeeService.createEmployee(request, principal, resolveIp(httpRequest), httpRequest.getHeader("User-Agent"));
    }

    @GetMapping("/{employeeId}")
    public EmployeeDtos.EmployeeProfileView getEmployee(@PathVariable UUID employeeId) {
        return adminEmployeeService.getEmployeeProfile(employeeId);
    }

    @PutMapping("/{employeeId}")
    public EmployeeDtos.EmployeeProfileView updateEmployee(
            @PathVariable UUID employeeId,
            @Valid @RequestBody EmployeeDtos.UpdateEmployeeRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        return adminEmployeeService.updateEmployee(employeeId, request, principal, resolveIp(httpRequest), httpRequest.getHeader("User-Agent"));
    }

    @PatchMapping("/{employeeId}/status")
    public EmployeeDtos.EmployeeProfileView updateStatus(
            @PathVariable UUID employeeId,
            @Valid @RequestBody EmployeeDtos.UpdateStatusRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        return adminEmployeeService.updateEmployeeStatus(employeeId, request, principal, resolveIp(httpRequest), httpRequest.getHeader("User-Agent"));
    }

    @PostMapping("/{employeeId}/reset-password")
    public Map<String, Object> resetPassword(
            @PathVariable UUID employeeId,
            @Valid @RequestBody EmployeeDtos.ResetPasswordRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        adminEmployeeService.resetEmployeePassword(employeeId, request, principal, resolveIp(httpRequest), httpRequest.getHeader("User-Agent"));
        return Map.of("success", true, "message", "Employee password updated and active sessions invalidated.");
    }

    @PutMapping("/{employeeId}/permissions")
    public EmployeeDtos.EmployeeProfileView updatePermissions(
            @PathVariable UUID employeeId,
            @RequestBody EmployeeDtos.UpdatePermissionsRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        return adminEmployeeService.updateEmployeePermissions(employeeId, request, principal, resolveIp(httpRequest), httpRequest.getHeader("User-Agent"));
    }

    @GetMapping("/performance")
    public List<EmployeeDtos.EmployeePerformanceItem> listPerformanceSummary(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate
    ) {
        return adminEmployeeService.listPerformanceSummary(role, status, search, fromDate, toDate);
    }

    @GetMapping("/{employeeId}/performance")
    public EmployeeDtos.EmployeePerformanceItem getEmployeePerformance(
            @PathVariable UUID employeeId,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate
    ) {
        return adminEmployeeService.getEmployeePerformance(employeeId, fromDate, toDate);
    }

    @GetMapping("/{employeeId}/permission-preview")
    public Map<String, Object> getPermissionPreview(@PathVariable UUID employeeId) {
        return adminEmployeeService.getReadOnlyPermissionPreview(employeeId);
    }

    @GetMapping("/audit-logs")
    public List<EmployeeDtos.EmployeeAuditLogView> getAuditLogs(@RequestParam(required = false) UUID employeeId) {
        return adminEmployeeService.getAuditLogs(employeeId);
    }

    private String resolveIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String xri = request.getHeader("X-Real-IP");
        if (xri != null && !xri.isBlank()) return xri.trim();
        return request.getRemoteAddr();
    }
}
