package com.rupiksha.backend.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionHistoryPageResponse {
    private boolean success;
    private String message;
    private List<TransactionHistoryResponseDto> data;
    private TransactionHistorySummaryDto summary;
    private PaginationDetails pagination;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PaginationDetails {
        private int page;
        private int size;
        private long totalElements;
        private int totalPages;
    }
}
