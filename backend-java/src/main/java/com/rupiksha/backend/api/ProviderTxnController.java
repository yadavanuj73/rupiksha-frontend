package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.ProviderTxnDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.Recharge;
import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.domain.TransactionStatus;
import com.rupiksha.backend.integration.recharge.VenusRechargeProvider;
import com.rupiksha.backend.repository.RechargeRepository;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.RechargeTransferService;
import com.rupiksha.backend.service.WalletService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ProviderTxnController {
    private final RechargeTransferService rechargeTransferService;
    private final AppProperties appProperties;
    private final RechargeRepository rechargeRepository;
    private final TxnRepository txnRepository;
    private final WalletService walletService;
    private final VenusRechargeProvider venusRechargeProvider;

    @GetMapping("/recharge/operators")
    public java.util.List<com.rupiksha.backend.config.AppProperties.VenusOperator> getOperators() {
        if (appProperties.venusRecharge() == null) {
            return java.util.Collections.emptyList();
        }
        return appProperties.venusRecharge().operators();
    }

    @GetMapping("/recharge/my-ip")
    public java.util.Map<String, String> getMyIp() {
        try {
            org.springframework.web.client.RestTemplate rt = new org.springframework.web.client.RestTemplate();
            String ip = rt.getForObject("https://api.ipify.org", String.class);
            return java.util.Map.of("outboundIp", ip != null ? ip.trim() : "unknown");
        } catch (Exception e) {
            return java.util.Map.of("error", e.getMessage());
        }
    }

    @PostMapping("/recharge")
    public ProviderTxnDtos.TxnResponse recharge(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody ProviderTxnDtos.RechargeRequest request
    ) {
        if (principal == null || !principal.userId().equals(request.userId())) {
            throw new IllegalArgumentException("Invalid user context");
        }
        if (!appProperties.services().rechargeEnabled()) {
            return new ProviderTxnDtos.TxnResponse(false, null, "Recharge disabled by configuration", java.util.Map.of());
        }
        return rechargeTransferService.recharge(request);
    }

    @PostMapping("/transfer")
    public ProviderTxnDtos.TxnResponse transfer(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody ProviderTxnDtos.TransferRequest request
    ) {
        if (principal == null || !principal.userId().equals(request.userId())) {
            throw new IllegalArgumentException("Invalid user context");
        }
        if (!appProperties.services().payoutEnabled()) {
            return new ProviderTxnDtos.TxnResponse(false, null, "Payout disabled by configuration", java.util.Map.of());
        }
        return rechargeTransferService.transfer(request);
    }

    /**
     * GET Callback from VenusRecharge to reconcile pending transactions
     */
    @GetMapping("/recharge/callback")
    public String rechargeCallback(
            @RequestParam("ResponseStatus") String responseStatus,
            @RequestParam("OperatorTxnID") String operatorTxnId,
            @RequestParam("OrderNo") String orderNo,
            @RequestParam("MerTxnID") String merTxnId,
            @RequestParam("AccountNo") String accountNo
    ) {
        log.info("Received VenusRecharge callback for MerTxnID: {}, Status: {}, OperatorTxnID: {}, OrderNo: {}",
                merTxnId, responseStatus, operatorTxnId, orderNo);

        Optional<Recharge> rechargeOpt = rechargeRepository.findByMerchantRefNo(merTxnId);
        if (rechargeOpt.isEmpty()) {
            log.warn("Recharge record not found for MerTxnID: {}", merTxnId);
            return "FAILED: Record not found";
        }

        Recharge recharge = rechargeOpt.get();

        // Idempotency: If transaction is already resolved, return success immediately
        if (recharge.getStatus() != TransactionStatus.INITIATED && recharge.getStatus() != TransactionStatus.PENDING) {
            log.info("Recharge Ref: {} was already resolved with status: {}", merTxnId, recharge.getStatus());
            return "SUCCESS";
        }

        Optional<Txn> txnOpt = txnRepository.findByIdempotencyKey(merTxnId);
        Txn txn = txnOpt.orElse(null);

        if ("SUCCESS".equalsIgnoreCase(responseStatus)) {
            recharge.setStatus(TransactionStatus.SUCCESS);
            recharge.setOperatorTxnId(operatorTxnId);
            recharge.setOrderNo(orderNo);
            recharge.setCompletedAt(Instant.now());
            rechargeRepository.save(recharge);

            if (txn != null) {
                txn.setStatus(TransactionStatus.SUCCESS);
                txn.setProviderRef(operatorTxnId);
                txnRepository.save(txn);
            }
            log.info("VenusRecharge callback marked Ref: {} as SUCCESS", merTxnId);
        } else if ("FAILED".equalsIgnoreCase(responseStatus)) {
            recharge.setStatus(TransactionStatus.FAILED);
            recharge.setCompletedAt(Instant.now());
            rechargeRepository.save(recharge);

            if (txn != null) {
                txn.setStatus(TransactionStatus.FAILED);
                txn.setProviderRef(operatorTxnId);
                txnRepository.save(txn);

                // Safe idempotent refund
                try {
                    walletService.refundForService(
                            recharge.getUser().getId(),
                            recharge.getAmount(),
                            "Recharge failed refund (callback)",
                            txn.getId().toString(),
                            com.rupiksha.backend.domain.WalletTransactionContext.REVERSAL,
                            "RECHARGE",
                            "127.0.0.1",
                            txn.getId().toString() + "-refund"
                    );
                    log.info("Refund processed for failed recharge callback Ref: {}", merTxnId);
                } catch (Exception e) {
                    log.error("Failed to refund wallet for failed recharge callback. Ref: {}", merTxnId, e);
                }
            }
        }

        return "SUCCESS";
    }

    /**
     * Manual reconciliation or status check for a pending transaction
     */
    @PostMapping("/recharge/status/{merchantRefNo}")
    public Map<String, Object> reconcileStatus(
            @AuthenticationPrincipal JwtPrincipal principal,
            @PathVariable String merchantRefNo
    ) {
        if (principal == null) {
            throw new IllegalArgumentException("Unauthorized");
        }

        Optional<Recharge> rechargeOpt = rechargeRepository.findByMerchantRefNo(merchantRefNo);
        if (rechargeOpt.isEmpty()) {
            return Map.of("success", false, "message", "Transaction not found");
        }

        Recharge recharge = rechargeOpt.get();

        // Only allow the owner of the recharge or admin to reconcile
        if (!recharge.getUser().getId().toString().equals(principal.userId()) && !principal.roles().contains("ADMIN")) {
            return Map.of("success", false, "message", "Forbidden");
        }

        // Idempotency: If already resolved, return the status immediately without calling provider
        if (recharge.getStatus() != TransactionStatus.INITIATED && recharge.getStatus() != TransactionStatus.PENDING) {
            return Map.of(
                    "success", true,
                    "merchantRefNo", merchantRefNo,
                    "status", recharge.getStatus().name(),
                    "operatorTxnId", recharge.getOperatorTxnId() != null ? recharge.getOperatorTxnId() : "N/A",
                    "orderNo", recharge.getOrderNo() != null ? recharge.getOrderNo() : "N/A"
            );
        }

        // Query status from Venus provider
        var providerRes = venusRechargeProvider.getStatus(merchantRefNo);
        String responseStatus = String.valueOf(providerRes.raw().getOrDefault("status", "PENDING"));

        Optional<Txn> txnOpt = txnRepository.findByIdempotencyKey(merchantRefNo);
        Txn txn = txnOpt.orElse(null);

        if ("SUCCESS".equalsIgnoreCase(responseStatus)) {
            recharge.setStatus(TransactionStatus.SUCCESS);
            recharge.setOperatorTxnId(providerRes.providerTxnId());
            recharge.setOrderNo(String.valueOf(providerRes.raw().getOrDefault("orderNo", providerRes.providerTxnId())));
            recharge.setCompletedAt(Instant.now());
            rechargeRepository.save(recharge);

            if (txn != null) {
                txn.setStatus(TransactionStatus.SUCCESS);
                txn.setProviderRef(providerRes.providerTxnId());
                txnRepository.save(txn);
            }
        } else if ("FAILED".equalsIgnoreCase(responseStatus)) {
            recharge.setStatus(TransactionStatus.FAILED);
            recharge.setCompletedAt(Instant.now());
            rechargeRepository.save(recharge);

            if (txn != null) {
                txn.setStatus(TransactionStatus.FAILED);
                txn.setProviderRef(providerRes.providerTxnId());
                txnRepository.save(txn);

                // Safe idempotent refund
                try {
                    walletService.refundForService(
                            recharge.getUser().getId(),
                            recharge.getAmount(),
                            "Recharge failed refund (reconcile)",
                            txn.getId().toString(),
                            com.rupiksha.backend.domain.WalletTransactionContext.REVERSAL,
                            "RECHARGE",
                            "127.0.0.1",
                            txn.getId().toString() + "-refund"
                    );
                } catch (Exception e) {
                    log.error("Failed to refund wallet for failed recharge reconciliation. Ref: {}", merchantRefNo, e);
                }
            }
        }

        return Map.of(
                "success", true,
                "merchantRefNo", merchantRefNo,
                "status", recharge.getStatus().name(),
                "operatorTxnId", recharge.getOperatorTxnId() != null ? recharge.getOperatorTxnId() : "N/A",
                "orderNo", recharge.getOrderNo() != null ? recharge.getOrderNo() : "N/A",
                "message", providerRes.message()
        );
    }

    /**
     * Get VenusRecharge Account Balance (Admin Only)
     */
    @GetMapping("/recharge/provider-balance")
    public Map<String, Object> getProviderBalance(
            @AuthenticationPrincipal JwtPrincipal principal
    ) {
        if (principal == null || !principal.roles().contains("ADMIN")) {
            return Map.of("success", false, "message", "Forbidden");
        }
        return venusRechargeProvider.getProviderBalance();
    }
}

