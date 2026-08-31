package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.CommissionDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.CommissionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
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

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping({"/api/v1/admin/commissions", "/api/admin/commissions"})
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@PreAuthorize("hasRole('ADMIN')")
public class AdminCommissionController {

    private final CommissionService commissionService;

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }
        return ip != null ? ip : "127.0.0.1";
    }

    @GetMapping("/plans")
    public ResponseEntity<List<CommissionDtos.CommissionPlanDto>> getPlans(
            @RequestParam(required = false, defaultValue = "AEPS_1") String serviceType
    ) {
        return ResponseEntity.ok(commissionService.getPlans(serviceType));
    }

    @GetMapping("/plans/{planId}")
    public ResponseEntity<CommissionDtos.CommissionPlanDto> getPlanById(@PathVariable UUID planId) {
        return ResponseEntity.ok(commissionService.getPlanById(planId));
    }

    @PutMapping("/plans/{planId}/slabs")
    public ResponseEntity<CommissionDtos.CommissionPlanDto> updatePlanSlabs(
            @PathVariable UUID planId,
            @Valid @RequestBody CommissionDtos.UpdateSlabsRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        UUID adminId = UUID.fromString(principal.userId());
        String ip = getClientIp(httpRequest);
        CommissionDtos.CommissionPlanDto updated = commissionService.updatePlanSlabs(planId, request, adminId, ip);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/plans")
    public ResponseEntity<CommissionDtos.CommissionPlanDto> createPlan(
            @Valid @RequestBody CommissionDtos.CreatePlanRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        UUID adminId = UUID.fromString(principal.userId());
        String ip = getClientIp(httpRequest);
        CommissionDtos.CommissionPlanDto created = commissionService.createPlan(request, adminId, ip);
        return ResponseEntity.ok(created);
    }

    @GetMapping("/transactions")
    public ResponseEntity<Page<CommissionDtos.CommissionTransactionDto>> getTransactions(
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
        Sort sort = sortDir.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);
        Page<CommissionDtos.CommissionTransactionDto> result = commissionService.getTransactions(
                null, true, serviceType, status, planCode, startDate, endDate, search, pageable
        );
        return ResponseEntity.ok(result);
    }

    @PostMapping("/assign-plan")
    public ResponseEntity<Void> assignPlan(
            @Valid @RequestBody CommissionDtos.AssignPlanRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            HttpServletRequest httpRequest
    ) {
        UUID adminId = UUID.fromString(principal.userId());
        String ip = getClientIp(httpRequest);
        commissionService.assignPlanToUser(request.userId(), request.planId(), adminId, ip);
        return ResponseEntity.ok().build();
    }
}
