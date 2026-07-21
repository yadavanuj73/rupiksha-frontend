package com.rupiksha.backend.service.history.providers;

import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.api.dto.TransactionHistorySummaryDto;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.WalletEntryRepository;
import com.rupiksha.backend.repository.WalletRepository;
import com.rupiksha.backend.service.history.BaseHistoryProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Component
public class WalletHistoryProvider extends BaseHistoryProvider {

    private final WalletRepository walletRepository;

    public WalletHistoryProvider(WalletEntryRepository walletEntryRepository,
                                 WalletRepository walletRepository) {
        super(walletEntryRepository);
        this.walletRepository = walletRepository;
    }

    @Override
    public boolean supports(TransactionReportType reportType) {
        return reportType == TransactionReportType.WALLET || reportType == TransactionReportType.WALLET_TRANSFER;
    }

    @Override
    public Page<TransactionHistoryResponseDto> fetchHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Pageable pageable) {

        Optional<Wallet> walletOpt = walletRepository.findByUserId(userId);
        if (walletOpt.isEmpty()) {
            return Page.empty(pageable);
        }

        UUID walletId = walletOpt.get().getId();
        WalletTransactionStatus walletStatus = getWalletStatus(status);
        WalletTransactionContext walletContext = getWalletContext(reportType);

        Instant start = fromDate != null ? fromDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        Instant end = toDate != null ? toDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        String searchStr = search != null && !search.isBlank() ? "%" + search.toLowerCase() + "%" : "%";

        Page<WalletEntry> entries = walletEntryRepository.findWithFilters(
                walletId, walletStatus, walletContext, null, start, end, searchStr, pageable);

        return entries.map(this::mapToDto);
    }

    @Override
    public List<TransactionHistoryResponseDto> fetchAllHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Sort sort) {

        Optional<Wallet> walletOpt = walletRepository.findByUserId(userId);
        if (walletOpt.isEmpty()) {
            return List.of();
        }

        UUID walletId = walletOpt.get().getId();
        WalletTransactionStatus walletStatus = getWalletStatus(status);
        WalletTransactionContext walletContext = getWalletContext(reportType);

        Instant start = fromDate != null ? fromDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        Instant end = toDate != null ? toDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        String searchStr = search != null && !search.isBlank() ? "%" + search.toLowerCase() + "%" : "%";

        // Query all matching entries using dynamic PageRequest unpaged or paging with very large size
        Pageable unpaged = PageRequest.of(0, Integer.MAX_VALUE - 1, Sort.by(Sort.Direction.DESC, "createdAt"));
        if (sort != null && sort.isSorted()) {
            unpaged = PageRequest.of(0, Integer.MAX_VALUE - 1, sort);
        }

        Page<WalletEntry> entries = walletEntryRepository.findWithFilters(
                walletId, walletStatus, walletContext, null, start, end, searchStr, unpaged);

        return entries.getContent().stream().map(this::mapToDto).collect(Collectors.toList());
    }

    @Override
    public TransactionHistorySummaryDto fetchSummary(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate) {

        List<TransactionHistoryResponseDto> all = fetchAllHistory(reportType, userId, search, status, provider, fromDate, toDate, Sort.unsorted());

        long total = all.size();
        long success = all.stream().filter(t -> "SUCCESS".equalsIgnoreCase(t.getStatus())).count();
        long failed = all.stream().filter(t -> "FAILED".equalsIgnoreCase(t.getStatus())).count();
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

    private WalletTransactionStatus getWalletStatus(String status) {
        if (status == null || status.isBlank()) return null;
        try {
            return WalletTransactionStatus.valueOf(status.toUpperCase());
        } catch (Exception e) {
            return null;
        }
    }

    private WalletTransactionContext getWalletContext(TransactionReportType reportType) {
        if (reportType == TransactionReportType.WALLET_TRANSFER) {
            return WalletTransactionContext.MANUAL_ADJUSTMENT;
        }
        return null;
    }

    private TransactionHistoryResponseDto mapToDto(WalletEntry entry) {
        BigDecimal commission = entry.getTds() != null && entry.getGst() != null ? entry.getTds().add(entry.getGst()) : BigDecimal.ZERO;
        return TransactionHistoryResponseDto.builder()
                .transactionId(entry.getReferenceId())
                .providerReference(entry.getReferenceId())
                .providerTransactionId(entry.getId().toString())
                .bankReference(entry.getReferenceId())
                .retailerId(entry.getWallet().getUser().getId().toString())
                .serviceType(entry.getTransactionContext() != null ? entry.getTransactionContext().name() : entry.getEntryType())
                .provider("INTERNAL")
                .amount(entry.getAmount())
                .commission(commission)
                .openingBalance(entry.getOpeningBalance() != null ? entry.getOpeningBalance() : BigDecimal.ZERO)
                .closingBalance(entry.getClosingBalance() != null ? entry.getClosingBalance() : BigDecimal.ZERO)
                .status(entry.getStatus().name())
                .remarks(entry.getNarration())
                .createdAt(LocalDateTime.ofInstant(entry.getCreatedAt(), ZoneId.systemDefault()))
                .updatedAt(LocalDateTime.ofInstant(entry.getCreatedAt(), ZoneId.systemDefault()))
                .build();
    }
}
