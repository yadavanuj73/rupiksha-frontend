package com.rupiksha.backend.service.impl;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.provider.fingpay.entity.FingpayTransaction;
import com.rupiksha.aeps.provider.fingpay.repository.FingpayTransactionRepository;
import com.rupiksha.aeps.repository.AepsTransactionEngineRepository;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.backend.api.dto.TransactionHistoryPageResponse;
import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.api.dto.TransactionHistorySummaryDto;
import com.rupiksha.backend.domain.TransactionReportType;
import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.domain.WalletEntry;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.WalletEntryRepository;
import com.rupiksha.backend.service.TransactionHistoryService;
import com.rupiksha.backend.service.history.TransactionHistoryProvider;
import com.rupiksha.backend.service.history.TransactionHistoryProviderFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransactionHistoryServiceImpl implements TransactionHistoryService {

    private final TransactionHistoryProviderFactory providerFactory;
    private final FingpayTransactionRepository fingpayRepository;
    private final AepsTransactionEngineRepository aepsRepository;
    private final PayoutTransactionRepository payoutRepository;
    private final TxnRepository txnRepository;
    private final WalletEntryRepository walletEntryRepository;

    @Override
    @Transactional(readOnly = true)
    public TransactionHistoryPageResponse getHistory(
            TransactionReportType reportType,
            UUID userId,
            String search,
            String status,
            String provider,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            Pageable pageable) {

        log.info("Fetching transaction history for retailer: {}, type: {}, search: {}, status: {}", userId, reportType, search, status);
        
        TransactionHistoryProvider strategy = providerFactory.getProvider(reportType);
        
        Page<TransactionHistoryResponseDto> pageData = strategy.fetchHistory(
                reportType, userId, search, status, provider, fromDate, toDate, pageable);
        
        TransactionHistorySummaryDto summary = strategy.fetchSummary(
                reportType, userId, search, status, provider, fromDate, toDate);

        return TransactionHistoryPageResponse.builder()
                .success(true)
                .message("Transaction history loaded successfully")
                .data(pageData.getContent())
                .summary(summary)
                .pagination(TransactionHistoryPageResponse.PaginationDetails.builder()
                        .page(pageData.getNumber())
                        .size(pageData.getSize())
                        .totalElements(pageData.getTotalElements())
                        .totalPages(pageData.getTotalPages())
                        .build())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TransactionHistoryResponseDto> getAllHistory(
            TransactionReportType reportType,
            UUID userId,
            String search,
            String status,
            String provider,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            Sort sort) {

        log.info("Fetching all transaction history for export: retailer: {}, type: {}", userId, reportType);
        TransactionHistoryProvider strategy = providerFactory.getProvider(reportType);
        return strategy.fetchAllHistory(reportType, userId, search, status, provider, fromDate, toDate, sort);
    }

    @Override
    @Transactional(readOnly = true)
    public TransactionHistoryResponseDto getTransactionDetail(UUID userId, String transactionId) {
        log.info("Fetching transaction details for transactionId: {} and user: {}", transactionId, userId);

        // 1. Check Fingpay transactions
        Optional<FingpayTransaction> fingpayOpt = fingpayRepository.findByTxnid(transactionId);
        if (fingpayOpt.isPresent()) {
            FingpayTransaction txn = fingpayOpt.get();
            long expectedUid = userId.getMostSignificantBits() & Long.MAX_VALUE;
            if (txn.getUid() != expectedUid) {
                log.warn("Access Denied: Fingpay transaction {} does not belong to retailer {}", transactionId, userId);
                throw new SecurityException("Unauthorized access to transaction details.");
            }
            return mapFingpayToDto(txn);
        }

        // 2. Check Levin transactions
        Optional<AepsTransactionEngine> aepsOpt = aepsRepository.findByTransactionId(transactionId);
        if (aepsOpt.isPresent()) {
            AepsTransactionEngine txn = aepsOpt.get();
            if (!userId.equals(txn.getUserId())) {
                log.warn("Access Denied: AEPS transaction {} does not belong to retailer {}", transactionId, userId);
                throw new SecurityException("Unauthorized access to transaction details.");
            }
            return mapAepsToDto(txn);
        }

        // 3. Check Payout transactions
        Optional<PayoutTransaction> payoutOpt = payoutRepository.findByOrderId(transactionId);
        if (payoutOpt.isPresent()) {
            PayoutTransaction txn = payoutOpt.get();
            if (!userId.toString().equalsIgnoreCase(txn.getUserId())) {
                log.warn("Access Denied: Payout transaction {} does not belong to retailer {}", transactionId, userId);
                throw new SecurityException("Unauthorized access to transaction details.");
            }
            return mapPayoutToDto(txn);
        }

        // 4. Check Core Txn
        try {
            UUID txnUuid = UUID.fromString(transactionId);
            Optional<Txn> txnOpt = txnRepository.findById(txnUuid);
            if (txnOpt.isPresent()) {
                Txn txn = txnOpt.get();
                if (!userId.equals(txn.getUser().getId())) {
                    log.warn("Access Denied: Core transaction {} does not belong to retailer {}", transactionId, userId);
                    throw new SecurityException("Unauthorized access to transaction details.");
                }
                return mapTxnToDto(txn);
            }
        } catch (IllegalArgumentException e) {
            // Ignored, not a UUID
        }

        // 5. Check Wallet entries by referenceId
        List<WalletEntry> walletEntries = walletEntryRepository.findByIdempotencyKey(transactionId)
                .map(List::of)
                .orElse(List.of());
        if (!walletEntries.isEmpty()) {
            WalletEntry entry = walletEntries.get(0);
            if (!userId.equals(entry.getWallet().getUser().getId())) {
                log.warn("Access Denied: Wallet entry {} does not belong to retailer {}", transactionId, userId);
                throw new SecurityException("Unauthorized access to transaction details.");
            }
            return mapWalletEntryToDto(entry);
        }

        throw new IllegalArgumentException("Transaction not found for ID: " + transactionId);
    }

    private TransactionHistoryResponseDto mapFingpayToDto(FingpayTransaction txn) {
        BigDecimal opening = BigDecimal.ZERO;
        BigDecimal closing = BigDecimal.ZERO;
        BigDecimal comm = BigDecimal.ZERO;
        Optional<WalletEntry> entryOpt = walletEntryRepository.findByIdempotencyKey(txn.getTxnid());
        if (entryOpt.isPresent()) {
            opening = entryOpt.get().getOpeningBalance();
            closing = entryOpt.get().getClosingBalance();
            if (entryOpt.get().getTds() != null) comm = comm.add(entryOpt.get().getTds());
            if (entryOpt.get().getGst() != null) comm = comm.add(entryOpt.get().getGst());
        }

        return TransactionHistoryResponseDto.builder()
                .transactionId(txn.getTxnid())
                .providerReference(txn.getFtxnin())
                .providerTransactionId(txn.getFtxnin())
                .bankReference(txn.getRrn())
                .retailerId(String.valueOf(txn.getUid()))
                .serviceType(txn.getType())
                .provider("FINGPAY")
                .amount(BigDecimal.valueOf(txn.getTxnamount() != null ? txn.getTxnamount() : 0.0))
                .commission(comm)
                .openingBalance(opening)
                .closingBalance(closing)
                .status(txn.getStatus())
                .remarks(txn.getMessage())
                .createdAt(txn.getCreatedAt())
                .updatedAt(txn.getCreatedAt())
                .build();
    }

    private TransactionHistoryResponseDto mapAepsToDto(AepsTransactionEngine txn) {
        BigDecimal opening = BigDecimal.ZERO;
        BigDecimal closing = BigDecimal.ZERO;
        BigDecimal comm = BigDecimal.ZERO;
        Optional<WalletEntry> entryOpt = walletEntryRepository.findByIdempotencyKey(txn.getTransactionId());
        if (entryOpt.isPresent()) {
            opening = entryOpt.get().getOpeningBalance();
            closing = entryOpt.get().getClosingBalance();
            if (entryOpt.get().getTds() != null) comm = comm.add(entryOpt.get().getTds());
            if (entryOpt.get().getGst() != null) comm = comm.add(entryOpt.get().getGst());
        }

        return TransactionHistoryResponseDto.builder()
                .transactionId(txn.getTransactionId())
                .providerReference(txn.getReferenceNumber())
                .providerTransactionId(txn.getCorrelationId())
                .bankReference(txn.getProviderReference())
                .retailerId(txn.getUserId().toString())
                .serviceType(txn.getServiceType())
                .provider(txn.getProvider() != null ? txn.getProvider().toUpperCase() : "AEPS")
                .amount(txn.getAmount())
                .commission(comm)
                .openingBalance(opening)
                .closingBalance(closing)
                .status(txn.getStatus())
                .remarks(txn.getProviderMessage())
                .createdAt(txn.getInitiatedAt())
                .updatedAt(txn.getCompletedAt() != null ? txn.getCompletedAt() : txn.getLastUpdated())
                .build();
    }

    private TransactionHistoryResponseDto mapPayoutToDto(PayoutTransaction txn) {
        BigDecimal opening = BigDecimal.ZERO;
        BigDecimal closing = BigDecimal.ZERO;
        BigDecimal comm = BigDecimal.ZERO;
        Optional<WalletEntry> entryOpt = walletEntryRepository.findByIdempotencyKey(txn.getOrderId());
        if (entryOpt.isPresent()) {
            opening = entryOpt.get().getOpeningBalance();
            closing = entryOpt.get().getClosingBalance();
            if (entryOpt.get().getTds() != null) comm = comm.add(entryOpt.get().getTds());
            if (entryOpt.get().getGst() != null) comm = comm.add(entryOpt.get().getGst());
        }

        return TransactionHistoryResponseDto.builder()
                .transactionId(txn.getOrderId())
                .providerReference(txn.getOrderId())
                .providerTransactionId(txn.getUtr())
                .bankReference(txn.getUtr())
                .retailerId(txn.getUserId())
                .serviceType("PAYOUT")
                .provider("INTERNAL")
                .amount(txn.getAmount())
                .commission(comm)
                .openingBalance(opening)
                .closingBalance(closing)
                .status(txn.getStatus())
                .remarks("Payout transfer to " + txn.getBeneficiaryName())
                .createdAt(txn.getCreatedAt())
                .updatedAt(txn.getUpdatedAt() != null ? txn.getUpdatedAt() : txn.getCreatedAt())
                .build();
    }

    private TransactionHistoryResponseDto mapTxnToDto(Txn txn) {
        BigDecimal opening = BigDecimal.ZERO;
        BigDecimal closing = BigDecimal.ZERO;
        BigDecimal comm = BigDecimal.ZERO;
        Optional<WalletEntry> entryOpt = walletEntryRepository.findByIdempotencyKey(txn.getId().toString());
        if (entryOpt.isPresent()) {
            opening = entryOpt.get().getOpeningBalance();
            closing = entryOpt.get().getClosingBalance();
            if (entryOpt.get().getTds() != null) comm = comm.add(entryOpt.get().getTds());
            if (entryOpt.get().getGst() != null) comm = comm.add(entryOpt.get().getGst());
        }

        return TransactionHistoryResponseDto.builder()
                .transactionId(txn.getId().toString())
                .providerReference(txn.getProviderRef())
                .providerTransactionId(txn.getIdempotencyKey())
                .bankReference(txn.getProviderRef())
                .retailerId(txn.getUser().getId().toString())
                .serviceType(txn.getServiceType())
                .provider("INTERNAL")
                .amount(txn.getAmount())
                .commission(comm)
                .openingBalance(opening)
                .closingBalance(closing)
                .status(txn.getStatus().name())
                .remarks(txn.getServiceType() + " payment log")
                .createdAt(LocalDateTime.ofInstant(txn.getCreatedAt(), ZoneId.systemDefault()))
                .updatedAt(LocalDateTime.ofInstant(txn.getCreatedAt(), ZoneId.systemDefault()))
                .build();
    }

    private TransactionHistoryResponseDto mapWalletEntryToDto(WalletEntry entry) {
        BigDecimal comm = entry.getTds() != null && entry.getGst() != null ? entry.getTds().add(entry.getGst()) : BigDecimal.ZERO;
        return TransactionHistoryResponseDto.builder()
                .transactionId(entry.getReferenceId())
                .providerReference(entry.getReferenceId())
                .providerTransactionId(entry.getId().toString())
                .bankReference(entry.getReferenceId())
                .retailerId(entry.getWallet().getUser().getId().toString())
                .serviceType(entry.getTransactionContext() != null ? entry.getTransactionContext().name() : entry.getEntryType())
                .provider("WALLET")
                .amount(entry.getAmount())
                .commission(comm)
                .openingBalance(entry.getOpeningBalance() != null ? entry.getOpeningBalance() : BigDecimal.ZERO)
                .closingBalance(entry.getClosingBalance() != null ? entry.getClosingBalance() : BigDecimal.ZERO)
                .status(entry.getStatus().name())
                .remarks(entry.getNarration())
                .createdAt(LocalDateTime.ofInstant(entry.getCreatedAt(), ZoneId.systemDefault()))
                .updatedAt(LocalDateTime.ofInstant(entry.getCreatedAt(), ZoneId.systemDefault()))
                .build();
    }
}
