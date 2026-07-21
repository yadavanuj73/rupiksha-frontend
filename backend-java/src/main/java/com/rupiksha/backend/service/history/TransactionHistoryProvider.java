package com.rupiksha.backend.service.history;

import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.api.dto.TransactionHistorySummaryDto;
import com.rupiksha.backend.domain.TransactionReportType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface TransactionHistoryProvider {
    boolean supports(TransactionReportType reportType);

    Page<TransactionHistoryResponseDto> fetchHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Pageable pageable);

    List<TransactionHistoryResponseDto> fetchAllHistory(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate, Sort sort);

    TransactionHistorySummaryDto fetchSummary(
            TransactionReportType reportType,
            UUID userId, String search, String status, String provider,
            LocalDateTime fromDate, LocalDateTime toDate);
}
