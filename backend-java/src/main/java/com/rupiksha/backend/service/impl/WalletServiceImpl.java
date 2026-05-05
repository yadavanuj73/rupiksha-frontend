package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.Wallet;
import com.rupiksha.backend.domain.WalletEntry;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.WalletEntryRepository;
import com.rupiksha.backend.repository.WalletRepository;
import com.rupiksha.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WalletServiceImpl implements WalletService {
    private final WalletRepository walletRepository;
    private final WalletEntryRepository walletEntryRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public WalletDtos.WalletBalanceResponse getBalance(String userId) {
        Wallet wallet = getOrCreateWallet(UUID.fromString(userId));
        return new WalletDtos.WalletBalanceResponse(userId, wallet.getBalance());
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse credit(WalletDtos.WalletEntryRequest request) {
        Wallet wallet = getOrCreateWallet(UUID.fromString(request.userId()));
        wallet.setBalance(wallet.getBalance().add(request.amount()));
        walletRepository.save(wallet);
        saveEntry(wallet, request.amount(), "CREDIT", request.narration());
        return new WalletDtos.WalletBalanceResponse(request.userId(), wallet.getBalance());
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse debit(WalletDtos.WalletEntryRequest request) {
        Wallet wallet = getOrCreateWallet(UUID.fromString(request.userId()));
        BigDecimal next = wallet.getBalance().subtract(request.amount());
        if (next.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Insufficient wallet balance");
        }
        wallet.setBalance(next);
        walletRepository.save(wallet);
        saveEntry(wallet, request.amount(), "DEBIT", request.narration());
        return new WalletDtos.WalletBalanceResponse(request.userId(), wallet.getBalance());
    }

    private Wallet getOrCreateWallet(UUID userId) {
        return walletRepository.findByUserId(userId).orElseGet(() -> {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found"));
            Wallet wallet = new Wallet();
            wallet.setUser(user);
            wallet.setBalance(BigDecimal.ZERO);
            return walletRepository.save(wallet);
        });
    }

    private void saveEntry(Wallet wallet, BigDecimal amount, String type, String narration) {
        WalletEntry entry = new WalletEntry();
        entry.setWallet(wallet);
        entry.setAmount(amount);
        entry.setEntryType(type);
        entry.setNarration(narration);
        entry.setReferenceId(java.util.UUID.randomUUID().toString());
        walletEntryRepository.save(entry);
    }
}

