package com.rupiksha.backend.service.history.providers;

import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.api.dto.TransactionHistorySummaryDto;
import com.rupiksha.backend.domain.FingpayCmsTransaction;
import com.rupiksha.backend.domain.TransactionReportType;
import com.rupiksha.backend.domain.TransactionStatus;
import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.repository.FingpayCmsTransactionRepository;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.WalletEntryRepository;
import com.rupiksha.backend.service.history.BaseHistoryProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Component
public class CmsHistoryProvider extends BaseHistoryProvider {

    private final TxnRepository txnRepository;
    private final FingpayCmsTransactionRepository cmsTransactionRepository;

    public CmsHistoryProvider(WalletEntryRepository walletEntryRepository,
                              TxnRepository txnRepository,
                              FingpayCmsTransactionRepository cmsTransactionRepository) {
        super(walletEntryRepository);
        this.txnRepository = txnRepository;
        this.cmsTransactionRepository = cmsTransactionRepository;
    }

    @Override
    public boolean supports(TransactionReportType reportType) {
        return reportType == TransactionReportType.CMS_AIRTEL || reportType == TransactionReportType.CMS_FINGPAY;
    }

    @Override
    public Page<TransactionHistoryResponseDto> fetchHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Pageable pageable) {

        Instant start = fromDate != null ? fromDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        Instant end = toDate != null ? toDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;
        String cleanStatus = (status != null && !status.isBlank()) ? status.trim().toUpperCase() : null;

        if (reportType == TransactionReportType.CMS_FINGPAY) {
            Page<FingpayCmsTransaction> cmsTxns = cmsTransactionRepository.findWithFilters(
                    userId, cleanStatus, start, end, cleanSearch, pageable);
            return cmsTxns.map(this::mapCmsToDto);
        }

        TransactionStatus txnStatus = getTxnStatus(status);
        String cmsProvider = "Airtel";
        Page<Txn> txns = txnRepository.findWithFilters(
                userId, "CMS", false, txnStatus, cmsProvider, start, end, cleanSearch, pageable);
        return txns.map(t -> mapToDto(t, cmsProvider));
    }

    @Override
    public List<TransactionHistoryResponseDto> fetchAllHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Sort sort) {

        Instant start = fromDate != null ? fromDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        Instant end = toDate != null ? toDate.atZone(ZoneId.systemDefault()).toInstant() : null;
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;
        String cleanStatus = (status != null && !status.isBlank()) ? status.trim().toUpperCase() : null;

        if (reportType == TransactionReportType.CMS_FINGPAY) {
            List<FingpayCmsTransaction> cmsTxns = cmsTransactionRepository.findAllWithFilters(
                    userId, cleanStatus, start, end, cleanSearch, sort);
            return cmsTxns.stream().map(this::mapCmsToDto).collect(Collectors.toList());
        }

        TransactionStatus txnStatus = getTxnStatus(status);
        String cmsProvider = "Airtel";
        List<Txn> txns = txnRepository.findAllWithFilters(
                userId, "CMS", false, txnStatus, cmsProvider, start, end, cleanSearch, sort);
        return txns.stream().map(t -> mapToDto(t, cmsProvider)).collect(Collectors.toList());
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

    private TransactionHistoryResponseDto mapCmsToDto(FingpayCmsTransaction t) {
        String referenceLookup = t.getTxn() != null ? t.getTxn().getId().toString() : t.getMerchantTransactionId();
        WalletBalances balances = getBalancesAndCommission(referenceLookup);

        String remarks = (t.getRemarks() != null && !t.getRemarks().isBlank())
                ? t.getRemarks()
                : "Fingpay CMS " + t.getTypeOfTransaction() + " (BC: " + t.getBcLoginId() + ")";

        return TransactionHistoryResponseDto.builder()
                .transactionId(t.getMerchantTransactionId())
                .providerReference(t.getFpTransactionId())
                .providerTransactionId(t.getFpTransactionId())
                .bankReference(t.getFpTransactionId())
                .retailerId(t.getUser().getId().toString())
                .serviceType("CMS Collection")
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

    private TransactionHistoryResponseDto mapToDto(Txn txn, String cmsProvider) {
        WalletBalances balances = getBalancesAndCommission(txn.getId().toString());
        return TransactionHistoryResponseDto.builder()
                .transactionId(txn.getId().toString())
                .providerReference(txn.getProviderRef())
                .providerTransactionId(txn.getIdempotencyKey())
                .bankReference(txn.getProviderRef())
                .retailerId(txn.getUser().getId().toString())
                .serviceType(txn.getServiceType())
                .provider(cmsProvider.toUpperCase())
                .amount(txn.getAmount())
                .commission(balances.commission)
                .openingBalance(balances.openingBalance)
                .closingBalance(balances.closingBalance)
                .status(txn.getStatus().name())
                .remarks(cmsProvider + " CMS payment log")
                .createdAt(LocalDateTime.ofInstant(txn.getCreatedAt(), ZoneId.systemDefault()))
                .updatedAt(LocalDateTime.ofInstant(txn.getCreatedAt(), ZoneId.systemDefault()))
                .build();
    }
}
