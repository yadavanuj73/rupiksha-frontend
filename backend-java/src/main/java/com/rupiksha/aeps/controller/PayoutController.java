package com.rupiksha.aeps.controller;

import com.rupiksha.aeps.dto.PayoutRequest;
import com.rupiksha.aeps.dto.PayoutResponse;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.service.PayoutService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
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
     * Initiate a payout transaction
     */
    @PostMapping("/initiate")
    public ResponseEntity<PayoutResponse> initiatePayout(
        @Valid @RequestBody PayoutRequest request,
        Authentication authentication
    ) {
        String userId = authentication.getName();
        log.info("Payout request received for OrderId: {} by user: {}", request.getOrderId(), userId);
        
        PayoutResponse response = payoutService.initiatePayout(request, userId);
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
        
        // Verify user owns this transaction
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
     * Get transactions by status
     */
    @GetMapping("/transactions/status/{status}")
    public ResponseEntity<List<PayoutTransaction>> getTransactionsByStatus(
        @PathVariable String status,
        Authentication authentication
    ) {
        String userId = authentication.getName();
        List<PayoutTransaction> transactions = payoutService.getUserTransactionsByStatus(userId, status);
        return ResponseEntity.ok(transactions);
    }

    /**
     * Get transactions within date range
     */
    @GetMapping("/transactions/date-range")
    public ResponseEntity<List<PayoutTransaction>> getTransactionsByDateRange(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
        Authentication authentication
    ) {
        String userId = authentication.getName();
        List<PayoutTransaction> transactions = payoutService.getUserTransactionsByDateRange(userId, startDate, endDate);
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
        response.put("service", "Payout Service");
        return ResponseEntity.ok(response);
    }
}

// Made with Bob
