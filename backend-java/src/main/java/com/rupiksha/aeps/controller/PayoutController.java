package com.rupiksha.aeps.controller;

import com.rupiksha.aeps.dto.BankVerificationRequest;
import com.rupiksha.aeps.dto.BankVerificationResponse;
import com.rupiksha.aeps.dto.PayoutRequest;
import com.rupiksha.aeps.dto.PayoutResponse;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.service.PayoutService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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

    /**
     * Initiate instant payout transaction
     */
    @PostMapping("/initiate")
    public ResponseEntity<PayoutResponse> initiatePayout(
            @Valid @RequestBody PayoutRequest request,
            Authentication authentication
    ) {
        String userId = authentication.getName();
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
            Authentication authentication
    ) {
        String userId = authentication.getName();
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
            Authentication authentication
    ) {
        String userId = authentication.getName();
        PayoutResponse response = payoutService.checkPayoutStatus(orderId, userId);
        return ResponseEntity.ok(response);
    }

    /**
     * Get transaction by orderId
     */
    @GetMapping("/transaction/{orderId}")
    public ResponseEntity<PayoutTransaction> getTransaction(
            @PathVariable String orderId,
            Authentication authentication
    ) {
        String userId = authentication.getName();
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
            Authentication authentication
    ) {
        String userId = authentication.getName();
        List<PayoutTransaction> transactions = payoutService.getUserTransactions(userId);
        return ResponseEntity.ok(transactions);
    }

    /**
     * Generate unique order ID
     */
    @GetMapping("/generate-order-id")
    public ResponseEntity<Map<String, String>> generateOrderId(Authentication authentication) {
        String userId = authentication.getName();
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
