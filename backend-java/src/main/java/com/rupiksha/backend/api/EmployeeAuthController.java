package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.domain.Employee;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.EmployeeAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/employee/auth")
@RequiredArgsConstructor
public class EmployeeAuthController {

    private final EmployeeAuthService employeeAuthService;

    @PostMapping("/login")
    public EmployeeDtos.EmployeeAuthResponse login(
            @Valid @RequestBody EmployeeDtos.EmployeeLoginRequest request,
            HttpServletRequest httpRequest
    ) {
        return employeeAuthService.login(request, resolveIp(httpRequest), httpRequest.getHeader("User-Agent"));
    }

    @PostMapping("/refresh")
    public EmployeeDtos.EmployeeAuthResponse refresh(
            @Valid @RequestBody EmployeeDtos.EmployeeRefreshRequest request,
            HttpServletRequest httpRequest
    ) {
        return employeeAuthService.refresh(request, resolveIp(httpRequest), httpRequest.getHeader("User-Agent"));
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        String refreshToken = body != null ? body.get("refreshToken") : null;
        employeeAuthService.logout(refreshToken, principal, resolveIp(httpRequest), httpRequest.getHeader("User-Agent"));
        return Map.of("success", true, "message", "Employee logged out successfully");
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('EMPLOYEE')")
    public EmployeeDtos.EmployeeProfileView me(@AuthenticationPrincipal JwtPrincipal principal) {
        Employee emp = employeeAuthService.requireActiveAuthenticatedEmployee(principal);
        return employeeAuthService.toProfileView(emp);
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
