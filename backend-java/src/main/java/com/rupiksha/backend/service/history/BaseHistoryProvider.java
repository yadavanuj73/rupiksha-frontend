package com.rupiksha.backend.service.history;

import com.rupiksha.backend.domain.WalletEntry;
import com.rupiksha.backend.repository.WalletEntryRepository;
import java.math.BigDecimal;
import java.util.Optional;

public abstract class BaseHistoryProvider implements TransactionHistoryProvider {
    protected final WalletEntryRepository walletEntryRepository;

    protected BaseHistoryProvider(WalletEntryRepository walletEntryRepository) {
        this.walletEntryRepository = walletEntryRepository;
    }

    protected WalletBalances getBalancesAndCommission(String transactionId) {
        if (transactionId == null || transactionId.isBlank()) {
            return new WalletBalances(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }
        Optional<WalletEntry> entryOpt = walletEntryRepository.findByIdempotencyKey(transactionId);
        if (entryOpt.isPresent()) {
            WalletEntry entry = entryOpt.get();
            // Commission can be modeled as (tds + gst) or platform charges or custom commission logic. Let's return platform charges / commission.
            // If the transaction has platformCharges or commission context, we can look it up.
            BigDecimal tdsGst = BigDecimal.ZERO;
            if (entry.getTds() != null) tdsGst = tdsGst.add(entry.getTds());
            if (entry.getGst() != null) tdsGst = tdsGst.add(entry.getGst());
            
            return new WalletBalances(
                entry.getOpeningBalance() != null ? entry.getOpeningBalance() : BigDecimal.ZERO,
                entry.getClosingBalance() != null ? entry.getClosingBalance() : BigDecimal.ZERO,
                tdsGst
            );
        }
        return new WalletBalances(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }

    public static class WalletBalances {
        public final BigDecimal openingBalance;
        public final BigDecimal closingBalance;
        public final BigDecimal commission;

        public WalletBalances(BigDecimal openingBalance, BigDecimal closingBalance, BigDecimal commission) {
            this.openingBalance = openingBalance;
            this.closingBalance = closingBalance;
            this.commission = commission;
        }
    }
}
