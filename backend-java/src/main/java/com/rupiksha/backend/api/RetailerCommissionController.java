package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.CommissionDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.CommissionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Slf4j
@RestController
@RequestMapping({"/api/v1/retailer/commissions", "/api/retailer/commissions"})
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@PreAuthorize("isAuthenticated()")
public class RetailerCommissionController {

    private final CommissionService commissionService;

    @GetMapping("/summary")
    public ResponseEntity<CommissionDtos.CommissionSummaryDto> getSummary(
            @AuthenticationPrincipal JwtPrincipal principal
    ) {
        UUID retailerId = UUID.fromString(principal.userId());
        return ResponseEntity.ok(commissionService.getRetailerSummary(retailerId));
    }

    @GetMapping("/my-plan")
    public ResponseEntity<CommissionDtos.CommissionPlanDto> getMyPlan(
            @AuthenticationPrincipal JwtPrincipal principal
    ) {
        UUID retailerId = UUID.fromString(principal.userId());
        return ResponseEntity.ok(commissionService.getRetailerActivePlan(retailerId));
    }

    @GetMapping("/plans")
    public ResponseEntity<java.util.List<CommissionDtos.CommissionPlanDto>> getAvailablePlans(
            @RequestParam(required = false, defaultValue = "AEPS_1") String serviceType
    ) {
        return ResponseEntity.ok(commissionService.getPlans(serviceType));
    }

    @PostMapping("/upgrade")
    public ResponseEntity<CommissionDtos.CommissionPlanDto> upgradePlan(
            @AuthenticationPrincipal JwtPrincipal principal,
            @jakarta.validation.Valid @RequestBody CommissionDtos.UpgradePlanRequest request,
            jakarta.servlet.http.HttpServletRequest httpRequest
    ) {
        UUID retailerId = UUID.fromString(principal.userId());
        String ip = httpRequest.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = httpRequest.getRemoteAddr();
        }
        CommissionDtos.CommissionPlanDto upgraded = commissionService.upgradeRetailerPlan(retailerId, request.planId(), ip != null ? ip : "127.0.0.1");
        return ResponseEntity.ok(upgraded);
    }

    @GetMapping("/history")
    public ResponseEntity<Page<CommissionDtos.CommissionTransactionDto>> getHistory(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam(required = false) String serviceType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String planCode,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        UUID currentUserId = UUID.fromString(principal.userId());
        Sort sort = sortDir.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<CommissionDtos.CommissionTransactionDto> result = commissionService.getTransactions(
                currentUserId, false, serviceType, status, planCode, startDate, endDate, search, pageable
        );
        return ResponseEntity.ok(result);
    }
}
