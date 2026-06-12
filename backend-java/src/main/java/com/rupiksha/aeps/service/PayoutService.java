package com.rupiksha.aeps.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.config.PayoutProperties;
import com.rupiksha.aeps.dto.PayoutRequest;
import com.rupiksha.aeps.dto.PayoutResponse;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.aeps.util.SignatureUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final PayoutProperties payoutProperties;
    private final PayoutTransactionRepository payoutTransactionRepository;

    /**
     * Initiate a payout transaction
     */
    public PayoutResponse initiatePayout(PayoutRequest payoutRequest, String userId) {
        try {
            // Check if orderId already exists
            if (payoutTransactionRepository.existsByOrderId(payoutRequest.getOrderId())) {
                throw new IllegalArgumentException("OrderId already exists: " + payoutRequest.getOrderId());
            }

            // Create transaction record
            PayoutTransaction transaction = PayoutTransaction.builder()
                .orderId(payoutRequest.getOrderId())
                .userId(userId)
                .amount(payoutRequest.getAmount())
                .beneficiaryName(payoutRequest.getBeneficiaryName())
                .accountNumber(payoutRequest.getAccountNumber())
                .ifsc(payoutRequest.getIfsc())
                .bankName(payoutRequest.getBankName())
                .transferMode(payoutRequest.getTransferMode())
                .remarks(payoutRequest.getRemarks())
                .mobileNumber(payoutRequest.getMobileNumber())
                .accountType(payoutRequest.getAccountType())
                .status("PENDING")
                .build();

            payoutTransactionRepository.save(transaction);

            String apiKey = payoutProperties.getApiKey();
            String payoutUrl = payoutProperties.getPayoutUrl();

            // Step 1: Convert DTO to compact JSON
            String compactJson = objectMapper.writeValueAsString(payoutRequest);

            // Step 2: Generate timestamp
            String timestamp = SignatureUtil.getCurrentTimestamp();

            // Step 3: Generate signature
            String signature = SignatureUtil.generateSignature(apiKey, timestamp, compactJson);

            // Debug logs
            log.info("========= QUICKZAPS PAYOUT DEBUG =========");
            log.info("API Key      : {}", apiKey);
            log.info("Timestamp    : {}", timestamp);
            log.info("Compact JSON : {}", compactJson);
            log.info("Signature    : {}", signature);
            log.info("==========================================");

            // Step 4: Set headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-api-key", apiKey);
            headers.set("x-signature", signature);
            headers.set("x-timestamp", timestamp);

            // Step 5: Make API call
            HttpEntity<String> entity = new HttpEntity<>(compactJson, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                payoutUrl,
                HttpMethod.POST,
                entity,
                String.class
            );

            log.info("QuickZaps Response Status : {}", response.getStatusCode());
            log.info("QuickZaps Response Body   : {}", response.getBody());

            PayoutResponse payoutResponse = objectMapper.readValue(response.getBody(), PayoutResponse.class);

            // Update transaction with response
            transaction.setStatusCode(payoutResponse.getStatusCode());
            transaction.setResponseMessage(payoutResponse.getMessage());
            transaction.setResponseData(response.getBody());
            
            if ("200".equals(payoutResponse.getStatusCode()) || "SUCCESS".equalsIgnoreCase(payoutResponse.getStatus())) {
                transaction.setStatus("SUCCESS");
            } else {
                transaction.setStatus("FAILED");
            }
            
            payoutTransactionRepository.save(transaction);

            return payoutResponse;

        } catch (HttpClientErrorException e) {
            log.error("QuickZaps Error Status : {}", e.getStatusCode());
            log.error("QuickZaps Error Body   : {}", e.getResponseBodyAsString());
            
            // Update transaction status
            updateTransactionStatus(payoutRequest.getOrderId(), "FAILED", 
                String.valueOf(e.getStatusCode().value()), e.getResponseBodyAsString());
            
            try {
                return objectMapper.readValue(e.getResponseBodyAsString(), PayoutResponse.class);
            } catch (Exception ex) {
                return PayoutResponse.builder()
                    .statusCode(String.valueOf(e.getStatusCode().value()))
                    .message(e.getResponseBodyAsString())
                    .build();
            }
        } catch (Exception e) {
            log.error("Payout failed: {}", e.getMessage(), e);
            
            // Update transaction status
            updateTransactionStatus(payoutRequest.getOrderId(), "FAILED", "500", e.getMessage());
            
            return PayoutResponse.builder()
                .statusCode("500")
                .message("Payout failed: " + e.getMessage())
                .build();
        }
    }

    /**
     * Get payout transaction by orderId
     */
    public PayoutTransaction getTransactionByOrderId(String orderId) {
        return payoutTransactionRepository.findByOrderId(orderId)
            .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + orderId));
    }

    /**
     * Get all transactions for a user
     */
    public List<PayoutTransaction> getUserTransactions(String userId) {
        return payoutTransactionRepository.findByUserId(userId);
    }

    /**
     * Get transactions by status for a user
     */
    public List<PayoutTransaction> getUserTransactionsByStatus(String userId, String status) {
        return payoutTransactionRepository.findByUserIdAndStatus(userId, status);
    }

    /**
     * Get transactions within date range
     */
    public List<PayoutTransaction> getUserTransactionsByDateRange(
        String userId, 
        LocalDateTime startDate, 
        LocalDateTime endDate
    ) {
        return payoutTransactionRepository.findByUserIdAndCreatedAtBetween(userId, startDate, endDate);
    }

    /**
     * Generate unique order ID
     */
    public String generateOrderId(String userId) {
        return "PO" + System.currentTimeMillis() + "_" + userId.substring(0, Math.min(4, userId.length()));
    }

    /**
     * Update transaction status
     */
    private void updateTransactionStatus(String orderId, String status, String statusCode, String message) {
        try {
            payoutTransactionRepository.findByOrderId(orderId).ifPresent(transaction -> {
                transaction.setStatus(status);
                transaction.setStatusCode(statusCode);
                transaction.setResponseMessage(message);
                payoutTransactionRepository.save(transaction);
            });
        } catch (Exception e) {
            log.error("Failed to update transaction status: {}", e.getMessage());
        }
    }
}

// Made with Bob
