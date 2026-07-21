package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.RetailerServiceDtos;
import com.rupiksha.backend.api.dto.TransactionHistoryPageResponse;
import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.domain.TransactionStatus;
import com.rupiksha.backend.domain.TransactionReportType;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.WalletService;
import com.rupiksha.backend.service.TransactionHistoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.Instant;

@Slf4j
@RestController
@RequestMapping("/api/v1/transactions")
@RequiredArgsConstructor
public class TransactionController {
    private final TxnRepository txnRepository;
    private final UserRepository userRepository;
    private final WalletService walletService;
    private final TransactionHistoryService transactionHistoryService;

    /**
     * Client-initiated transaction log. The server ALWAYS records the txn as INITIATED
     * and ignores any client-provided status — status progression is owned by the
     * provider integration / webhook or admin reconciliation.
     */
    @PostMapping("/log")
    public Map<String, Object> log(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody RetailerServiceDtos.TxnLogRequest request
    ) {
        if (principal == null || principal.userId() == null
                || !principal.userId().equals(request.userId())) {
            throw new IllegalArgumentException("Invalid user context");
        }
        Txn txn = new Txn();
        txn.setUser(userRepository.findById(UUID.fromString(request.userId()))
                .orElseThrow(() -> new IllegalArgumentException("User not found")));
        txn.setAmount(request.amount());
        txn.setServiceType(request.service());
        txn.setProviderRef(request.operator());
        txn.setIdempotencyKey(UUID.randomUUID().toString());
        txn.setStatus(TransactionStatus.INITIATED);
        txnRepository.save(txn);
        return Map.of("success", true, "txnId", txn.getId().toString(), "status", txn.getStatus().name());
    }

    @GetMapping("/mine")
    public Map<String, Object> mine(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam(required = false) String userId
    ) {
        if (principal == null || principal.userId() == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        // Allow calls without userId; always scope to the authenticated user.
        String target = principal.userId();
        if (userId != null && !userId.isBlank() && !principal.userId().equals(userId)) {
            throw new IllegalArgumentException("Invalid user context");
        }
        List<Map<String, Object>> transactions = txnRepository.findByUserIdOrderByCreatedAtDesc(UUID.fromString(target))
                .stream()
                .map(this::toMap)
                .toList();
        return Map.of("success", true, "transactions", transactions);
    }

    @GetMapping("/{txnId}")
    public Map<String, Object> status(@AuthenticationPrincipal JwtPrincipal principal, @PathVariable String txnId) {
        if (principal == null || principal.userId() == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        Txn txn = txnRepository.findById(UUID.fromString(txnId))
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));
        if (!txn.getUser().getId().toString().equalsIgnoreCase(principal.userId())) {
            throw new IllegalArgumentException("Forbidden");
        }
        Map<String, Object> response = toMap(txn);
        response.put("success", true);
        response.put("status", txn.getStatus().name());
        response.put("txnId", txn.getId().toString());
        return response;
    }

    @GetMapping("/balance")
    public Map<String, Object> balance(@AuthenticationPrincipal JwtPrincipal principal) {
        if (principal == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        var wallet = walletService.getBalance(principal.userId().toString());
        return Map.of("success", true, "balance", wallet.balance());
    }

    @PostMapping("/reconcile")
    public Map<String, Object> reconcile(@AuthenticationPrincipal JwtPrincipal principal) {
        if (principal == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        long updated = txnRepository.findByUserIdOrderByCreatedAtDesc(UUID.fromString(principal.userId())).stream()
                .filter(txn -> txn.getStatus() == TransactionStatus.INITIATED)
                .filter(txn -> txn.getCreatedAt().isBefore(Instant.now().minusSeconds(600)))
                .peek(txn -> txn.setStatus(TransactionStatus.FAILED))
                .map(txnRepository::save)
                .count();
        return Map.of("success", true, "reconciled", updated);
    }

    @GetMapping("/history")
    public TransactionHistoryPageResponse history(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam String reportType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String provider,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection
    ) {
        if (principal == null || principal.userId() == null) {
            throw new IllegalArgumentException("Unauthorized");
        }

        TransactionReportType type = TransactionReportType.valueOf(reportType.toUpperCase());
        
        java.time.LocalDateTime start = parseDateTime(fromDate, false);
        java.time.LocalDateTime end = parseDateTime(toDate, true);

        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        if (sortBy != null && !sortBy.isBlank()) {
            Sort.Direction direction = Sort.Direction.DESC;
            if ("asc".equalsIgnoreCase(sortDirection)) {
                direction = Sort.Direction.ASC;
            }
            String sortField = sortBy;
            if ("date".equalsIgnoreCase(sortBy)) {
                sortField = "createdAt";
            }
            sort = Sort.by(direction, sortField);
        }

        Pageable pageable = PageRequest.of(page, size, sort);
        return transactionHistoryService.getHistory(
                type, UUID.fromString(principal.userId()), search, status, provider, start, end, pageable);
    }

    @GetMapping("/history/{transactionId}")
    public Map<String, Object> historyDetail(
            @AuthenticationPrincipal JwtPrincipal principal,
            @PathVariable String transactionId
    ) {
        if (principal == null || principal.userId() == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        TransactionHistoryResponseDto dto = transactionHistoryService.getTransactionDetail(
                UUID.fromString(principal.userId()), transactionId);
        return Map.of("success", true, "data", dto);
    }

    @GetMapping("/history/export")
    public List<TransactionHistoryResponseDto> export(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam String reportType,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String provider,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection
    ) {
        if (principal == null || principal.userId() == null) {
            throw new IllegalArgumentException("Unauthorized");
        }

        TransactionReportType type = TransactionReportType.valueOf(reportType.toUpperCase());

        java.time.LocalDateTime start = parseDateTime(fromDate, false);
        java.time.LocalDateTime end = parseDateTime(toDate, true);

        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        if (sortBy != null && !sortBy.isBlank()) {
            Sort.Direction direction = Sort.Direction.DESC;
            if ("asc".equalsIgnoreCase(sortDirection)) {
                direction = Sort.Direction.ASC;
            }
            String sortField = sortBy;
            if ("date".equalsIgnoreCase(sortBy)) {
                sortField = "createdAt";
            }
            sort = Sort.by(direction, sortField);
        }

        return transactionHistoryService.getAllHistory(
                type, UUID.fromString(principal.userId()), search, status, provider, start, end, sort);
    }

    private java.time.LocalDateTime parseDateTime(String dateStr, boolean endOfDay) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            String cleaned = dateStr.endsWith("Z") ? dateStr.substring(0, dateStr.length() - 1) : dateStr;
            if (cleaned.contains("T")) {
                String timePart = cleaned.split("\\.")[0];
                return java.time.LocalDateTime.parse(timePart);
            } else {
                java.time.LocalDate date = java.time.LocalDate.parse(cleaned);
                return endOfDay ? date.atTime(23, 59, 59) : date.atStartOfDay();
            }
        } catch (Exception e) {
            log.error("Failed to parse date string: {}", dateStr, e);
            return null;
        }
    }

    private Map<String, Object> toMap(Txn txn) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", txn.getId().toString());
        map.put("userId", txn.getUser().getId().toString());
        map.put("type", txn.getServiceType());
        map.put("amount", txn.getAmount());
        map.put("status", txn.getStatus().name());
        map.put("providerRef", txn.getProviderRef());
        map.put("created_at", txn.getCreatedAt());
        return map;
    }
}
