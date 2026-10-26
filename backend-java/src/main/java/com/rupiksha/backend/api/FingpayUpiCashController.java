package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.FingpayUpiCashDtos.*;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.FingpayUpiCashService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping({"/api/v1/upicw", "/api/upicw"})
@RequiredArgsConstructor
public class FingpayUpiCashController {

    private final FingpayUpiCashService upiCashService;

    /**
     * Retailer endpoint to initiate UPI Cash Withdrawal transaction.
     * Generates real provider Base64 QR code and starts bounded transaction lifecycle.
     */
    @PostMapping("/initiate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<InitiateResponse> initiate(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody InitiateRequest request,
            HttpServletRequest httpRequest) {

        String ipAddress = resolveClientIp(httpRequest);
        UUID userId = UUID.fromString(principal.userId());
        log.info("UPI Cash Point initiate requested by user: {} from IP: {}", principal.username(), ipAddress);

        InitiateResponse response = upiCashService.initiatePayment(userId, request, ipAddress);
        return ResponseEntity.ok(response);
    }

    /**
     * Checks current status of a transaction with Fingpay.
     * If payment completed, executes authoritative idempotent wallet credit.
     */
    @PostMapping("/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<StatusCheckResponse> checkStatus(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestBody StatusCheckRequest request,
            HttpServletRequest httpRequest) {

        String ipAddress = resolveClientIp(httpRequest);
        UUID userId = UUID.fromString(principal.userId());
        log.info("UPI Cash Point status check requested by user: {}, partnerReqId: {}", principal.username(), request.getPartnerRequestId());

        StatusCheckResponse response = upiCashService.checkStatus(userId, request, ipAddress);
        return ResponseEntity.ok(response);
    }

    /**
     * Provider Callback webhook endpoint registered with Fingpay.
     * Accepts server-to-server POST notifications for SUCCESS/FAILED outcomes.
     */
    @PostMapping(value = {"/callback", "/v1/callback"},
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CallbackResponse> handleCallback(
            @RequestHeader(value = "hash", required = false) String hashHeader,
            @RequestHeader(value = "Hash", required = false) String hashHeaderCap,
            @RequestBody String rawBody,
            HttpServletRequest httpRequest) {

        String effectiveHash = (hashHeader != null && !hashHeader.isBlank()) ? hashHeader : hashHeaderCap;
        String ipAddress = resolveClientIp(httpRequest);
        log.info("Received Fingpay UPI Cash Withdrawal callback from IP: {}", ipAddress);

        CallbackResponse response = upiCashService.processCallback(rawBody, effectiveHash, ipAddress);
        return ResponseEntity.ok(response);
    }

    /**
     * Executes three-way reconciliation with Fingpay for a completed transaction.
     */
    @PostMapping("/reconcile/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ThreeWayReconResponse> reconcile(
            @AuthenticationPrincipal JwtPrincipal principal,
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {

        String ipAddress = resolveClientIp(httpRequest);
        UUID userId = UUID.fromString(principal.userId());
        log.info("UPI Cash Point three-way recon requested by user: {} for txn: {}", principal.username(), id);

        ThreeWayReconResponse response = upiCashService.reconcile(userId, id, ipAddress);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieves paginated transaction history with server-side filters.
     */
    @GetMapping("/history")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Page<TransactionDetailResponse>> getHistory(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size) {

        UUID userId = UUID.fromString(principal.userId());
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100), Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<TransactionDetailResponse> history = upiCashService.getHistory(userId, status, search, startDate, endDate, pageable);
        return ResponseEntity.ok(history);
    }

    /**
     * Summary metrics for the Retailer UPI Cash Point history cards.
     */
    @GetMapping("/history/summary")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<HistorySummaryResponse> getSummary(
            @AuthenticationPrincipal JwtPrincipal principal) {

        UUID userId = UUID.fromString(principal.userId());
        HistorySummaryResponse summary = upiCashService.getHistorySummary(userId);
        return ResponseEntity.ok(summary);
    }

    /**
     * Full dataset export for PDF, Excel, and CSV downloads (bounded to max 3000 rows).
     */
    @GetMapping("/history/export")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TransactionDetailResponse>> getExport(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        UUID userId = UUID.fromString(principal.userId());
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        List<TransactionDetailResponse> list = upiCashService.getHistoryForExport(userId, status, search, startDate, endDate, sort);
        return ResponseEntity.ok(list);
    }

    /**
     * Single transaction detail lookup.
     */
    @GetMapping("/details/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<TransactionDetailResponse> getDetails(
            @AuthenticationPrincipal JwtPrincipal principal,
            @PathVariable UUID id) {

        UUID userId = UUID.fromString(principal.userId());
        TransactionDetailResponse detail = upiCashService.getTransactionDetail(userId, id);
        return ResponseEntity.ok(detail);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }
}
