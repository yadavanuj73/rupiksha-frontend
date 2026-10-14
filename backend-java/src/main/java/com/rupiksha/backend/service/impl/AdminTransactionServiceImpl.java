package com.rupiksha.backend.service.impl;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.repository.AepsTransactionEngineRepository;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.backend.api.dto.TransactionHistoryPageResponse;
import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.api.dto.TransactionHistorySummaryDto;
import com.rupiksha.backend.api.dto.WalletTransferDtos;
import com.rupiksha.backend.domain.Recharge;
import com.rupiksha.backend.domain.TransactionStatus;
import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.RechargeRepository;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.service.AdminTransactionService;
import com.rupiksha.backend.service.WalletTransferService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminTransactionServiceImpl implements AdminTransactionService {

    private final AepsTransactionEngineRepository aepsRepository;
    private final PayoutTransactionRepository payoutRepository;
    private final TxnRepository txnRepository;
    private final RechargeRepository rechargeRepository;
    private final UserRepository userRepository;
    private final WalletTransferService walletTransferService;

    private String normalizeReportType(String type) {
        if (type == null || type.isBlank()) return "AEPS_FINGPAY";
        String upper = type.trim().toUpperCase();
        switch (upper) {
            case "AEPS_1":
            case "FINGPAY":
            case "FINGPAY_AEPS":
            case "AEPS_FINGPAY":
                return "AEPS_FINGPAY";
            case "AEPS_2":
            case "LEVIN":
            case "LEVIN_AEPS":
            case "AEPS_LEVIN":
                return "AEPS_LEVIN";
            case "RECHARGE":
            case "MOBILE_DTH_RECHARGE":
            case "MOBILE_RECHARGE":
                return "RECHARGE";
            case "MOVE_TO_BANK":
            case "PAYOUT":
            case "PAYOUT_HUB":
                return "MOVE_TO_BANK";
            case "WALLET_TRANSFER":
            case "WALLET_TO_WALLET":
                return "WALLET_TRANSFER";
            case "UPI_CASH_WITHDRAWAL":
            case "UPI_CASH":
                return "UPI_CASH_WITHDRAWAL";
            case "CREDIT_CARD_BILL":
            case "CREDIT_CARD":
                return "CREDIT_CARD_BILL";
            default:
                return upper;
        }
    }

    private LocalDateTime parseStartDateTime(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            String cleaned = dateStr.endsWith("Z") ? dateStr.substring(0, dateStr.length() - 1) : dateStr;
            if (cleaned.contains("T")) {
                return LocalDateTime.parse(cleaned.split("\\.")[0]);
            }
            return LocalDate.parse(cleaned).atStartOfDay();
        } catch (Exception e) {
            log.warn("Failed to parse start date: {}", dateStr);
            return null;
        }
    }

    private LocalDateTime parseEndDateTime(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            String cleaned = dateStr.endsWith("Z") ? dateStr.substring(0, dateStr.length() - 1) : dateStr;
            if (cleaned.contains("T")) {
                return LocalDateTime.parse(cleaned.split("\\.")[0]);
            }
            return LocalDate.parse(cleaned).atTime(LocalTime.MAX);
        } catch (Exception e) {
            log.warn("Failed to parse end date: {}", dateStr);
            return null;
        }
    }

    private Instant toInstant(LocalDateTime ldt) {
        return ldt != null ? ldt.atZone(ZoneId.systemDefault()).toInstant() : null;
    }

    @Override
    @Transactional(readOnly = true)
    public TransactionHistoryPageResponse getTransactions(
            String reportType,
            String search,
            String status,
            String provider,
            String fromDate,
            String toDate,
            Pageable pageable) {

        String normType = normalizeReportType(reportType);
        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        String cleanStatus = (status != null && !status.trim().isEmpty() && !"ALL".equalsIgnoreCase(status.trim())) ? status.trim() : null;
        String cleanProvider = (provider != null && !provider.trim().isEmpty() && !"ALL".equalsIgnoreCase(provider.trim())) ? provider.trim() : null;

        LocalDateTime startLdt = parseStartDateTime(fromDate);
        LocalDateTime endLdt = parseEndDateTime(toDate);
        Instant startInst = toInstant(startLdt);
        Instant endInst = toInstant(endLdt);

        List<UUID> matchingUserIds = cleanSearch != null ? userRepository.findUserIdsBySearchTerm(cleanSearch) : Collections.emptyList();
        boolean hasUserMatches = !matchingUserIds.isEmpty();

        List<TransactionHistoryResponseDto> dtoList;
        long totalElements;
        int totalPages;
        int pageNumber = pageable.getPageNumber();
        int pageSize = pageable.getPageSize();

        BigDecimal totalVolume = BigDecimal.ZERO;
        long successCount = 0;
        long pendingCount = 0;
        long failedCount = 0;
        BigDecimal cashWithdrawalVolume = BigDecimal.ZERO;
        BigDecimal cashDepositVolume = BigDecimal.ZERO;

        switch (normType) {
            case "AEPS_FINGPAY":
            case "AEPS_LEVIN": {
                String targetProvider = normType.equals("AEPS_LEVIN") ? "levin" : "fingpay";
                Page<AepsTransactionEngine> page = hasUserMatches ?
                        aepsRepository.findForAdminWithUserIds(null, cleanStatus, targetProvider, startLdt, endLdt, cleanSearch, matchingUserIds, pageable) :
                        aepsRepository.findForAdmin(null, cleanStatus, targetProvider, startLdt, endLdt, cleanSearch, pageable);

                totalElements = page.getTotalElements();
                totalPages = page.getTotalPages();

                Set<UUID> userIds = page.getContent().stream()
                        .map(AepsTransactionEngine::getUserId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());
                Map<UUID, User> userMap = userIds.isEmpty() ? Collections.emptyMap() :
                        userRepository.findAllById(userIds).stream().collect(Collectors.toMap(User::getId, u -> u));

                dtoList = page.getContent().stream().map(txn -> {
                    User u = txn.getUserId() != null ? userMap.get(txn.getUserId()) : null;
                    return TransactionHistoryResponseDto.builder()
                            .transactionId(txn.getTransactionId())
                            .providerReference(txn.getProviderReference())
                            .providerTransactionId(txn.getProviderReference())
                            .bankReference(txn.getReferenceNumber())
                            .retailerId(u != null ? u.getUsername() : (txn.getUserId() != null ? txn.getUserId().toString() : "N/A"))
                            .userName(u != null ? u.getFullName() : (txn.getCreatedBy() != null ? txn.getCreatedBy() : "N/A"))
                            .userMobile(u != null ? u.getMobile() : "N/A")
                            .partyCode(u != null ? (u.getPartyCode() != null && !u.getPartyCode().isBlank() ? u.getPartyCode() : u.getUsername()) : "N/A")
                            .userRole(u != null && !u.getRoles().isEmpty() ? u.getRoles().iterator().next().getName().name() : "RETAILER")
                            .serviceType(txn.getServiceType() != null ? txn.getServiceType() : "AEPS")
                            .provider(txn.getProvider() != null ? txn.getProvider() : targetProvider.toUpperCase())
                            .amount(txn.getAmount() != null ? txn.getAmount() : BigDecimal.ZERO)
                            .commission(BigDecimal.ZERO)
                            .openingBalance(BigDecimal.ZERO)
                            .closingBalance(BigDecimal.ZERO)
                            .status(txn.getStatus())
                            .remarks(txn.getProviderMessage() != null ? txn.getProviderMessage() : txn.getServiceType())
                            .createdAt(txn.getInitiatedAt())
                            .updatedAt(txn.getCompletedAt() != null ? txn.getCompletedAt() : txn.getInitiatedAt())
                            .build();
                }).collect(Collectors.toList());

                for (TransactionHistoryResponseDto dto : dtoList) {
                    BigDecimal amt = dto.getAmount() != null ? dto.getAmount() : BigDecimal.ZERO;
                    String st = dto.getStatus() != null ? dto.getStatus().toUpperCase() : "";
                    if ("SUCCESS".equals(st) || "APPROVED".equals(st)) {
                        successCount++;
                        totalVolume = totalVolume.add(amt);
                        if ("CASH_WITHDRAWAL".equalsIgnoreCase(dto.getServiceType())) {
                            cashWithdrawalVolume = cashWithdrawalVolume.add(amt);
                        } else if ("CASH_DEPOSIT".equalsIgnoreCase(dto.getServiceType())) {
                            cashDepositVolume = cashDepositVolume.add(amt);
                        }
                    } else if ("PENDING".equals(st) || "INITIATED".equals(st) || "PROCESSING".equals(st) || "STARTED".equals(st)) {
                        pendingCount++;
                    } else {
                        failedCount++;
                    }
                }
                break;
            }

            case "RECHARGE": {
                TransactionStatus ts = null;
                if (cleanStatus != null) {
                    try { ts = TransactionStatus.valueOf(cleanStatus.toUpperCase()); } catch (Exception ignored) {}
                }
                Page<Recharge> recPage = rechargeRepository.findForAdmin(null, ts, startInst, endInst, cleanSearch, pageable);
                if (recPage.getTotalElements() > 0) {
                    totalElements = recPage.getTotalElements();
                    totalPages = recPage.getTotalPages();
                    dtoList = recPage.getContent().stream().map(r -> {
                        User u = r.getUser();
                        return TransactionHistoryResponseDto.builder()
                                .transactionId(r.getMerchantRefNo())
                                .providerReference(r.getOperatorTxnId())
                                .providerTransactionId(r.getOperatorTxnId())
                                .bankReference(r.getMobileNo())
                                .retailerId(u != null ? u.getUsername() : "N/A")
                                .userName(u != null ? u.getFullName() : "N/A")
                                .userMobile(u != null ? u.getMobile() : "N/A")
                                .partyCode(u != null ? (u.getPartyCode() != null && !u.getPartyCode().isBlank() ? u.getPartyCode() : u.getUsername()) : "N/A")
                                .userRole(u != null && !u.getRoles().isEmpty() ? u.getRoles().iterator().next().getName().name() : "RETAILER")
                                .serviceType("DH".equalsIgnoreCase(r.getServiceType()) ? "DTH RECHARGE" : "MOBILE RECHARGE")
                                .provider(r.getOperatorCode())
                                .amount(r.getAmount() != null ? r.getAmount() : BigDecimal.ZERO)
                                .commission(BigDecimal.ZERO)
                                .openingBalance(r.getOpeningBalance())
                                .closingBalance(r.getClosingBalance())
                                .status(r.getStatus() != null ? r.getStatus().name() : "INITIATED")
                                .remarks(r.getDescription() != null ? r.getDescription() : "Recharge to " + r.getMobileNo())
                                .createdAt(LocalDateTime.ofInstant(r.getCreatedAt(), ZoneId.systemDefault()))
                                .updatedAt(r.getCompletedAt() != null ? LocalDateTime.ofInstant(r.getCompletedAt(), ZoneId.systemDefault()) : LocalDateTime.ofInstant(r.getCreatedAt(), ZoneId.systemDefault()))
                                .build();
                    }).collect(Collectors.toList());
                } else {
                    Page<Txn> txnPage = txnRepository.findForAdmin(null, "RECHARGE", false, ts, cleanProvider, startInst, endInst, cleanSearch, pageable);
                    totalElements = txnPage.getTotalElements();
                    totalPages = txnPage.getTotalPages();
                    dtoList = txnPage.getContent().stream().map(t -> {
                        User u = t.getUser();
                        return TransactionHistoryResponseDto.builder()
                                .transactionId(t.getId().toString())
                                .providerReference(t.getProviderRef())
                                .providerTransactionId(t.getProviderRef())
                                .bankReference(t.getProviderRef())
                                .retailerId(u != null ? u.getUsername() : "N/A")
                                .userName(u != null ? u.getFullName() : "N/A")
                                .userMobile(u != null ? u.getMobile() : "N/A")
                                .partyCode(u != null ? (u.getPartyCode() != null && !u.getPartyCode().isBlank() ? u.getPartyCode() : u.getUsername()) : "N/A")
                                .userRole(u != null && !u.getRoles().isEmpty() ? u.getRoles().iterator().next().getName().name() : "RETAILER")
                                .serviceType(t.getServiceType())
                                .provider(t.getProviderRef() != null ? t.getProviderRef() : "RECHARGE")
                                .amount(t.getAmount() != null ? t.getAmount() : BigDecimal.ZERO)
                                .commission(BigDecimal.ZERO)
                                .openingBalance(BigDecimal.ZERO)
                                .closingBalance(BigDecimal.ZERO)
                                .status(t.getStatus() != null ? t.getStatus().name() : "INITIATED")
                                .remarks("Mobile/DTH Recharge")
                                .createdAt(LocalDateTime.ofInstant(t.getCreatedAt(), ZoneId.systemDefault()))
                                .updatedAt(LocalDateTime.ofInstant(t.getCreatedAt(), ZoneId.systemDefault()))
                                .build();
                    }).collect(Collectors.toList());
                }

                for (TransactionHistoryResponseDto dto : dtoList) {
                    BigDecimal amt = dto.getAmount() != null ? dto.getAmount() : BigDecimal.ZERO;
                    String st = dto.getStatus() != null ? dto.getStatus().toUpperCase() : "";
                    if ("SUCCESS".equals(st) || "COMPLETED".equals(st)) {
                        successCount++;
                        totalVolume = totalVolume.add(amt);
                    } else if ("PENDING".equals(st) || "INITIATED".equals(st) || "PROCESSING".equals(st)) {
                        pendingCount++;
                    } else {
                        failedCount++;
                    }
                }
                break;
            }

            case "MOVE_TO_BANK": {
                List<String> userIdsStr = matchingUserIds.stream().map(UUID::toString).toList();
                Page<PayoutTransaction> page = !userIdsStr.isEmpty() ?
                        payoutRepository.findForAdminWithUserIds(cleanStatus, startLdt, endLdt, cleanSearch, userIdsStr, pageable) :
                        payoutRepository.findForAdmin(cleanStatus, startLdt, endLdt, cleanSearch, pageable);

                totalElements = page.getTotalElements();
                totalPages = page.getTotalPages();

                Set<UUID> userUuids = page.getContent().stream()
                        .map(p -> {
                            try { return UUID.fromString(p.getUserId()); } catch (Exception ignored) { return null; }
                        })
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());
                Map<UUID, User> userMap = userUuids.isEmpty() ? Collections.emptyMap() :
                        userRepository.findAllById(userUuids).stream().collect(Collectors.toMap(User::getId, u -> u));

                dtoList = page.getContent().stream().map(p -> {
                    UUID uId = null;
                    try { uId = UUID.fromString(p.getUserId()); } catch (Exception ignored) {}
                    User u = uId != null ? userMap.get(uId) : null;

                    return TransactionHistoryResponseDto.builder()
                            .transactionId(p.getOrderId())
                            .providerReference(p.getUtr())
                            .providerTransactionId(p.getUtr())
                            .bankReference(p.getAccountNumber() + (p.getIfsc() != null ? " (" + p.getIfsc() + ")" : ""))
                            .retailerId(u != null ? u.getUsername() : p.getUserId())
                            .userName(u != null ? u.getFullName() : (p.getBeneficiaryName() != null ? p.getBeneficiaryName() : "N/A"))
                            .userMobile(u != null ? u.getMobile() : (p.getMobileNumber() != null ? p.getMobileNumber() : "N/A"))
                            .partyCode(u != null ? (u.getPartyCode() != null && !u.getPartyCode().isBlank() ? u.getPartyCode() : u.getUsername()) : "N/A")
                            .userRole(u != null && !u.getRoles().isEmpty() ? u.getRoles().iterator().next().getName().name() : "RETAILER")
                            .serviceType("PAYOUT (" + (p.getTransferMode() != null ? p.getTransferMode() : "IMPS") + ")")
                            .provider(p.getBankName() != null ? p.getBankName() : "PAYOUT_HUB")
                            .amount(p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                            .commission(p.getChargeAmount() != null ? p.getChargeAmount() : BigDecimal.ZERO)
                            .openingBalance(BigDecimal.ZERO)
                            .closingBalance(BigDecimal.ZERO)
                            .status(p.getStatus())
                            .remarks("Beneficiary: " + (p.getBeneficiaryName() != null ? p.getBeneficiaryName() : "N/A") + (p.getRemarks() != null ? " | " + p.getRemarks() : ""))
                            .createdAt(p.getCreatedAt())
                            .updatedAt(p.getUpdatedAt() != null ? p.getUpdatedAt() : p.getCreatedAt())
                            .build();
                }).collect(Collectors.toList());

                for (TransactionHistoryResponseDto dto : dtoList) {
                    BigDecimal amt = dto.getAmount() != null ? dto.getAmount() : BigDecimal.ZERO;
                    String st = dto.getStatus() != null ? dto.getStatus().toUpperCase() : "";
                    if ("SUCCESS".equals(st) || "PROCESSED".equals(st)) {
                        successCount++;
                        totalVolume = totalVolume.add(amt);
                    } else if ("PENDING".equals(st) || "INITIATED".equals(st) || "PROCESSING".equals(st)) {
                        pendingCount++;
                    } else {
                        failedCount++;
                    }
                }
                break;
            }

            case "WALLET_TRANSFER": {
                WalletTransferDtos.WalletTransferHistoryPageResponse wtRes = walletTransferService.getTransferHistory(
                        null, "ALL", cleanStatus, cleanSearch, fromDate, toDate, pageable);

                totalElements = wtRes.totalElements();
                totalPages = wtRes.totalPages();

                dtoList = (wtRes.data() != null ? wtRes.data() : Collections.<WalletTransferDtos.WalletTransferHistoryItemDto>emptyList()).stream().map(wt -> {
                    return TransactionHistoryResponseDto.builder()
                            .transactionId(wt.transferReference())
                            .providerReference(wt.senderPartyCode() + " ➔ " + wt.recipientPartyCode())
                            .providerTransactionId(wt.id())
                            .bankReference(wt.recipientMobile())
                            .retailerId(wt.senderPartyCode())
                            .userName(wt.senderName() + " ➔ " + wt.recipientName())
                            .userMobile(wt.senderMobile())
                            .partyCode(wt.senderPartyCode() + " / " + wt.recipientPartyCode())
                            .userRole(wt.recipientRole() != null ? wt.recipientRole() : "USER")
                            .serviceType("WALLET_TRANSFER")
                            .provider("RUP_WALLET")
                            .amount(wt.amount() != null ? wt.amount() : BigDecimal.ZERO)
                            .commission(wt.fee() != null ? wt.fee() : BigDecimal.ZERO)
                            .openingBalance(BigDecimal.ZERO)
                            .closingBalance(BigDecimal.ZERO)
                            .status(wt.status())
                            .remarks(wt.remarks() != null ? wt.remarks() : "Wallet to Wallet transfer")
                            .createdAt(wt.createdAt() != null ? LocalDateTime.ofInstant(wt.createdAt(), ZoneId.systemDefault()) : LocalDateTime.now())
                            .updatedAt(wt.createdAt() != null ? LocalDateTime.ofInstant(wt.createdAt(), ZoneId.systemDefault()) : LocalDateTime.now())
                            .build();
                }).collect(Collectors.toList());

                for (TransactionHistoryResponseDto dto : dtoList) {
                    BigDecimal amt = dto.getAmount() != null ? dto.getAmount() : BigDecimal.ZERO;
                    String st = dto.getStatus() != null ? dto.getStatus().toUpperCase() : "";
                    if ("SUCCESS".equals(st) || "COMPLETED".equals(st)) {
                        successCount++;
                        totalVolume = totalVolume.add(amt);
                    } else if ("PENDING".equals(st) || "INITIATED".equals(st)) {
                        pendingCount++;
                    } else {
                        failedCount++;
                    }
                }
                break;
            }

            case "UPI_CASH_WITHDRAWAL":
            case "CREDIT_CARD_BILL":
            default: {
                TransactionStatus ts = null;
                if (cleanStatus != null) {
                    try { ts = TransactionStatus.valueOf(cleanStatus.toUpperCase()); } catch (Exception ignored) {}
                }
                Page<Txn> page = txnRepository.findForAdmin(
                        null, normType, false, ts, cleanProvider, startInst, endInst, cleanSearch, pageable);

                totalElements = page.getTotalElements();
                totalPages = page.getTotalPages();

                dtoList = page.getContent().stream().map(txn -> {
                    User u = txn.getUser();
                    return TransactionHistoryResponseDto.builder()
                            .transactionId(txn.getId().toString())
                            .providerReference(txn.getProviderRef())
                            .providerTransactionId(txn.getIdempotencyKey())
                            .bankReference(txn.getProviderRef())
                            .retailerId(u != null ? u.getUsername() : "N/A")
                            .userName(u != null ? u.getFullName() : "N/A")
                            .userMobile(u != null ? u.getMobile() : "N/A")
                            .partyCode(u != null ? (u.getPartyCode() != null && !u.getPartyCode().isBlank() ? u.getPartyCode() : u.getUsername()) : "N/A")
                            .userRole(u != null && !u.getRoles().isEmpty() ? u.getRoles().iterator().next().getName().name() : "RETAILER")
                            .serviceType(txn.getServiceType())
                            .provider(txn.getProviderRef() != null ? txn.getProviderRef() : normType)
                            .amount(txn.getAmount() != null ? txn.getAmount() : BigDecimal.ZERO)
                            .commission(BigDecimal.ZERO)
                            .openingBalance(BigDecimal.ZERO)
                            .closingBalance(BigDecimal.ZERO)
                            .status(txn.getStatus() != null ? txn.getStatus().name() : "INITIATED")
                            .remarks(normType.replace("_", " "))
                            .createdAt(LocalDateTime.ofInstant(txn.getCreatedAt(), ZoneId.systemDefault()))
                            .updatedAt(LocalDateTime.ofInstant(txn.getCreatedAt(), ZoneId.systemDefault()))
                            .build();
                }).collect(Collectors.toList());

                for (TransactionHistoryResponseDto dto : dtoList) {
                    BigDecimal amt = dto.getAmount() != null ? dto.getAmount() : BigDecimal.ZERO;
                    String st = dto.getStatus() != null ? dto.getStatus().toUpperCase() : "";
                    if ("SUCCESS".equals(st) || "APPROVED".equals(st) || "COMPLETED".equals(st)) {
                        successCount++;
                        totalVolume = totalVolume.add(amt);
                    } else if ("PENDING".equals(st) || "INITIATED".equals(st)) {
                        pendingCount++;
                    } else {
                        failedCount++;
                    }
                }
                break;
            }
        }

        TransactionHistorySummaryDto summary = TransactionHistorySummaryDto.builder()
                .totalTransactions(totalElements)
                .successCount(successCount)
                .failedCount(failedCount)
                .pendingCount(pendingCount)
                .totalVolume(totalVolume)
                .cashWithdrawalVolume(cashWithdrawalVolume)
                .cashDepositVolume(cashDepositVolume)
                .commissionEarned(BigDecimal.ZERO)
                .build();

        return TransactionHistoryPageResponse.builder()
                .success(true)
                .message("Transactions loaded successfully")
                .data(dtoList)
                .summary(summary)
                .pagination(TransactionHistoryPageResponse.PaginationDetails.builder()
                        .page(pageNumber)
                        .size(pageSize)
                        .totalElements(totalElements)
                        .totalPages(totalPages)
                        .build())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TransactionHistoryResponseDto> getAllTransactionsForExport(
            String reportType,
            String search,
            String status,
            String provider,
            String fromDate,
            String toDate,
            Sort sort) {

        // For export, fetch up to 3000 records using pagination for safety
        Pageable exportPageable = PageRequest.of(0, 3000, sort != null ? sort : Sort.by(Sort.Direction.DESC, "createdAt"));
        TransactionHistoryPageResponse response = getTransactions(reportType, search, status, provider, fromDate, toDate, exportPageable);
        return response.getData() != null ? response.getData() : Collections.emptyList();
    }

    @Override
    @Transactional(readOnly = true)
    public TransactionHistoryResponseDto getTransactionDetail(String reportType, String transactionId) {
        String normType = normalizeReportType(reportType);

        if ("AEPS_FINGPAY".equals(normType) || "AEPS_LEVIN".equals(normType)) {
            Optional<AepsTransactionEngine> opt = aepsRepository.findByTransactionId(transactionId);
            if (opt.isPresent()) {
                AepsTransactionEngine t = opt.get();
                User u = t.getUserId() != null ? userRepository.findById(t.getUserId()).orElse(null) : null;
                return TransactionHistoryResponseDto.builder()
                        .transactionId(t.getTransactionId())
                        .providerReference(t.getProviderReference())
                        .providerTransactionId(t.getProviderReference())
                        .bankReference(t.getReferenceNumber())
                        .retailerId(u != null ? u.getUsername() : "N/A")
                        .userName(u != null ? u.getFullName() : t.getCreatedBy())
                        .userMobile(u != null ? u.getMobile() : "N/A")
                        .partyCode(u != null ? (u.getPartyCode() != null && !u.getPartyCode().isBlank() ? u.getPartyCode() : u.getUsername()) : "N/A")
                        .userRole(u != null && !u.getRoles().isEmpty() ? u.getRoles().iterator().next().getName().name() : "RETAILER")
                        .serviceType(t.getServiceType())
                        .provider(t.getProvider())
                        .amount(t.getAmount())
                        .status(t.getStatus())
                        .remarks(t.getProviderMessage())
                        .createdAt(t.getInitiatedAt())
                        .updatedAt(t.getCompletedAt())
                        .build();
            }
        } else if ("MOVE_TO_BANK".equals(normType)) {
            Optional<PayoutTransaction> opt = payoutRepository.findByOrderId(transactionId);
            if (opt.isPresent()) {
                PayoutTransaction p = opt.get();
                UUID uId = null;
                try { uId = UUID.fromString(p.getUserId()); } catch (Exception ignored) {}
                User u = uId != null ? userRepository.findById(uId).orElse(null) : null;
                return TransactionHistoryResponseDto.builder()
                        .transactionId(p.getOrderId())
                        .providerReference(p.getUtr())
                        .bankReference(p.getAccountNumber())
                        .retailerId(u != null ? u.getUsername() : p.getUserId())
                        .userName(u != null ? u.getFullName() : p.getBeneficiaryName())
                        .userMobile(u != null ? u.getMobile() : p.getMobileNumber())
                        .partyCode(u != null ? (u.getPartyCode() != null && !u.getPartyCode().isBlank() ? u.getPartyCode() : u.getUsername()) : "N/A")
                        .serviceType("PAYOUT (" + p.getTransferMode() + ")")
                        .provider(p.getBankName())
                        .amount(p.getAmount())
                        .commission(p.getChargeAmount())
                        .status(p.getStatus())
                        .remarks(p.getRemarks())
                        .createdAt(p.getCreatedAt())
                        .updatedAt(p.getUpdatedAt())
                        .build();
            }
        }

        // Generic fallback by Txn ID or Recharge
        try {
            UUID uuid = UUID.fromString(transactionId);
            Optional<Txn> txnOpt = txnRepository.findById(uuid);
            if (txnOpt.isPresent()) {
                Txn t = txnOpt.get();
                User u = t.getUser();
                return TransactionHistoryResponseDto.builder()
                        .transactionId(t.getId().toString())
                        .providerReference(t.getProviderRef())
                        .serviceType(t.getServiceType())
                        .amount(t.getAmount())
                        .status(t.getStatus().name())
                        .userName(u != null ? u.getFullName() : "N/A")
                        .userMobile(u != null ? u.getMobile() : "N/A")
                        .partyCode(u != null ? (u.getPartyCode() != null && !u.getPartyCode().isBlank() ? u.getPartyCode() : u.getUsername()) : "N/A")
                        .createdAt(LocalDateTime.ofInstant(t.getCreatedAt(), ZoneId.systemDefault()))
                        .build();
            }
        } catch (Exception ignored) {}

        return null;
    }
}
