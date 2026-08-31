package com.rupiksha.backend.service.history.providers;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.aeps.repository.AepsTransactionEngineRepository;
import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.api.dto.TransactionHistorySummaryDto;
import com.rupiksha.backend.domain.TransactionReportType;
import com.rupiksha.backend.repository.CommissionTransactionRepository;
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

    private final AepsTransactionEngineRepository transactionRepository;
    private final CommissionTransactionRepository commissionTransactionRepository;

    public FingpayHistoryProvider(WalletEntryRepository walletEntryRepository,
                                  AepsTransactionEngineRepository transactionRepository,
                                  CommissionTransactionRepository commissionTransactionRepository) {
        super(walletEntryRepository);
        this.transactionRepository = transactionRepository;
        this.commissionTransactionRepository = commissionTransactionRepository;
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

        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        String cleanStatus = (status != null && !status.trim().isEmpty()) ? status.trim() : null;
        String cleanProvider = (provider != null && !provider.trim().isEmpty()) ? provider.trim() : null;

        Pageable translated = translatePageable(pageable);
        Page<AepsTransactionEngine> txns = transactionRepository.findWithFilters(
                userId, null, cleanStatus, cleanProvider, fromDate, toDate, cleanSearch, translated);

        return txns.map(this::mapToDto);
    }

    @Override
    public List<TransactionHistoryResponseDto> fetchAllHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Sort sort) {

        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        String cleanStatus = (status != null && !status.trim().isEmpty()) ? status.trim() : null;
        String cleanProvider = (provider != null && !provider.trim().isEmpty()) ? provider.trim() : null;

        Sort translated = translateSort(sort);
        List<AepsTransactionEngine> txns = transactionRepository.findAllWithFilters(
                userId, null, cleanStatus, cleanProvider, fromDate, toDate, cleanSearch, translated);

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
                userId, null, status, provider, fromDate, toDate, search, Sort.unsorted());

        long total = all.size();
        long success = all.stream().filter(t -> "SUCCESS".equalsIgnoreCase(t.getStatus()) || "APPROVED".equalsIgnoreCase(t.getStatus())).count();
        long failed = all.stream().filter(t -> "FAILED".equalsIgnoreCase(t.getStatus()) || "FAILURE".equalsIgnoreCase(t.getStatus()) || "DECLINED".equalsIgnoreCase(t.getStatus())).count();
        long pending = total - success - failed;

        BigDecimal totalVolume = all.stream()
                .filter(t -> "SUCCESS".equalsIgnoreCase(t.getStatus()) || "APPROVED".equalsIgnoreCase(t.getStatus()))
                .map(t -> t.getAmount() != null ? t.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal cashWithdrawalVolume = all.stream()
                .filter(t -> "CASH_WITHDRAWAL".equalsIgnoreCase(t.getServiceType()) &&
                        ("SUCCESS".equalsIgnoreCase(t.getStatus()) || "APPROVED".equalsIgnoreCase(t.getStatus())))
                .map(t -> t.getAmount() != null ? t.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal cashDepositVolume = all.stream()
                .filter(t -> "CASH_DEPOSIT".equalsIgnoreCase(t.getServiceType()) &&
                        ("SUCCESS".equalsIgnoreCase(t.getStatus()) || "APPROVED".equalsIgnoreCase(t.getStatus())))
                .map(t -> t.getAmount() != null ? t.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal commission = commissionTransactionRepository.sumCommissionByBeneficiaryIdAndServiceType(userId, "AEPS_1");
        if (commission == null || commission.compareTo(BigDecimal.ZERO) == 0) {
            commission = all.stream()
                    .map(t -> getBalancesAndCommission(t.getTransactionId()).commission)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        return TransactionHistorySummaryDto.builder()
                .totalTransactions(total)
                .successCount(success)
                .failedCount(failed)
                .pendingCount(pending)
                .totalVolume(totalVolume)
                .cashWithdrawalVolume(cashWithdrawalVolume)
                .cashDepositVolume(cashDepositVolume)
                .commissionEarned(commission != null ? commission : BigDecimal.ZERO)
                .build();
    }

    private TransactionHistoryResponseDto mapToDto(AepsTransactionEngine txn) {
        WalletBalances balances = getBalancesAndCommission(txn.getTransactionId());
        return TransactionHistoryResponseDto.builder()
                .transactionId(txn.getTransactionId())
                .providerReference(txn.getProviderReference())
                .providerTransactionId(txn.getProviderReference())
                .bankReference(txn.getReferenceNumber())
                .retailerId(String.valueOf(txn.getUserId()))
                .serviceType(txn.getServiceType())
                .provider(txn.getProvider() != null ? txn.getProvider() : "FINGPAY")
                .amount(txn.getAmount() != null ? txn.getAmount() : BigDecimal.ZERO)
                .commission(balances.commission)
                .openingBalance(balances.openingBalance)
                .closingBalance(balances.closingBalance)
                .status(txn.getStatus())
                .remarks(txn.getProviderMessage() != null ? txn.getProviderMessage() : txn.getServiceType())
                .createdAt(txn.getInitiatedAt())
                .updatedAt(txn.getCompletedAt() != null ? txn.getCompletedAt() : txn.getInitiatedAt())
                .build();
    }
}
