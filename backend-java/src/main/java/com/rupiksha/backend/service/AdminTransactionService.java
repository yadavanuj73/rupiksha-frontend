package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.TransactionHistoryPageResponse;
import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
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

    List<TransactionHistoryResponseDto> getAllTransactionsForExport(
            String reportType,
            String search,
            String status,
            String provider,
            String fromDate,
            String toDate,
            Sort sort);

    TransactionHistoryResponseDto getTransactionDetail(String reportType, String transactionId);
}
