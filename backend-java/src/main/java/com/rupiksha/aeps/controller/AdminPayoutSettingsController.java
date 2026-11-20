package com.rupiksha.aeps.controller;

import com.rupiksha.aeps.dto.PayoutLimitSettingsDto;
import com.rupiksha.aeps.dto.PayoutLimitUpdateRequest;
import com.rupiksha.aeps.service.PayoutLimitConfigurationService;
import com.rupiksha.backend.security.JwtPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Slf4j
@RestController
@RequestMapping({ "/api/v1/admin/payout-settings", "/api/admin/payout-settings", "/admin/payout-settings" })
@RequiredArgsConstructor
public class AdminPayoutSettingsController {

    private final PayoutLimitConfigurationService payoutLimitConfigurationService;

    private String resolveUserId(JwtPrincipal principal, Authentication authentication) {
        if (principal != null && principal.userId() != null && !principal.userId().isBlank()) {
            return principal.userId();
        }
        if (authentication != null && authentication.getPrincipal() instanceof JwtPrincipal jwtPrincipal) {
            return jwtPrincipal.userId();
        }
        if (authentication != null) {
            String name = authentication.getName();
            if (name != null && name.contains("userId=")) {
                int start = name.indexOf("userId=") + 7;
                int end = name.indexOf(",", start);
                if (end == -1) end = name.indexOf("]", start);
                if (end != -1) {
                    return name.substring(start, end).trim();
                }
            }
            return name;
        }
        return "UNKNOWN_ADMIN";
    }

    private String resolveUsername(JwtPrincipal principal, Authentication authentication) {
        if (principal != null && principal.username() != null) {
            return principal.username();
        }
        if (authentication != null) {
            return authentication.getName();
        }
        return "ADMIN";
    }

    private String extractClientIp(HttpServletRequest request) {
        if (request == null) return "127.0.0.1";
        String ip = request.getHeader("X-Forwarded-For");
        if (ip != null && !ip.isBlank()) {
            if (ip.contains(",")) {
                ip = ip.split(",")[0].trim();
            }
            return ip;
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }

    /**
     * Retrieve current saved minimum and maximum payout limit configuration.
     * Authorized for Admin only.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<PayoutLimitSettingsDto> getPayoutSettings() {
        PayoutLimitSettingsDto dto = payoutLimitConfigurationService.getActiveLimits();
        return ResponseEntity.ok(dto);
    }

    /**
     * Atomically update minimum and maximum payout limits.
     * Authorized for Admin only.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping
    public ResponseEntity<PayoutLimitSettingsDto> updatePayoutSettings(
            @Valid @RequestBody PayoutLimitUpdateRequest request,
            HttpServletRequest httpRequest,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String adminUserId = resolveUserId(principal, authentication);
        String adminUsername = resolveUsername(principal, authentication);
        String clientIp = extractClientIp(httpRequest);
        String userAgent = httpRequest != null ? httpRequest.getHeader("User-Agent") : "";
        String correlationId = httpRequest != null ? httpRequest.getHeader("X-Correlation-ID") : null;
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = "CORR_PL_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        }

        log.info("[ADMIN_ACTION] Admin user {} ({}) updating payout limits to Min: ₹{}, Max: ₹{} from IP: {}",
                adminUserId, adminUsername, request.getMinimumPayoutAmount(), request.getMaximumPayoutAmount(), clientIp);

        PayoutLimitSettingsDto updated = payoutLimitConfigurationService.updateLimits(
                request,
                adminUserId,
                adminUsername,
                correlationId,
                clientIp,
                userAgent
        );

        return ResponseEntity.ok(updated);
    }
}
