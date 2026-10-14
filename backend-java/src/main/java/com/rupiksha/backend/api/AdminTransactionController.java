package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.TransactionHistoryPageResponse;
import com.rupiksha.backend.api.dto.TransactionHistoryResponseDto;
import com.rupiksha.backend.service.AdminTransactionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping({"/api/v1/admin/transactions", "/admin/transactions", "/api/admin/transactions"})
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_DISTRIBUTOR', 'DISTRIBUTOR')")
@CrossOrigin(origins = {"http://localhost:5173", "https://your-frontend.vercel.app"})
public class AdminTransactionController {

    private final AdminTransactionService adminTransactionService;

    @GetMapping("/history")
    public ResponseEntity<TransactionHistoryPageResponse> getTransactions(
            @RequestParam(defaultValue = "AEPS_FINGPAY") String reportType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String provider,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false, defaultValue = "createdAt") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection
    ) {
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String sortField = "date".equalsIgnoreCase(sortBy) ? "createdAt" : sortBy;
        Sort sort = Sort.by(direction, sortField);
        Pageable pageable = PageRequest.of(page, size, sort);

        TransactionHistoryPageResponse response = adminTransactionService.getTransactions(
                reportType, search, status, provider, fromDate, toDate, pageable);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/history/export")
    public ResponseEntity<List<TransactionHistoryResponseDto>> exportTransactions(
            @RequestParam(defaultValue = "AEPS_FINGPAY") String reportType,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String provider,
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false, defaultValue = "createdAt") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection
    ) {
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String sortField = "date".equalsIgnoreCase(sortBy) ? "createdAt" : sortBy;
        Sort sort = Sort.by(direction, sortField);

        List<TransactionHistoryResponseDto> list = adminTransactionService.getAllTransactionsForExport(
                reportType, search, status, provider, fromDate, toDate, sort);

        return ResponseEntity.ok(list);
    }

    @GetMapping("/history/{transactionId}")
    public ResponseEntity<Map<String, Object>> getTransactionDetail(
            @RequestParam(defaultValue = "AEPS_FINGPAY") String reportType,
            @PathVariable String transactionId
    ) {
        TransactionHistoryResponseDto dto = adminTransactionService.getTransactionDetail(reportType, transactionId);
        if (dto == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("success", true, "data", dto));
    }
}
