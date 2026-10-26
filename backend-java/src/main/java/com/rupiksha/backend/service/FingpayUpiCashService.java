package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.FingpayUpiCashDtos.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.UUID;

public interface FingpayUpiCashService {

    InitiateResponse initiatePayment(UUID userId, InitiateRequest request, String ipAddress);

    StatusCheckResponse checkStatus(UUID userId, StatusCheckRequest request, String ipAddress);

    CallbackResponse processCallback(String rawBody, String hashHeader, String ipAddress);

    ThreeWayReconResponse reconcile(UUID userId, UUID transactionId, String ipAddress);

    Page<TransactionDetailResponse> getHistory(UUID userId, String status, String search, String startDate, String endDate, Pageable pageable);

    List<TransactionDetailResponse> getHistoryForExport(UUID userId, String status, String search, String startDate, String endDate, Sort sort);

    HistorySummaryResponse getHistorySummary(UUID userId);

    TransactionDetailResponse getTransactionDetail(UUID userId, UUID transactionId);

    MerchantInfoResponse getMerchantInfo(UUID userId);
}

