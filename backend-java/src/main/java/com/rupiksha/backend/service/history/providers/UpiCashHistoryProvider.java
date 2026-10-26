package com.rupiksha.backend.service.history.providers;

import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.api.dto.TransactionHistorySummaryDto;
import com.rupiksha.backend.domain.TransactionReportType;
import com.rupiksha.backend.domain.TransactionStatus;
import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.WalletEntryRepository;
import com.rupiksha.backend.service.history.BaseHistoryProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import com.rupiksha.backend.domain.FingpayUpiCashTransaction;
import com.rupiksha.backend.repository.FingpayUpiCashTransactionRepository;

@Slf4j
@Component
public class UpiCashHistoryProvider extends BaseHistoryProvider {

    private final TxnRepository txnRepository;
    private final FingpayUpiCashTransactionRepository upiTransactionRepository;

    public UpiCashHistoryProvider(WalletEntryRepository walletEntryRepository,
                                  TxnRepository txnRepository,
                                  FingpayUpiCashTransactionRepository upiTransactionRepository) {
        super(walletEntryRepository);
        this.txnRepository = txnRepository;
        this.upiTransactionRepository = upiTransactionRepository;
    }

    @Override
    public boolean supports(TransactionReportType reportType) {
        return reportType == TransactionReportType.UPI_CASH_WITHDRAWAL;
    }

    @Override
    public Page<TransactionHistoryResponseDto> fetchHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Pageable pageable) {

        Instant start = fromDate != null ? fromDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        Instant end = toDate != null ? toDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;
        String cleanStatus = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) ? status.trim().toUpperCase() : null;

        Page<FingpayUpiCashTransaction> upiTxns = upiTransactionRepository.findWithFilters(
                userId, cleanStatus, start, end, cleanSearch, pageable);

        if (upiTxns.hasContent() || upiTransactionRepository.countAllByUserId(userId) > 0) {
            return upiTxns.map(this::mapUpiToDto);
        }

        TransactionStatus txnStatus = getTxnStatus(status);
        Page<Txn> txns = txnRepository.findWithFilters(
                userId, "UPI_CASH_WITHDRAWAL", false, txnStatus, provider, start, end, search, pageable);
        return txns.map(this::mapToDto);
    }

    @Override
    public List<TransactionHistoryResponseDto> fetchAllHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Sort sort) {

        Instant start = fromDate != null ? fromDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        Instant end = toDate != null ? toDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;
        String cleanStatus = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) ? status.trim().toUpperCase() : null;

        List<FingpayUpiCashTransaction> upiTxns = upiTransactionRepository.findAllWithFilters(
                userId, cleanStatus, start, end, cleanSearch, sort);

        if (!upiTxns.isEmpty() || upiTransactionRepository.countAllByUserId(userId) > 0) {
            return upiTxns.stream().map(this::mapUpiToDto).collect(Collectors.toList());
        }

        TransactionStatus txnStatus = getTxnStatus(status);
        List<Txn> txns = txnRepository.findAllWithFilters(
                userId, "UPI_CASH_WITHDRAWAL", false, txnStatus, provider, start, end, search, sort);
        return txns.stream().map(this::mapToDto).collect(Collectors.toList());
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

    private TransactionStatus getTxnStatus(String status) {
        if (status == null || status.isBlank()) return null;
        try {
            return TransactionStatus.valueOf(status.toUpperCase());
        } catch (Exception e) {
            return null;
        }
    }

    private TransactionHistoryResponseDto mapUpiToDto(FingpayUpiCashTransaction t) {
        String referenceLookup = t.getTxn() != null ? t.getTxn().getId().toString() : t.getPartnerRequestId();
        WalletBalances balances = getBalancesAndCommission(referenceLookup);

        String remarks = (t.getRemarks() != null && !t.getRemarks().isBlank())
                ? t.getRemarks()
                : "UPI Cash Withdrawal (Ref: " + t.getPartnerRequestId() + ")";

        return TransactionHistoryResponseDto.builder()
                .transactionId(t.getPartnerRequestId())
                .providerReference(t.getFpTransactionId() != null ? t.getFpTransactionId() : t.getPartnerRequestId())
                .providerTransactionId(t.getFpTransactionId() != null ? t.getFpTransactionId() : t.getPartnerRequestId())
                .bankReference(t.getBankRrn() != null ? t.getBankRrn() : "—")
                .retailerId(t.getUser().getId().toString())
                .serviceType("UPI Cash Withdrawal")
                .provider("FINGPAY")
                .amount(t.getAmount())
                .commission(balances.commission != null ? balances.commission : BigDecimal.ZERO)
                .openingBalance(balances.openingBalance)
                .closingBalance(balances.closingBalance)
                .status(t.getInternalStatus())
                .remarks(remarks)
                .createdAt(LocalDateTime.ofInstant(t.getCreatedAt(), ZoneId.systemDefault()))
                .updatedAt(LocalDateTime.ofInstant(t.getUpdatedAt(), ZoneId.systemDefault()))
                .build();
    }

    private TransactionHistoryResponseDto mapToDto(Txn txn) {
        WalletBalances balances = getBalancesAndCommission(txn.getId().toString());
        return TransactionHistoryResponseDto.builder()
                .transactionId(txn.getId().toString())
                .providerReference(txn.getProviderRef())
                .providerTransactionId(txn.getIdempotencyKey())
                .bankReference(txn.getProviderRef())
                .retailerId(txn.getUser().getId().toString())
                .serviceType(txn.getServiceType())
                .provider("UPI")
                .amount(txn.getAmount())
                .commission(balances.commission)
                .openingBalance(balances.openingBalance)
                .closingBalance(balances.closingBalance)
                .status(txn.getStatus().name())
                .remarks("UPI Cash Withdrawal")
                .createdAt(LocalDateTime.ofInstant(txn.getCreatedAt(), ZoneId.systemDefault()))
                .updatedAt(LocalDateTime.ofInstant(txn.getCreatedAt(), ZoneId.systemDefault()))
                .build();
    }
}
