package com.rupiksha.backend.service.history.providers;

import com.rupiksha.aeps.provider.fingpay.entity.FingpayTransaction;
import com.rupiksha.aeps.provider.fingpay.repository.FingpayTransactionRepository;
import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.api.dto.TransactionHistorySummaryDto;
import com.rupiksha.backend.domain.TransactionReportType;
import com.rupiksha.backend.repository.WalletEntryRepository;
import com.rupiksha.backend.service.history.BaseHistoryProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
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
public class FingpayHistoryProvider extends BaseHistoryProvider {

    private final FingpayTransactionRepository fingpayRepository;

    public FingpayHistoryProvider(WalletEntryRepository walletEntryRepository,
                                  FingpayTransactionRepository fingpayRepository) {
        super(walletEntryRepository);
        this.fingpayRepository = fingpayRepository;
    }

    @Override
    public boolean supports(TransactionReportType reportType) {
        return reportType == TransactionReportType.AEPS_FINGPAY;
    }

    @Override
    public Page<TransactionHistoryResponseDto> fetchHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Pageable pageable) {
        
        long uidLong = userId.getMostSignificantBits() & Long.MAX_VALUE;
        Pageable translated = translatePageable(pageable);
        Page<FingpayTransaction> txns = fingpayRepository.findWithFilters(
                uidLong, status, fromDate, toDate, search, translated);
        
        return txns.map(this::mapToDto);
    }

    @Override
    public List<TransactionHistoryResponseDto> fetchAllHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Sort sort) {
        
        long uidLong = userId.getMostSignificantBits() & Long.MAX_VALUE;
        Sort translated = translateSort(sort);
        List<FingpayTransaction> txns = fingpayRepository.findAllWithFilters(
                uidLong, status, fromDate, toDate, search, translated);
        
        return txns.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    private Pageable translatePageable(Pageable pageable) {
        if (pageable.getSort().isSorted()) {
            Sort translated = translateSort(pageable.getSort());
            return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), translated);
        }
        return pageable;
    }

    private Sort translateSort(Sort sort) {
        if (sort == null || sort.isUnsorted()) return Sort.by(Sort.Direction.DESC, "createdAt");
        List<Sort.Order> orders = sort.stream()
                .map(order -> {
                    if ("amount".equalsIgnoreCase(order.getProperty())) {
                        return new Sort.Order(order.getDirection(), "txnamount");
                    }
                    return order;
                })
                .collect(Collectors.toList());
        return Sort.by(orders);
    }

    @Override
    public TransactionHistorySummaryDto fetchSummary(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate) {
        
        long uidLong = userId.getMostSignificantBits() & Long.MAX_VALUE;
        List<FingpayTransaction> all = fingpayRepository.findAllWithFilters(
                uidLong, status, fromDate, toDate, search, Sort.unsorted());

        long total = all.size();
        long success = all.stream().filter(t -> "SUCCESS".equalsIgnoreCase(t.getStatus()) || "APPROVED".equalsIgnoreCase(t.getStatus())).count();
        long failed = all.stream().filter(t -> "FAILED".equalsIgnoreCase(t.getStatus()) || "FAILURE".equalsIgnoreCase(t.getStatus()) || "DECLINED".equalsIgnoreCase(t.getStatus())).count();
        long pending = total - success - failed;

        BigDecimal totalVolume = all.stream()
                .map(t -> BigDecimal.valueOf(t.getTxnamount() != null ? t.getTxnamount() : 0.0))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal commission = all.stream()
                .map(t -> getBalancesAndCommission(t.getTxnid()).commission)
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

    private TransactionHistoryResponseDto mapToDto(FingpayTransaction txn) {
        WalletBalances balances = getBalancesAndCommission(txn.getTxnid());
        return TransactionHistoryResponseDto.builder()
                .transactionId(txn.getTxnid())
                .providerReference(txn.getFtxnin())
                .providerTransactionId(txn.getFtxnin())
                .bankReference(txn.getRrn())
                .retailerId(String.valueOf(txn.getUid()))
                .serviceType(txn.getType())
                .provider("FINGPAY")
                .amount(BigDecimal.valueOf(txn.getTxnamount() != null ? txn.getTxnamount() : 0.0))
                .commission(balances.commission)
                .openingBalance(balances.openingBalance)
                .closingBalance(balances.closingBalance)
                .status(txn.getStatus())
                .remarks(txn.getMessage())
                .createdAt(txn.getCreatedAt())
                .updatedAt(txn.getCreatedAt())
                .build();
    }
}
