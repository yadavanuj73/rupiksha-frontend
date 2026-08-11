package com.rupiksha.backend.service.history.providers;

import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.api.dto.TransactionHistorySummaryDto;
import com.rupiksha.backend.domain.TransactionReportType;
import com.rupiksha.backend.domain.TransactionStatus;
import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.WalletEntryRepository;
import com.rupiksha.backend.repository.RechargeRepository;
import com.rupiksha.backend.service.history.BaseHistoryProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
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

@Slf4j
@Component
public class RechargeHistoryProvider extends BaseHistoryProvider {

    private final TxnRepository txnRepository;
    private final RechargeRepository rechargeRepository;

    public RechargeHistoryProvider(WalletEntryRepository walletEntryRepository,
                                   TxnRepository txnRepository,
                                   RechargeRepository rechargeRepository) {
        super(walletEntryRepository);
        this.txnRepository = txnRepository;
        this.rechargeRepository = rechargeRepository;
    }

    @Override
    public boolean supports(TransactionReportType reportType) {
        return reportType == TransactionReportType.RECHARGE;
    }

    @Override
    public Page<TransactionHistoryResponseDto> fetchHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Pageable pageable) {

        TransactionStatus txnStatus = getTxnStatus(status);
        Instant start = fromDate != null ? fromDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        Instant end = toDate != null ? toDate.atZone(ZoneId.systemDefault()).toInstant() : null;

        Page<Txn> txns = txnRepository.findWithFilters(
                userId, "RECHARGE", false, txnStatus, provider, start, end, search, pageable);

        return txns.map(this::mapToDto);
    }

    @Override
    public List<TransactionHistoryResponseDto> fetchAllHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Sort sort) {

        TransactionStatus txnStatus = getTxnStatus(status);
        Instant start = fromDate != null ? fromDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        Instant end = toDate != null ? toDate.atZone(ZoneId.systemDefault()).toInstant() : null;

        List<Txn> txns = txnRepository.findAllWithFilters(
                userId, "RECHARGE", false, txnStatus, provider, start, end, search, sort);

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

    private TransactionHistoryResponseDto mapToDto(Txn txn) {
        WalletBalances balances = getBalancesAndCommission(txn.getId().toString());
        
        String remarks = "Mobile/DTH Recharge";
        String providerRef = txn.getProviderRef();
        String bankRef = txn.getProviderRef();

        if (txn.getIdempotencyKey() != null) {
            var rechargeOpt = rechargeRepository.findByMerchantRefNo(txn.getIdempotencyKey());
            if (rechargeOpt.isPresent()) {
                var recharge = rechargeOpt.get();
                remarks = "MOBILE RECHARGE: " + recharge.getMobileNo() + " (" + recharge.getOperatorCode() + ")";
                providerRef = recharge.getOperatorTxnId();
                bankRef = recharge.getOrderNo();
            }
        }

        return TransactionHistoryResponseDto.builder()
                .transactionId(txn.getId().toString())
                .providerReference(providerRef)
                .providerTransactionId(txn.getIdempotencyKey())
                .bankReference(bankRef)
                .retailerId(txn.getUser().getId().toString())
                .serviceType(txn.getServiceType())
                .provider("RECHARGE")
                .amount(txn.getAmount())
                .commission(balances.commission)
                .openingBalance(balances.openingBalance)
                .closingBalance(balances.closingBalance)
                .status(txn.getStatus().name())
                .remarks(remarks)
                .createdAt(LocalDateTime.ofInstant(txn.getCreatedAt(), ZoneId.systemDefault()))
                .updatedAt(LocalDateTime.ofInstant(txn.getCreatedAt(), ZoneId.systemDefault()))
                .build();
    }
}
