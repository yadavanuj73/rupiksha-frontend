package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.ProviderTxnDtos;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.domain.TransactionStatus;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.Recharge;
import com.rupiksha.backend.integration.recharge.RechargeTransferProvider;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.RechargeRepository;
import com.rupiksha.backend.repository.UserServiceRepository;
import com.rupiksha.backend.service.RechargeTransferService;
import com.rupiksha.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RechargeTransferServiceImpl implements RechargeTransferService {
    private final RechargeProviderRouter providerRouter;
    private final TxnRepository txnRepository;
    private final RechargeRepository rechargeRepository;
    private final UserServiceRepository userServiceRepository;
    private final WalletService walletService;
    private final KycAccessGuard kycAccessGuard;

    @Override
    @Transactional
    public ProviderTxnDtos.TxnResponse recharge(ProviderTxnDtos.RechargeRequest request) {
        // 1. Enforce user-specific service permissions in user_services
        var serviceType = com.rupiksha.backend.domain.ServiceType.RECHARGE;
        boolean isEnabled = userServiceRepository.findByUserIdAndServiceType(UUID.fromString(request.userId()), serviceType)
                .map(com.rupiksha.backend.domain.UserService::getIsEnabled)
                .orElse(true); // Default to enabled unless explicitly disabled

        if (!isEnabled) {
            log.warn("Recharge service disabled for user: {}", request.userId());
            return new ProviderTxnDtos.TxnResponse(
                    false,
                    null,
                    "Mobile Recharge service is disabled by administrator",
                    "SERVICE_DISABLED",
                    null,
                    request.mobile(),
                    request.amount(),
                    null,
                    null,
                    null,
                    null,
                    null,
                    Map.of()
            );
        }

        // 2. Read authoritative wallet balance and check for sufficient funds
        WalletDtos.WalletBalanceResponse balanceResponse = walletService.getBalance(request.userId());
        BigDecimal available = balanceResponse.availableBalance() != null ? balanceResponse.availableBalance() : BigDecimal.ZERO;
        if (available.compareTo(request.amount()) < 0) {
            log.warn("Insufficient wallet balance for user: {}. Available: {}, Requested: {}",
                    request.userId(), available, request.amount());
            return new ProviderTxnDtos.TxnResponse(
                    false,
                    null,
                    "Insufficient wallet balance",
                    "INSUFFICIENT_BALANCE",
                    null,
                    request.mobile(),
                    request.amount(),
                    null,
                    null,
                    null,
                    null,
                    null,
                    Map.of()
            );
        }

        // 3. Generate unique 14-character merchantRefNo with database constraints protection
        String merchantRefNo = null;
        for (int attempt = 0; attempt < 5; attempt++) {
            String candidate = generateRefNo();
            if (rechargeRepository.findByMerchantRefNo(candidate).isEmpty()) {
                merchantRefNo = candidate;
                break;
            }
        }
        if (merchantRefNo == null) {
            throw new IllegalStateException("Failed to generate a unique 14-character merchant reference number");
        }

        User user = kycAccessGuard.requireServiceEnabledUser(UUID.fromString(request.userId()));

        // 4. Create and persist transaction & recharge records in INITIATED state
        Txn txn = new Txn();
        txn.setUser(user);
        txn.setAmount(request.amount());
        txn.setServiceType("RECHARGE");
        txn.setProviderRef(null);
        txn.setIdempotencyKey(merchantRefNo); // We use merchantRefNo as the unique transaction idempotency key
        txn.setStatus(TransactionStatus.INITIATED);
        txn = txnRepository.save(txn);

        Recharge recharge = new Recharge();
        recharge.setUser(user);
        recharge.setMerchantRefNo(merchantRefNo);
        recharge.setMobileNo(request.mobile());
        recharge.setOperatorCode(request.operator());
        recharge.setAmount(request.amount());
        recharge.setStatus(TransactionStatus.INITIATED);
        recharge = rechargeRepository.save(recharge);

        // 5. Debit the wallet using the safe ledger-based service debit mechanism
        BigDecimal openingBalance = BigDecimal.ZERO;
        BigDecimal closingBalance = BigDecimal.ZERO;
        try {
            WalletDtos.WalletBalanceResponse debitRes = walletService.debitForService(
                    user.getId(),
                    request.amount(),
                    "Recharge to " + request.mobile(),
                    com.rupiksha.backend.domain.WalletTransactionContext.RECHARGE,
                    "RECHARGE",
                    "127.0.0.1",
                    txn.getId().toString() // Use the transaction UUID as the wallet entry idempotency key
            );
            openingBalance = debitRes.balance().add(request.amount());
            closingBalance = debitRes.balance();

            recharge.setOpeningBalance(openingBalance);
            recharge.setClosingBalance(closingBalance);
            rechargeRepository.save(recharge);
        } catch (Exception e) {
            log.error("Failed to debit wallet for recharge. Ref: {}", txn.getId(), e);
            txn.setStatus(TransactionStatus.FAILED);
            txnRepository.save(txn);

            recharge.setStatus(TransactionStatus.FAILED);
            recharge.setDescription("Wallet debit failed: " + e.getMessage());
            rechargeRepository.save(recharge);

            return new ProviderTxnDtos.TxnResponse(
                    false,
                    null,
                    "Wallet debit failed: " + e.getMessage(),
                    "FAILED",
                    merchantRefNo,
                    request.mobile(),
                    request.amount(),
                    null,
                    null,
                    null,
                    null,
                    null,
                    Map.of()
            );
        }

        // 6. Call the provider (VenusRecharge)
        RechargeTransferProvider.ProviderTxnResponse providerRes;
        String statusStr;
        try {
            RechargeTransferProvider provider = providerRouter.current();
            log.info("Calling provider strategy: {} for merchantRefNo: {}", provider.providerName(), merchantRefNo);

            providerRes = provider.recharge(
                    merchantRefNo,
                    request.mobile(),
                    request.operator(),
                    request.amount()
            );
            statusStr = providerRes.raw() != null ? String.valueOf(providerRes.raw().getOrDefault("status", "PENDING")) : "PENDING";
        } catch (Exception e) {
            log.error("Exception calling provider recharge for Ref: {}", txn.getId(), e);
            // Safe idempotent refund
            try {
                walletService.refundForService(
                        user.getId(),
                        request.amount(),
                        "Recharge provider error refund",
                        txn.getId().toString(),
                        com.rupiksha.backend.domain.WalletTransactionContext.REVERSAL,
                        "RECHARGE",
                        "127.0.0.1",
                        txn.getId().toString() + "-refund"
                );
            } catch (Exception re) {
                log.error("CRITICAL: Failed to execute wallet refund after provider error. Ref: {}", txn.getId(), re);
            }

            txn.setStatus(TransactionStatus.FAILED);
            txnRepository.save(txn);

            recharge.setStatus(TransactionStatus.FAILED);
            recharge.setDescription("Provider call failed: " + e.getMessage());
            rechargeRepository.save(recharge);

            return new ProviderTxnDtos.TxnResponse(
                    false,
                    txn.getId().toString(),
                    "Provider communication failed: " + e.getMessage(),
                    "FAILED",
                    merchantRefNo,
                    request.mobile(),
                    request.amount(),
                    null,
                    null,
                    openingBalance,
                    openingBalance, // Restored
                    openingBalance, // Restored
                    Map.of("status", "FAILED", "error", e.getMessage())
            );
        }

        // 7. Process provider results (SUCCESS / FAILED / PENDING)
        if (providerRes.success() || "SUCCESS".equalsIgnoreCase(statusStr)) {
            txn.setStatus(TransactionStatus.SUCCESS);
            txn.setProviderRef(providerRes.providerTxnId());
            txnRepository.save(txn);

            recharge.setStatus(TransactionStatus.SUCCESS);
            recharge.setOperatorTxnId(providerRes.providerTxnId());
            recharge.setOrderNo(String.valueOf(providerRes.raw().getOrDefault("orderNo", providerRes.providerTxnId())));
            recharge.setDescription(providerRes.message());
            recharge.setCompletedAt(Instant.now());
            rechargeRepository.save(recharge);

            return new ProviderTxnDtos.TxnResponse(
                    true,
                    txn.getId().toString(),
                    "Recharge successful",
                    "SUCCESS",
                    merchantRefNo,
                    request.mobile(),
                    request.amount(),
                    recharge.getOperatorTxnId(),
                    recharge.getOrderNo(),
                    openingBalance,
                    closingBalance,
                    closingBalance,
                    providerRes.raw()
            );
        } else if ("FAILED".equalsIgnoreCase(statusStr)) {
            txn.setStatus(TransactionStatus.FAILED);
            txn.setProviderRef(providerRes.providerTxnId());
            txnRepository.save(txn);

            recharge.setStatus(TransactionStatus.FAILED);
            recharge.setDescription(providerRes.message());
            rechargeRepository.save(recharge);

            // Safe idempotent refund
            try {
                walletService.refundForService(
                        user.getId(),
                        request.amount(),
                        "Recharge failed refund",
                        txn.getId().toString(),
                        com.rupiksha.backend.domain.WalletTransactionContext.REVERSAL,
                        "RECHARGE",
                        "127.0.0.1",
                        txn.getId().toString() + "-refund" // Unique, idempotent key
                );
            } catch (Exception e) {
                log.error("Failed to execute wallet refund for failed recharge. Ref: {}", txn.getId(), e);
            }

            return new ProviderTxnDtos.TxnResponse(
                    false,
                    txn.getId().toString(),
                    providerRes.message(),
                    "FAILED",
                    merchantRefNo,
                    request.mobile(),
                    request.amount(),
                    null,
                    null,
                    openingBalance,
                    openingBalance, // Restored
                    openingBalance, // Restored
                    providerRes.raw()
            );
        } else {
            // PENDING: Do not refund! Keep the amount safely debited
            txn.setStatus(TransactionStatus.PENDING);
            txnRepository.save(txn);

            recharge.setStatus(TransactionStatus.PENDING);
            recharge.setDescription(providerRes.message() != null ? providerRes.message() : "Recharge pending");
            rechargeRepository.save(recharge);

            return new ProviderTxnDtos.TxnResponse(
                    true,
                    txn.getId().toString(),
                    "Recharge is pending",
                    "PENDING",
                    merchantRefNo,
                    request.mobile(),
                    request.amount(),
                    null,
                    null,
                    openingBalance,
                    closingBalance,
                    closingBalance,
                    providerRes.raw()
            );
        }
    }

    private String generateRefNo() {
        long epochSec = Instant.now().getEpochSecond();
        int rand = (int)(Math.random() * 9000) + 1000;
        return String.valueOf(epochSec) + rand;
    }

    @Override
    @Transactional
    public ProviderTxnDtos.TxnResponse transfer(ProviderTxnDtos.TransferRequest request) {
        String key = (request.idempotencyKey() == null || request.idempotencyKey().isBlank())
                ? UUID.randomUUID().toString()
                : request.idempotencyKey();
        var existing = txnRepository.findByIdempotencyKey(key);
        if (existing.isPresent()) {
            Txn prior = existing.get();
            return new ProviderTxnDtos.TxnResponse(
                    prior.getStatus() == TransactionStatus.SUCCESS,
                    prior.getId().toString(),
                    "Idempotent replay",
                    java.util.Map.of("providerRef", prior.getProviderRef(), "status", prior.getStatus().name())
            );
        }
        User user = kycAccessGuard.requireServiceEnabledUser(UUID.fromString(request.userId()));
        walletService.debit(new WalletDtos.WalletEntryRequest(
                request.userId(),
                request.amount(),
                "Transfer initiated"
        ));

        RechargeTransferProvider.ProviderTxnResponse providerRes = providerRouter.current()
                .transfer(user.getId().toString(), request.beneficiaryName(), request.accountNumber(), request.ifsc(), request.amount());

        Txn txn = new Txn();
        txn.setUser(user);
        txn.setAmount(request.amount());
        txn.setServiceType("TRANSFER");
        txn.setProviderRef(providerRes.providerTxnId());
        txn.setIdempotencyKey(key);
        txn.setStatus(providerRes.success() ? TransactionStatus.SUCCESS : TransactionStatus.FAILED);
        txnRepository.save(txn);

        if (!providerRes.success()) {
            walletService.credit(new WalletDtos.WalletEntryRequest(
                    request.userId(),
                    request.amount(),
                    "Transfer failed refund"
            ));
        }

        return new ProviderTxnDtos.TxnResponse(
                providerRes.success(),
                providerRes.providerTxnId(),
                providerRes.message(),
                providerRes.raw()
        );
    }
}

