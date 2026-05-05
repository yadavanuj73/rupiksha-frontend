package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.WalletDtos;

public interface WalletService {
    WalletDtos.WalletBalanceResponse getBalance(String userId);
    WalletDtos.WalletBalanceResponse credit(WalletDtos.WalletEntryRequest request);
    WalletDtos.WalletBalanceResponse debit(WalletDtos.WalletEntryRequest request);
}

