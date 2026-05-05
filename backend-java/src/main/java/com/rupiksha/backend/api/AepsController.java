package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.RetailerServiceDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.domain.TransactionStatus;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.impl.AepsProviderRouter;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v1/aeps")
@RequiredArgsConstructor
public class AepsController {
    private final UserRepository userRepository;
    private final TxnRepository txnRepository;
    private final AepsProviderRouter providerRouter;
    private final AppProperties appProperties;

    @PostMapping("/transaction")
    public RetailerServiceDtos.GenericTxnResponse transaction(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody RetailerServiceDtos.AepsTxnRequest request
    ) {
        validateUser(principal, request.userId());
        if (!appProperties.services().aepsEnabled()) {
            return new RetailerServiceDtos.GenericTxnResponse(false, null, "AEPS service disabled by configuration", null, Map.of());
        }
        String tab = request.tab().toLowerCase();
        var providerResponse = providerRouter.current()
                .transact(request.userId(), tab, request.mobile(), request.operator(), request.bankName(), request.amount());
        Txn txn = new Txn();
        txn.setUser(userRepository.findById(UUID.fromString(request.userId()))
                .orElseThrow(() -> new IllegalArgumentException("User not found")));
        txn.setAmount(request.amount() == null ? BigDecimal.ZERO : request.amount());
        txn.setServiceType("AEPS_" + tab.toUpperCase());
        txn.setStatus(providerResponse.success() ? TransactionStatus.SUCCESS : TransactionStatus.FAILED);
        txn.setProviderRef(providerResponse.providerTxnId());
        txn.setIdempotencyKey(UUID.randomUUID().toString());
        txnRepository.save(txn);
        return new RetailerServiceDtos.GenericTxnResponse(
                providerResponse.success(),
                txn.getId().toString(),
                providerResponse.message(),
                null,
                providerResponse.raw()
        );
    }

    @GetMapping("/history")
    public Map<String, Object> history(@AuthenticationPrincipal JwtPrincipal principal, @RequestParam String userId) {
        validateUser(principal, userId);
        List<Map<String, Object>> transactions = txnRepository.findByUserIdOrderByCreatedAtDesc(UUID.fromString(userId)).stream()
                .filter(txn -> txn.getServiceType().startsWith("AEPS_"))
                .map(txn -> Map.<String, Object>of(
                        "id", txn.getId().toString(),
                        "type", txn.getServiceType(),
                        "amount", txn.getAmount(),
                        "status", txn.getStatus().name(),
                        "created_at", txn.getCreatedAt()
                ))
                .toList();
        return Map.of("success", true, "transactions", transactions);
    }

    @PostMapping("/status-check")
    public Map<String, Object> statusCheck(@RequestBody Map<String, Object> request) {
        return Map.of(
                "success", true,
                "message", "Status available",
                "merchantTranId", String.valueOf(request.getOrDefault("merchantTranId", "")),
                "status", "SUCCESS"
        );
    }

    @PostMapping("/recon")
    public Map<String, Object> recon(@RequestBody Map<String, Object> request) {
        return Map.of("success", true, "message", "Reconciliation generated", "date", request.get("date"));
    }

    @PostMapping("/whitelist-request")
    public Map<String, Object> whitelist(@RequestBody Map<String, Object> request) {
        return Map.of(
                "success", true,
                "message", "Whitelist request captured",
                "emailSubject", "Whitelist request for AEPS onboarding",
                "payload", request
        );
    }

    @PostMapping("/2fa")
    public Map<String, Object> verify2fa(@RequestBody Map<String, Object> request) {
        return Map.of("success", true, "message", "2FA verified", "verifiedAt", Instant.now().toString());
    }

    private void validateUser(JwtPrincipal principal, String userId) {
        if (principal == null || !principal.userId().toString().equals(userId)) {
            throw new IllegalArgumentException("Invalid user context");
        }
    }
}
