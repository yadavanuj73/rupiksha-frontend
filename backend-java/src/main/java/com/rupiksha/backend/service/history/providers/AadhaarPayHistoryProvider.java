package com.rupiksha.backend.service.history.providers;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.aeps.repository.AepsTransactionEngineRepository;
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
public class AadhaarPayHistoryProvider extends BaseHistoryProvider {

    private final AepsTransactionEngineRepository transactionRepository;

    public AadhaarPayHistoryProvider(WalletEntryRepository walletEntryRepository,
                                     AepsTransactionEngineRepository transactionRepository) {
        super(walletEntryRepository);
        this.transactionRepository = transactionRepository;
    }

    @Override
    public boolean supports(TransactionReportType reportType) {
        return reportType == TransactionReportType.AADHAAR_PAY;
    }

    @Override
    public Page<TransactionHistoryResponseDto> fetchHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Pageable pageable) {

        Pageable translated = translatePageable(pageable);
        Page<AepsTransactionEngine> txns = transactionRepository.findWithFilters(
                userId, "AADHAAR_PAY", status, provider, fromDate, toDate, search, translated);

        return txns.map(this::mapToDto);
    }

    @Override
    public List<TransactionHistoryResponseDto> fetchAllHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Sort sort) {

        Sort translated = translateSort(sort);
        List<AepsTransactionEngine> txns = transactionRepository.findAllWithFilters(
                userId, "AADHAAR_PAY", status, provider, fromDate, toDate, search, translated);

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
        if (sort == null || sort.isUnsorted()) return Sort.by(Sort.Direction.DESC, "initiatedAt");
        List<Sort.Order> orders = sort.stream()
                .map(order -> {
                    if ("createdAt".equalsIgnoreCase(order.getProperty()) || "date".equalsIgnoreCase(order.getProperty())) {
                        return new Sort.Order(order.getDirection(), "initiatedAt");
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

        List<AepsTransactionEngine> all = transactionRepository.findAllWithFilters(
                userId, "AADHAAR_PAY", status, provider, fromDate, toDate, search, Sort.unsorted());

        long total = all.size();
        long success = all.stream().filter(t -> "SUCCESS".equalsIgnoreCase(t.getStatus()) || "APPROVED".equalsIgnoreCase(t.getStatus())).count();
        long failed = all.stream().filter(t -> "FAILED".equalsIgnoreCase(t.getStatus()) || "FAILURE".equalsIgnoreCase(t.getStatus()) || "DECLINED".equalsIgnoreCase(t.getStatus())).count();
        long pending = total - success - failed;

        BigDecimal totalVolume = all.stream()
                .map(t -> t.getAmount() != null ? t.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal commission = all.stream()
                .map(t -> getBalancesAndCommission(t.getTransactionId()).commission)
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

    private TransactionHistoryResponseDto mapToDto(AepsTransactionEngine txn) {
        WalletBalances balances = getBalancesAndCommission(txn.getTransactionId());
        return TransactionHistoryResponseDto.builder()
                .transactionId(txn.getTransactionId())
                .providerReference(txn.getReferenceNumber())
                .providerTransactionId(txn.getCorrelationId())
                .bankReference(txn.getProviderReference())
                .retailerId(txn.getUserId().toString())
                .serviceType(txn.getServiceType())
                .provider(txn.getProvider() != null ? txn.getProvider().toUpperCase() : "AEPS")
                .amount(txn.getAmount())
                .commission(balances.commission)
                .openingBalance(balances.openingBalance)
                .closingBalance(balances.closingBalance)
                .status(txn.getStatus())
                .remarks(txn.getProviderMessage() != null ? txn.getProviderMessage() : "Aadhaar Pay transaction")
                .createdAt(txn.getInitiatedAt())
                .updatedAt(txn.getCompletedAt() != null ? txn.getCompletedAt() : txn.getLastUpdated())
                .build();
    }
}
