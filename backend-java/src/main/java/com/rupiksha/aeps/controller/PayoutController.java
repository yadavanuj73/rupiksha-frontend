package com.rupiksha.aeps.controller;

import com.rupiksha.aeps.dto.BankVerificationRequest;
import com.rupiksha.aeps.dto.BankVerificationResponse;
import com.rupiksha.aeps.dto.PayoutRequest;
import com.rupiksha.aeps.dto.PayoutResponse;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.service.PayoutService;
import com.rupiksha.backend.security.JwtPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
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

    /**
     * Initiate instant payout transaction
     */
    @PostMapping("/initiate")
    public ResponseEntity<PayoutResponse> initiatePayout(
            @Valid @RequestBody PayoutRequest request,
            @AuthenticationPrincipal JwtPrincipal principal,
            Authentication authentication
    ) {
        String userId = resolveUserId(principal, authentication);
        log.info("Initiating payout for user: {}, amount: ₹{}, beneficiary: {}", userId, request.getAmount(), request.getBeneficiaryName());
        PayoutResponse response = payoutService.initiatePayout(request, userId);
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
