package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.TransactionHistoryPageResponse;
import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.domain.TransactionReportType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface TransactionHistoryService {
    TransactionHistoryPageResponse getHistory(
            TransactionReportType reportType,
            UUID userId,
            String search,
            String status,
            String provider,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            Pageable pageable);

    List<TransactionHistoryResponseDto> getAllHistory(
            TransactionReportType reportType,
            UUID userId,
            String search,
            String status,
            String provider,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            Sort sort);

    TransactionHistoryResponseDto getTransactionDetail(UUID userId, String transactionId);
}
