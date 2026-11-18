package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.TransactionHistoryPageResponse;
import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.security.JwtPrincipal;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.List;

public interface AdminTransactionService {
    TransactionHistoryPageResponse getTransactions(
            String reportType,
            String search,
            String status,
            String provider,
            String fromDate,
            String toDate,
            Pageable pageable);

    default TransactionHistoryPageResponse getTransactions(
            String reportType,
            String search,
            String status,
            String provider,
            String fromDate,
            String toDate,
            Pageable pageable,
            JwtPrincipal principal) {
        return getTransactions(reportType, search, status, provider, fromDate, toDate, pageable);
    }

    List<TransactionHistoryResponseDto> getAllTransactionsForExport(
            String reportType,
            String search,
            String status,
            String provider,
            String fromDate,
            String toDate,
            Sort sort);

    default List<TransactionHistoryResponseDto> getAllTransactionsForExport(
            String reportType,
            String search,
            String status,
            String provider,
            String fromDate,
            String toDate,
            Sort sort,
            JwtPrincipal principal) {
        return getAllTransactionsForExport(reportType, search, status, provider, fromDate, toDate, sort);
    }

    TransactionHistoryResponseDto getTransactionDetail(String reportType, String transactionId);

    default TransactionHistoryResponseDto getTransactionDetail(
            String reportType,
            String transactionId,
            JwtPrincipal principal) {
        return getTransactionDetail(reportType, transactionId);
    }
}
