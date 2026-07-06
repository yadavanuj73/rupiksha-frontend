package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.WalletService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;

    private JwtPrincipal getPrincipal(Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof JwtPrincipal)) {
            throw new AccessDeniedException("Authentication required");
        }
        return (JwtPrincipal) auth.getPrincipal();
    }

    private UUID getPrincipalId(Authentication auth) {
        return UUID.fromString(getPrincipal(auth).userId());
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }
        return ip;
    }

    private String getIdempotencyKey(HttpServletRequest request) {
        String key = request.getHeader("X-Idempotency-Key");
        if (key == null || key.isBlank()) {
            key = UUID.randomUUID().toString(); // Fallback auto-generated if header is absent
        }
        return key;
    }

    @GetMapping("/wallet")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getWalletsList(Authentication auth) {
        List<WalletDtos.WalletBalanceResponse> list = walletService.getWalletsList(getPrincipalId(auth));
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("wallets", list);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/wallet/{userId}/balance")
    public WalletDtos.WalletBalanceResponse balance(@PathVariable String userId, Authentication auth) {
        JwtPrincipal principal = getPrincipal(auth);
        boolean isSelf = principal.userId().toString().equalsIgnoreCase(userId);
        boolean isPrivileged = auth.getAuthorities().stream().anyMatch(a ->
                "ROLE_ADMIN".equals(a.getAuthority())
                        || "ROLE_SUPER_DISTRIBUTOR".equals(a.getAuthority())
                        || "ROLE_DISTRIBUTOR".equals(a.getAuthority()));
        if (!isSelf && !isPrivileged) {
            throw new AccessDeniedException("Not allowed to view this wallet balance");
        }
        return walletService.getBalance(userId);
    }

    @PostMapping("/wallet/credit")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> credit(
            @Valid @RequestBody WalletDtos.WalletEntryRequest request,
            Authentication auth,
            HttpServletRequest servletRequest) {
        String ip = getClientIp(servletRequest);
        String idempotency = getIdempotencyKey(servletRequest);

        WalletDtos.WalletBalanceResponse res = walletService.credit(request, getPrincipalId(auth), ip, idempotency);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Funds credited successfully");
        response.put("balance", res.balance());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/wallet/debit")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> debit(
            @Valid @RequestBody WalletDtos.WalletEntryRequest request,
            Authentication auth,
            HttpServletRequest servletRequest) {
        String ip = getClientIp(servletRequest);
        String idempotency = getIdempotencyKey(servletRequest);

        WalletDtos.WalletBalanceResponse res = walletService.debit(request, getPrincipalId(auth), ip, idempotency);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Funds debited successfully");
        response.put("balance", res.balance());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/wallet/lock")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> lock(
            @Valid @RequestBody WalletDtos.WalletEntryRequest request,
            Authentication auth,
            HttpServletRequest servletRequest) {
        String ip = getClientIp(servletRequest);
        String idempotency = getIdempotencyKey(servletRequest);

        WalletDtos.WalletBalanceResponse res = walletService.lock(request, getPrincipalId(auth), ip, idempotency);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Funds locked successfully");
        response.put("balance", res.balance());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/wallet/release")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> release(
            @Valid @RequestBody WalletDtos.WalletEntryRequest request,
            Authentication auth,
            HttpServletRequest servletRequest) {
        String ip = getClientIp(servletRequest);
        String idempotency = getIdempotencyKey(servletRequest);

        WalletDtos.WalletBalanceResponse res = walletService.release(request, getPrincipalId(auth), ip, idempotency);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Funds released successfully");
        response.put("balance", res.balance());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/wallet/give-commission")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> giveCommission(
            @Valid @RequestBody WalletDtos.CommissionRequest request,
            Authentication auth,
            HttpServletRequest servletRequest) {
        String ip = getClientIp(servletRequest);
        String idempotency = getIdempotencyKey(servletRequest);

        WalletDtos.WalletBalanceResponse res = walletService.giveCommission(request, getPrincipalId(auth), ip, idempotency);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Commission distributed successfully");
        response.put("balance", res.balance());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/wallet/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> status(
            @Valid @RequestBody WalletDtos.WalletStatusUpdateRequest request,
            Authentication auth,
            HttpServletRequest servletRequest) {
        String ip = getClientIp(servletRequest);

        WalletDtos.WalletBalanceResponse res = walletService.updateWalletStatus(request, getPrincipalId(auth), ip);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Wallet status updated successfully");
        response.put("balance", res.balance());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/admin/tax-summary")
    public ResponseEntity<Map<String, Object>> getTaxSummary(Authentication auth) {
        WalletDtos.TaxSummaryResponse res = walletService.getTaxSummary(getPrincipalId(auth));

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("wallet", res); // Mapped as "wallet" for state compat in TaxWalletTab
        return ResponseEntity.ok(response);
    }

    @GetMapping("/admin/wallet/fund-requests")
    public ResponseEntity<Map<String, Object>> getFundRequests(Authentication auth) {
        List<WalletDtos.FundRequestResponse> list = walletService.getFundRequests(getPrincipalId(auth));

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("requests", list);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/admin/wallet/fund-request")
    public ResponseEntity<Map<String, Object>> createFundRequest(
            @Valid @RequestBody WalletDtos.FundRequestCreateRequest request,
            Authentication auth) {
        WalletDtos.FundRequestResponse res = walletService.createFundRequest(request, getPrincipalId(auth));

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Fund request submitted successfully");
        response.put("request", res);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/admin/wallet/approve-request")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> approveFundRequest(
            @Valid @RequestBody WalletDtos.FundRequestProcessRequest request,
            Authentication auth,
            HttpServletRequest servletRequest) {
        String ip = getClientIp(servletRequest);

        WalletDtos.FundRequestResponse res = walletService.approveFundRequest(
                UUID.fromString(request.requestId()), getPrincipalId(auth), ip);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Fund request approved successfully");
        response.put("request", res);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/admin/wallet/reject-request")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> rejectFundRequest(
            @Valid @RequestBody WalletDtos.FundRequestProcessRequest request,
            Authentication auth,
            HttpServletRequest servletRequest) {
        String ip = getClientIp(servletRequest);

        WalletDtos.FundRequestResponse res = walletService.rejectFundRequest(
                UUID.fromString(request.requestId()), getPrincipalId(auth), ip);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Fund request rejected successfully");
        response.put("request", res);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/wallet/history")
    public ResponseEntity<Map<String, Object>> getLedgerHistory(
            @RequestParam(required = false, defaultValue = "ALL") String type,
            @RequestParam(required = false, defaultValue = "ALL") String context,
            @RequestParam(required = false, defaultValue = "ALL") String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size,
            @RequestParam(required = false, defaultValue = "createdAt") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String direction,
            Authentication auth) {

        Sort sort = Sort.by(Sort.Direction.fromString(direction), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);

        Page<WalletDtos.WalletHistoryEntryResponse> history = walletService.getLedgerHistory(
                getPrincipalId(auth), type, context, status, search, startDate, endDate, pageable);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("history", history.getContent());
        response.put("totalPages", history.getTotalPages());
        response.put("totalElements", history.getTotalElements());
        response.put("currentPage", history.getNumber());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/wallet/history/export")
    public ResponseEntity<byte[]> exportLedgerHistory(
            @RequestParam(required = false, defaultValue = "ALL") String type,
            @RequestParam(required = false, defaultValue = "ALL") String context,
            @RequestParam(required = false, defaultValue = "ALL") String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            Authentication auth) {

        byte[] csv = walletService.exportLedgerHistory(
                getPrincipalId(auth), type, context, status, search, startDate, endDate);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"wallet_history.csv\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(csv);
    }
}
