package com.rupiksha.aeps.controller;

import com.rupiksha.aeps.dto.BankVerificationRequest;
import com.rupiksha.aeps.dto.BankVerificationResponse;
import com.rupiksha.aeps.dto.PayoutBeneficiaryDto;
import com.rupiksha.aeps.dto.PayoutChargeSlabDto;
import com.rupiksha.aeps.dto.PayoutRequest;
import com.rupiksha.aeps.dto.PayoutResponse;
import com.rupiksha.aeps.entity.PayoutStatusHistory;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.repository.PayoutStatusHistoryRepository;
import com.rupiksha.aeps.service.PayoutReconciliationService;
import com.rupiksha.aeps.service.PayoutService;
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

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/payout")
@RequiredArgsConstructor
public class PayoutController {

    private final PayoutService payoutService;
    private final PayoutReconciliationService payoutReconciliationService;
    private final PayoutStatusHistoryRepository payoutStatusHistoryRepository;
    private final com.rupiksha.aeps.service.PayoutOtpService payoutOtpService;

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
        throw new IllegalArgumentException("Unauthorized: User context missing");
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
     * Stage A: Request mandatory Payout OTP challenge bound to exact transaction details.
     */
    @PreAuthorize("hasAnyRole('RETAILER', 'DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'ADMIN')")
    @PostMapping("/otp/send")
    public ResponseEntity<com.rupiksha.aeps.dto.PayoutOtpSendResponse> sendOtp(
            @Valid @RequestBody com.rupiksha.aeps.dto.PayoutOtpSendRequest request,
            HttpServletRequest httpRequest,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        String clientIp = extractClientIp(httpRequest);
        String userAgent = httpRequest != null ? httpRequest.getHeader("User-Agent") : "";
        log.info("Requesting payout OTP for user: {}, amount: ₹{}, ip: {}", userId, request.getAmount(), clientIp);
        com.rupiksha.aeps.dto.PayoutOtpSendResponse response = payoutOtpService.sendOtp(request, userId, clientIp, userAgent);
        return ResponseEntity.ok(response);
    }

    /**
     * Stage B: Verify Payout OTP, revalidate payout details, and issue single-use authorization reference.
     */
    @PreAuthorize("hasAnyRole('RETAILER', 'DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'ADMIN')")
    @PostMapping("/otp/verify")
    public ResponseEntity<com.rupiksha.aeps.dto.PayoutOtpVerifyResponse> verifyOtp(
            @Valid @RequestBody com.rupiksha.aeps.dto.PayoutOtpVerifyRequest request,
            HttpServletRequest httpRequest,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        String clientIp = extractClientIp(httpRequest);
        String userAgent = httpRequest != null ? httpRequest.getHeader("User-Agent") : "";
        log.info("Verifying payout OTP for user: {}, challenge: {}, ip: {}", userId, request.getChallengeId(), clientIp);
        com.rupiksha.aeps.dto.PayoutOtpVerifyResponse response = payoutOtpService.verifyOtp(request, userId, clientIp, userAgent);
        return ResponseEntity.ok(response);
    }

    /**
     * Initiate instant payout transaction with strict rate limiting, idempotency, and status safeguards.
     */
    @PreAuthorize("hasAnyRole('RETAILER', 'DISTRIBUTOR', 'SUPER_DISTRIBUTOR', 'ADMIN')")
    @PostMapping("/initiate")
    public ResponseEntity<PayoutResponse> initiatePayout(
            @Valid @RequestBody PayoutRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest httpRequest,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        String clientIp = extractClientIp(httpRequest);
        log.info("Initiating payout for user: {}, amount: ₹{}, beneficiary: {}, idempotencyKey: {}, ip: {}",
                userId, request.getAmount(), request.getBeneficiaryName(), idempotencyKey, clientIp);
        PayoutResponse response = payoutService.initiatePayout(request, userId, idempotencyKey, clientIp);
        return ResponseEntity.ok(response);
    }

    /**
     * Penny-less / Penny-drop bank account verification
     */
    @PostMapping("/verify-account")
    public ResponseEntity<BankVerificationResponse> verifyAccount(
            @Valid @RequestBody BankVerificationRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        log.info("Bank account verification request for IFSC: {} by user: {}", request.getIfsc(), userId);
        BankVerificationResponse response = payoutService.verifyBankAccount(request, userId);
        return ResponseEntity.ok(response);
    }

    /**
     * Real-time payout status check
     */
    @GetMapping("/status/{orderId}")
    public ResponseEntity<PayoutResponse> checkStatus(
            @PathVariable String orderId,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        PayoutResponse response = payoutService.checkPayoutStatus(orderId, userId);
        return ResponseEntity.ok(response);
    }

    /**
     * Get transaction by orderId
     */
    @GetMapping("/transaction/{orderId}")
    public ResponseEntity<PayoutTransaction> getTransaction(
            @PathVariable String orderId,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        PayoutTransaction transaction = payoutService.getTransactionByOrderId(orderId);
        if (!transaction.getUserId().equals(userId)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(transaction);
    }

    /**
     * Get all transactions for logged-in user
     */
    @GetMapping("/transactions")
    public ResponseEntity<List<PayoutTransaction>> getUserTransactions(
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        List<PayoutTransaction> transactions = payoutService.getUserTransactions(userId);
        return ResponseEntity.ok(transactions);
    }

    /**
     * Generate unique order ID
     */
    @GetMapping("/generate-order-id")
    public ResponseEntity<Map<String, String>> generateOrderId(
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        String orderId = payoutService.generateOrderId(userId);
        Map<String, String> response = new HashMap<>();
        response.put("orderId", orderId);
        return ResponseEntity.ok(response);
    }

    /**
     * Get saved beneficiaries for logged-in user
     */
    @GetMapping("/beneficiaries")
    public ResponseEntity<List<PayoutBeneficiaryDto>> getBeneficiaries(
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        List<PayoutBeneficiaryDto> beneficiaries = payoutService.getBeneficiaries(userId);
        return ResponseEntity.ok(beneficiaries);
    }

    /**
     * Add a new saved beneficiary
     */
    @PostMapping("/beneficiaries")
    public ResponseEntity<PayoutBeneficiaryDto> addBeneficiary(
            @Valid @RequestBody PayoutBeneficiaryDto request,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        log.info("Adding beneficiary {} for user {}", request.getBeneficiaryName(), userId);
        PayoutBeneficiaryDto saved = payoutService.addBeneficiary(request, userId);
        return ResponseEntity.ok(saved);
    }

    /**
     * Delete a saved beneficiary
     */
    @DeleteMapping("/beneficiaries/{id}")
    public ResponseEntity<Map<String, Object>> deleteBeneficiary(
            @PathVariable Long id,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        log.info("Deleting beneficiary ID {} for user {}", id, userId);
        payoutService.deleteBeneficiary(id, userId);
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Beneficiary deleted successfully");
        return ResponseEntity.ok(response);
    }

    // ─── ADMIN APPROVAL & RECONCILIATION ENDPOINTS ────────────────────────────

    /**
     * Admin: Trigger manual reconciliation for a specific payout order
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/reconcile/{orderId}")
    public ResponseEntity<PayoutResponse> adminReconcileTransaction(
            @PathVariable String orderId,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String adminId = resolveUserId(principal, authentication);
        log.info("[ADMIN_ACTION] Admin {} triggered manual reconciliation for payout order {}", adminId, orderId);
        PayoutResponse response = payoutReconciliationService.reconcileTransaction(orderId, adminId);
        return ResponseEntity.ok(response);
    }

    /**
     * Admin: Trigger batch reconciliation for pending/in-flight payouts
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/reconcile-batch")
    public ResponseEntity<Map<String, Object>> adminReconcileBatch(
            @RequestParam(defaultValue = "20") int maxRecords,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String adminId = resolveUserId(principal, authentication);
        log.info("[ADMIN_ACTION] Admin {} triggered batch payout reconciliation (limit: {})", adminId, maxRecords);
        Map<String, Object> summary = payoutReconciliationService.reconcileAllPending(maxRecords, adminId);
        return ResponseEntity.ok(summary);
    }

    /**
     * Get lifecycle status history / audit trail for a payout order
     */
    @GetMapping("/status-history/{orderId}")
    public ResponseEntity<List<PayoutStatusHistory>> getStatusHistory(
            @PathVariable String orderId,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        PayoutTransaction txn = payoutService.getTransactionByOrderId(orderId);

        boolean isAdmin = authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (!isAdmin && !txn.getUserId().equals(userId)) {
            return ResponseEntity.status(403).build();
        }

        List<PayoutStatusHistory> history = payoutStatusHistoryRepository.findByOrderIdOrderByCreatedAtAsc(orderId);
        return ResponseEntity.ok(history);
    }

    /**
     * Admin: Get all beneficiaries across all users with user metadata
     */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/beneficiaries")
    public ResponseEntity<List<PayoutBeneficiaryDto>> getAllBeneficiariesForAdmin(
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String adminId = resolveUserId(principal, authentication);
        log.info("Admin {} fetching all beneficiaries for review", adminId);
        List<PayoutBeneficiaryDto> list = payoutService.getAllBeneficiariesForAdmin();
        return ResponseEntity.ok(list);
    }

    /**
     * Admin: Get summary statistics for beneficiaries (approved, pending, rejected)
     */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/admin/beneficiaries/stats")
    public ResponseEntity<Map<String, Long>> getBeneficiaryStatsForAdmin(
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        Map<String, Long> stats = payoutService.getBeneficiaryStatsForAdmin();
        return ResponseEntity.ok(stats);
    }

    /**
     * Admin: Approve a beneficiary
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/beneficiaries/{id}/approve")
    public ResponseEntity<PayoutBeneficiaryDto> approveBeneficiary(
            @PathVariable Long id,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String adminId = resolveUserId(principal, authentication);
        log.info("Admin {} approving beneficiary ID {}", adminId, id);
        PayoutBeneficiaryDto approved = payoutService.adminApproveBeneficiary(id, adminId);
        return ResponseEntity.ok(approved);
    }

    /**
     * Admin: Reject a beneficiary
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/beneficiaries/{id}/reject")
    public ResponseEntity<PayoutBeneficiaryDto> rejectBeneficiary(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String adminId = resolveUserId(principal, authentication);
        String reason = body != null ? body.get("reason") : null;
        log.info("Admin {} rejecting beneficiary ID {} with reason: {}", adminId, id, reason);
        PayoutBeneficiaryDto rejected = payoutService.adminRejectBeneficiary(id, reason, adminId);
        return ResponseEntity.ok(rejected);
    }

    /**
     * Get active payout charge slabs (for Retailer & Admin)
     */
    @GetMapping("/charges")
    public ResponseEntity<List<PayoutChargeSlabDto>> getPayoutCharges() {
        return ResponseEntity.ok(payoutService.getPayoutChargeSlabs());
    }

    /**
     * Admin: Update payout charge slabs (Auto-computes 18% GST)
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/admin/charges")
    public ResponseEntity<List<PayoutChargeSlabDto>> updatePayoutCharges(
            @RequestBody List<PayoutChargeSlabDto> slabs,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String adminId = resolveUserId(principal, authentication);
        log.info("Admin {} updating payout charge slabs: {}", adminId, slabs);
        List<PayoutChargeSlabDto> updated = payoutService.updatePayoutChargeSlabs(slabs);
        return ResponseEntity.ok(updated);
    }

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "Payout Hub Service");
        return ResponseEntity.ok(response);
    }
}
