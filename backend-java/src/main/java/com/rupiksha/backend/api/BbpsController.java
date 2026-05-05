package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.RetailerServiceDtos;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.domain.TransactionStatus;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.WalletService;
import com.rupiksha.backend.service.impl.BbpsProviderRouter;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bbps")
@RequiredArgsConstructor
public class BbpsController {
    private final UserRepository userRepository;
    private final TxnRepository txnRepository;
    private final WalletService walletService;
    private final BbpsProviderRouter providerRouter;
    private final AppProperties appProperties;

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

    @GetMapping("/status/{txnId}")
    public Map<String, Object> status(@AuthenticationPrincipal JwtPrincipal principal, @PathVariable String txnId) {
        if (principal == null) {
            throw new IllegalArgumentException("Unauthorized");
        }
        Txn txn = txnRepository.findById(UUID.fromString(txnId))
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));
        if (!txn.getUser().getId().toString().equalsIgnoreCase(principal.userId())) {
            throw new IllegalArgumentException("Forbidden");
        }
        return Map.of("success", true, "txnId", txn.getId().toString(), "status", txn.getStatus().name());
    }

    private void validateUser(JwtPrincipal principal, String userId) {
        if (principal == null || !principal.userId().toString().equals(userId)) {
            throw new IllegalArgumentException("Invalid user context");
        }
    }
}
