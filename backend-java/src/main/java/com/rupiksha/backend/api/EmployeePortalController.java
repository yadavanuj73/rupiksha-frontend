package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.EmployeePermissionService;
import com.rupiksha.backend.service.EmployeePortalService;
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
@RequestMapping("/api/v1/employee")
@PreAuthorize("hasRole('EMPLOYEE')")
@RequiredArgsConstructor
public class EmployeePortalController {

    private final EmployeePortalService employeePortalService;
    private final EmployeeScopeService employeeScopeService;
    private final EmployeePermissionService employeePermissionService;

    @GetMapping("/zones")
    public EmployeeDtos.ZoneCatalogResponse getZoneCatalog() {
        return employeeScopeService.getZoneCatalog();
    }

    @GetMapping("/permissions/catalog")
    public List<EmployeeDtos.PermissionCategoryView> getPermissionCatalog() {
        return employeePermissionService.getCatalogView();
    }

    @GetMapping("/dashboard")
    public EmployeeDtos.EmployeeDashboardResponse getDashboard(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate
    ) {
        return employeePortalService.getDashboard(principal, fromDate, toDate);
    }

    @GetMapping("/members")
    public List<EmployeeDtos.ScopedMemberSummary> listMembers(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search
    ) {
        return employeePortalService.listScopedMembers(principal, role, status, search);
    }

    @GetMapping("/members/{memberId}")
    public EmployeeDtos.ScopedMemberDetail getMemberDetail(
            @AuthenticationPrincipal JwtPrincipal principal,
            @PathVariable UUID memberId
    ) {
        return employeePortalService.getScopedMemberDetail(principal, memberId);
    }

    @GetMapping("/members/candidate-parents")
    public List<EmployeeDtos.ScopedMemberSummary> getCandidateParents(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam String role
    ) {
        return employeePortalService.getCandidateParents(principal, role);
    }

    @PostMapping("/members/onboard")
    public EmployeeDtos.ScopedMemberSummary onboardMember(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody EmployeeDtos.OnboardMemberRequest request,
            HttpServletRequest httpRequest
    ) {
        return employeePortalService.onboardMember(
                principal, request, resolveIp(httpRequest), httpRequest.getHeader("User-Agent")
        );
    }

    @GetMapping("/transactions")
    public Map<String, Object> listTransactions(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam(required = false, defaultValue = "ALL") String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return employeePortalService.listScopedTransactions(principal, category, status, search, fromDate, toDate, page, size);
    }

    @GetMapping("/transactions/{txnId}")
    public EmployeeDtos.ScopedTransactionItem getTransactionDetail(
            @AuthenticationPrincipal JwtPrincipal principal,
            @PathVariable String txnId
    ) {
        return employeePortalService.getScopedTransactionDetail(principal, txnId);
    }

    @GetMapping("/transactions/export")
    public List<EmployeeDtos.ScopedTransactionItem> exportTransactions(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam(required = false, defaultValue = "ALL") String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            HttpServletRequest httpRequest
    ) {
        return employeePortalService.exportScopedTransactions(
                principal, category, status, search, fromDate, toDate,
                resolveIp(httpRequest), httpRequest.getHeader("User-Agent")
        );
    }

    @GetMapping("/reports")
    public Map<String, Object> getReports(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam(required = false, defaultValue = "ALL") String category,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate
    ) {
        return employeePortalService.getScopedReports(principal, category, fromDate, toDate);
    }

    @GetMapping("/hierarchy/employees")
    public List<EmployeeDtos.EmployeePerformanceItem> listHierarchyEmployees(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate
    ) {
        return employeePortalService.listSubordinateHierarchyEmployees(principal, fromDate, toDate);
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
