package com.rupiksha.backend.service.history.providers;

import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.api.dto.TransactionHistorySummaryDto;
import com.rupiksha.backend.domain.TransactionReportType;
import com.rupiksha.backend.repository.WalletEntryRepository;
import com.rupiksha.backend.service.history.BaseHistoryProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Component
public class PayoutHistoryProvider extends BaseHistoryProvider {

    private final PayoutTransactionRepository payoutRepository;

    public PayoutHistoryProvider(WalletEntryRepository walletEntryRepository,
                                 PayoutTransactionRepository payoutRepository) {
        super(walletEntryRepository);
        this.payoutRepository = payoutRepository;
    }

    @Override
    public boolean supports(TransactionReportType reportType) {
        return reportType == TransactionReportType.MOVE_TO_BANK || reportType == TransactionReportType.PAYOUT;
    }

    @Override
    public Page<TransactionHistoryResponseDto> fetchHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Pageable pageable) {

        Page<PayoutTransaction> txns = payoutRepository.findWithFilters(
                userId.toString(), status, fromDate, toDate, search, pageable);

        return txns.map(this::mapToDto);
    }

    @Override
    public List<TransactionHistoryResponseDto> fetchAllHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Sort sort) {

        List<PayoutTransaction> txns = payoutRepository.findAllWithFilters(
                userId.toString(), status, fromDate, toDate, search, sort);

        return txns.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Override
    public TransactionHistorySummaryDto fetchSummary(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate) {

        List<TransactionHistoryResponseDto> all = fetchAllHistory(reportType, userId, search, status, provider, fromDate, toDate, Sort.unsorted());

        long total = all.size();
        long success = all.stream().filter(t -> "SUCCESS".equalsIgnoreCase(t.getStatus()) || "SUCCESSFUL".equalsIgnoreCase(t.getStatus())).count();
        long failed = all.stream().filter(t -> "FAILED".equalsIgnoreCase(t.getStatus()) || "FAILURE".equalsIgnoreCase(t.getStatus())).count();
        long pending = total - success - failed;

        BigDecimal totalVolume = all.stream()
                .map(TransactionHistoryResponseDto::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal commission = all.stream()
                .map(TransactionHistoryResponseDto::getCommission)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return TransactionHistorySummaryDto.builder()
                .totalTransactions(total)
                .successCount(success)
                .failedCount(failed)
                .pendingCount(pending)
                .totalVolume(totalVolume)
                .commissionEarned(commission)
                .build();
    }

    private TransactionHistoryResponseDto mapToDto(PayoutTransaction txn) {
        WalletBalances balances = getBalancesAndCommission(txn.getOrderId());
        return TransactionHistoryResponseDto.builder()
                .transactionId(txn.getOrderId())
                .providerReference(txn.getOrderId())
                .providerTransactionId(txn.getUtr())
                .bankReference(txn.getUtr())
                .retailerId(txn.getUserId())
                .serviceType("PAYOUT")
                .provider("PAYOUT_HUB")
                .amount(txn.getAmount())
                .commission(balances.commission)
                .openingBalance(balances.openingBalance)
                .closingBalance(balances.closingBalance)
                .status(txn.getStatus())
                .remarks(txn.getRemarks() != null ? txn.getRemarks() : "Payout to " + txn.getBeneficiaryName() + " (" + txn.getAccountNumber() + ")")
                .createdAt(txn.getCreatedAt())
                .updatedAt(txn.getUpdatedAt() != null ? txn.getUpdatedAt() : txn.getCreatedAt())
                .build();
    }
}
