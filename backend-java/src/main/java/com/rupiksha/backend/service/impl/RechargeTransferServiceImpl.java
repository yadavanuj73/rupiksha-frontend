package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.ProviderTxnDtos;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.domain.TransactionStatus;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.integration.recharge.RechargeTransferProvider;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.service.RechargeTransferService;
import com.rupiksha.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RechargeTransferServiceImpl implements RechargeTransferService {
    private final RechargeProviderRouter providerRouter;
    private final TxnRepository txnRepository;
    private final WalletService walletService;
    private final KycAccessGuard kycAccessGuard;

    @Override
    @Transactional
    public ProviderTxnDtos.TxnResponse recharge(ProviderTxnDtos.RechargeRequest request) {
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
                "Recharge initiated"
        ));

        RechargeTransferProvider.ProviderTxnResponse providerRes = providerRouter.current()
                .recharge(user.getId().toString(), request.mobile(), request.operator(), request.amount());

        Txn txn = new Txn();
        txn.setUser(user);
        txn.setAmount(request.amount());
        txn.setServiceType("RECHARGE");
        txn.setProviderRef(providerRes.providerTxnId());
        txn.setIdempotencyKey(key);
        txn.setStatus(providerRes.success() ? TransactionStatus.SUCCESS : TransactionStatus.FAILED);
        txnRepository.save(txn);

        if (!providerRes.success()) {
            walletService.credit(new WalletDtos.WalletEntryRequest(
                    request.userId(),
                    request.amount(),
                    "Recharge failed refund"
            ));
        }

        return new ProviderTxnDtos.TxnResponse(
                providerRes.success(),
                providerRes.providerTxnId(),
                providerRes.message(),
                providerRes.raw()
        );
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

