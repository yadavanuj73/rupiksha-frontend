package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.BbpsDtos;
import com.rupiksha.backend.api.dto.RetailerServiceDtos;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.TransactionStatus;
import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.BbpsService;
import com.rupiksha.backend.service.WalletService;
import com.rupiksha.backend.service.impl.BbpsProviderRouter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/bbps")
@RequiredArgsConstructor
public class BbpsController {

    private final BbpsService bbpsService;
    private final UserRepository userRepository;
    private final TxnRepository txnRepository;
    private final WalletService walletService;
    private final BbpsProviderRouter providerRouter;
    private final AppProperties appProperties;

    /**
     * Retrieves active mobile prepaid operators and telecom circles.
     */
    @GetMapping("/operators")
    public List<BbpsDtos.OperatorInfo> getOperators() {
        return bbpsService.getMobilePrepaidOperators();
    }

    /**
     * Retrieves recharge plans for specified operator billerId and circle.
     */
    @GetMapping("/plans")
    public List<BbpsDtos.PlanInfo> getPlans(
            @RequestParam String billerId,
            @RequestParam(required = false) String circle
    ) {
        return bbpsService.getRechargePlans(billerId, circle);
    }

    /**
     * Inspects BillAvenue MDM Biller Info for any biller ID (Section 11.0).
     */
    @GetMapping("/biller-info/{billerId}")
    public ResponseEntity<Object> getBillerInfo(@PathVariable String billerId) {
        Object info = bbpsService.getBillerInfo(billerId);
        return ResponseEntity.ok(info != null ? info : Map.of("message", "No MDM info available"));
    }

    /**
     * Executes server-authoritative Mobile Prepaid Recharge with wallet debit,
     * BillAvenue integration, and idempotent failure refund.
     */
    @PostMapping("/recharge")
    public ResponseEntity<BbpsDtos.RechargeResponse> recharge(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKeyHeader,
            @Valid @RequestBody BbpsDtos.RechargeRequest request,
            HttpServletRequest servletRequest
    ) {
        if (principal == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        UUID userId = UUID.fromString(principal.userId());

        // Respect header idempotency key if body idempotencyKey is not provided
        if ((request.getIdempotencyKey() == null || request.getIdempotencyKey().isBlank())
                && idempotencyKeyHeader != null && !idempotencyKeyHeader.isBlank()) {
            request.setIdempotencyKey(idempotencyKeyHeader.trim());
        }

        String clientIp = resolveClientIp(servletRequest);
        BbpsDtos.RechargeResponse response = bbpsService.recharge(userId, request, clientIp);
        return ResponseEntity.ok(response);
    }

    /**
     * Status of a BBPS transaction.
     */
    @GetMapping("/status/{txnId}")
    public ResponseEntity<BbpsDtos.RechargeResponse> status(
            @AuthenticationPrincipal JwtPrincipal principal,
            @PathVariable String txnId
    ) {
        if (principal == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        UUID userId = UUID.fromString(principal.userId());
        BbpsDtos.RechargeResponse response = bbpsService.checkStatus(userId, txnId);
        return ResponseEntity.ok(response);
    }

    /**
     * Manual reconciliation of pending transaction against BillAvenue status API.
     */
    @PostMapping("/reconcile/{txnId}")
    public ResponseEntity<BbpsDtos.RechargeResponse> reconcile(
            @AuthenticationPrincipal JwtPrincipal principal,
            @PathVariable String txnId
    ) {
        if (principal == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        UUID userId = UUID.fromString(principal.userId());
        BbpsDtos.RechargeResponse response = bbpsService.reconcile(userId, txnId);
        return ResponseEntity.ok(response);
    }

    /**
     * Retrieves electricity billers / DISCOMs, optionally filtered by state.
     */
    @GetMapping("/electricity/billers")
    public List<BbpsDtos.ElectricityBillerInfo> getElectricityBillers(
            @RequestParam(required = false) String state
    ) {
        return bbpsService.getElectricityBillers(state);
    }

    /**
     * Fetches real bill details from BillAvenue CU for specified electricity DISCOM.
     */
    @PostMapping("/electricity/fetch")
    public ResponseEntity<BbpsDtos.BillFetchResult> fetchElectricityBill(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody BbpsDtos.ElectricityFetchRequest request,
            HttpServletRequest servletRequest
    ) {
        if (principal == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        UUID userId = UUID.fromString(principal.userId());
        String clientIp = resolveClientIp(servletRequest);
        BbpsDtos.BillFetchResult response = bbpsService.fetchElectricityBill(userId, request, clientIp);
        return ResponseEntity.ok(response);
    }

    /**
     * Executes server-authoritative Electricity Bill Payment with wallet debit,
     * BillAvenue integration, fetchRequestId binding, and idempotent failure refund.
     */
    @PostMapping("/electricity/pay")
    public ResponseEntity<BbpsDtos.ElectricityPayResponse> payElectricityBill(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKeyHeader,
            @Valid @RequestBody BbpsDtos.ElectricityPayRequest request,
            HttpServletRequest servletRequest
    ) {
        if (principal == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        UUID userId = UUID.fromString(principal.userId());

        // Respect header idempotency key if body idempotencyKey is not provided
        if ((request.getIdempotencyKey() == null || request.getIdempotencyKey().isBlank())
                && idempotencyKeyHeader != null && !idempotencyKeyHeader.isBlank()) {
            request.setIdempotencyKey(idempotencyKeyHeader.trim());
        }

        String clientIp = resolveClientIp(servletRequest);
        BbpsDtos.ElectricityPayResponse response = bbpsService.payElectricityBill(userId, request, clientIp);
        return ResponseEntity.ok(response);
    }

    /**
     * Dedicated BBPS Transaction History with pagination, filters, and summary metrics.
     */
    @GetMapping("/history")
    public ResponseEntity<BbpsDtos.HistoryResponse> getHistory(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size
    ) {
        if (principal == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        UUID userId = UUID.fromString(principal.userId());
        Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "createdAt"));
        BbpsDtos.HistoryResponse response = bbpsService.getHistory(userId, category, status, search, startDate, endDate, pageable);
        return ResponseEntity.ok(response);
    }

    /**
     * BillAvenue push notification/refund callback endpoint.
     */
    @PostMapping("/callback")
    public ResponseEntity<Map<String, Object>> handleCallback(@RequestBody(required = false) String body) {
        log.info("Received BillAvenue callback payload");
        bbpsService.handlePushNotification(body);
        return ResponseEntity.ok(Map.of("status", "SUCCESS", "message", "Callback received"));
    }

    // ── LEGACY ENDPOINTS PRESERVED ──────────────────────────────────────────

    @PostMapping("/fetch")
    public RetailerServiceDtos.BillFetchResponse fetch(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody RetailerServiceDtos.BbpsFetchRequest request
    ) {
        validateUser(principal, request.userId());
        if (!appProperties.services().bbpsEnabled()) {
            return new RetailerServiceDtos.BillFetchResponse(false, "BBPS service disabled by configuration", Map.of());
        }
        var providerResponse = providerRouter.current()
                .fetch(request.userId(), request.biller(), request.opcode(), request.consumerNo(), request.category());
        return new RetailerServiceDtos.BillFetchResponse(providerResponse.success(), providerResponse.message(), providerResponse.bill());
    }

    @PostMapping("/pay")
    public RetailerServiceDtos.GenericTxnResponse pay(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody RetailerServiceDtos.BbpsPayRequest request
    ) {
        validateUser(principal, request.userId());
        if (!appProperties.services().bbpsEnabled()) {
            return new RetailerServiceDtos.GenericTxnResponse(false, null, "BBPS service disabled by configuration", null, Map.of());
        }
        var providerResponse = providerRouter.current()
                .pay(request.userId(), request.biller(), request.opcode(), request.consumerNo(), request.category(), request.amount());
        walletService.debit(new WalletDtos.WalletEntryRequest(request.userId(), request.amount(), "BBPS payment initiated"));
        Txn txn = new Txn();
        txn.setUser(userRepository.findById(UUID.fromString(request.userId()))
                .orElseThrow(() -> new IllegalArgumentException("User not found")));
        txn.setAmount(request.amount());
        txn.setServiceType("BBPS_" + request.opcode());
        txn.setStatus(providerResponse.success() ? TransactionStatus.SUCCESS : TransactionStatus.FAILED);
        txn.setProviderRef(providerResponse.providerTxnId());
        txn.setIdempotencyKey(UUID.randomUUID().toString());
        txnRepository.save(txn);
        if (!providerResponse.success()) {
            walletService.credit(new WalletDtos.WalletEntryRequest(request.userId(), request.amount(), "BBPS payment failed refund"));
        }
        return new RetailerServiceDtos.GenericTxnResponse(
                providerResponse.success(),
                txn.getId().toString(),
                providerResponse.message(),
                null,
                providerResponse.raw()
        );
    }

    private void validateUser(JwtPrincipal principal, String userId) {
        if (principal == null || !principal.userId().toString().equals(userId)) {
            throw new IllegalArgumentException("Invalid user context");
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) return "127.0.0.1";
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip != null && !ip.isBlank() ? ip : "127.0.0.1";
    }
}
