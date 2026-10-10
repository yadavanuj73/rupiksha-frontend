package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.WalletTransferDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.WalletTransferService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/wallet-transfer")
@RequiredArgsConstructor
public class WalletTransferController {

    private final WalletTransferService walletTransferService;

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

    private String getIdempotencyKey(HttpServletRequest request, WalletTransferDtos.WalletTransferRequest body) {
        String key = request.getHeader("X-Idempotency-Key");
        if (key == null || key.isBlank()) {
            key = body.idempotencyKey();
        }
        if (key == null || key.isBlank()) {
            key = UUID.randomUUID().toString();
        }
        return key;
    }

    @GetMapping("/recipients")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> searchRecipient(
            @RequestParam String mobile,
            Authentication auth
    ) {
        WalletTransferDtos.RecipientLookupResponse recipient = walletTransferService.searchRecipient(mobile, getPrincipalId(auth));
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", recipient);
        return ResponseEntity.ok(response);
    }

    @PostMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> transferFunds(
            @Valid @RequestBody WalletTransferDtos.WalletTransferRequest request,
            Authentication auth,
            HttpServletRequest servletRequest
    ) {
        String ip = getClientIp(servletRequest);
        String idempotencyKey = getIdempotencyKey(servletRequest, request);

        WalletTransferDtos.WalletTransferResponse res = walletTransferService.transferFunds(
                request,
                getPrincipalId(auth),
                ip,
                idempotencyKey
        );

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Wallet transfer completed successfully");
        response.put("data", res);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{referenceNumber}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getTransferDetails(
            @PathVariable String referenceNumber,
            Authentication auth
    ) {
        WalletTransferDtos.WalletTransferResponse res = walletTransferService.getTransferDetails(referenceNumber, getPrincipalId(auth));
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("data", res);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/history")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<WalletTransferDtos.WalletTransferHistoryPageResponse> getTransferHistory(
            @RequestParam(required = false, defaultValue = "ALL") String direction,
            @RequestParam(required = false, defaultValue = "ALL") String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "10") int size,
            @RequestParam(required = false, defaultValue = "createdAt") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection,
            Authentication auth
    ) {
        Sort sort = Sort.by(Sort.Direction.fromString(sortDirection), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);

        WalletTransferDtos.WalletTransferHistoryPageResponse response = walletTransferService.getTransferHistory(
                getPrincipalId(auth),
                direction,
                status,
                search,
                startDate,
                endDate,
                pageable
        );

        return ResponseEntity.ok(response);
    }
}
