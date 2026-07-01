package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.WalletDtos;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.rupiksha.backend.domain.WalletTransactionContext;

public interface WalletService {
    // Basic & Admin listings
    WalletDtos.WalletBalanceResponse getBalance(String userId);
    List<WalletDtos.WalletBalanceResponse> getWalletsList(UUID currentUserId);
    
    // Core balance operations
    WalletDtos.WalletBalanceResponse credit(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey);
    WalletDtos.WalletBalanceResponse debit(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey);
    WalletDtos.WalletBalanceResponse lock(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey);
    WalletDtos.WalletBalanceResponse release(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey);
    WalletDtos.WalletBalanceResponse giveCommission(WalletDtos.CommissionRequest request, UUID operatorId, String ipAddress, String idempotencyKey);
    WalletDtos.WalletBalanceResponse updateWalletStatus(WalletDtos.WalletStatusUpdateRequest request, UUID adminId, String ipAddress);

    // Dynamic tax aggregate summary
    WalletDtos.TaxSummaryResponse getTaxSummary(UUID currentUserId);

    // Fund requests management
    WalletDtos.FundRequestResponse createFundRequest(WalletDtos.FundRequestCreateRequest request, UUID currentUserId);
    List<WalletDtos.FundRequestResponse> getFundRequests(UUID currentUserId);
    WalletDtos.FundRequestResponse approveFundRequest(UUID requestId, UUID adminId, String ipAddress);
    WalletDtos.FundRequestResponse rejectFundRequest(UUID requestId, UUID adminId, String ipAddress);

    // History and reporting
    Page<WalletDtos.WalletHistoryEntryResponse> getLedgerHistory(
            UUID currentUserId,
            String type,
            String context,
            String status,
            String search,
            String startDate,
            String endDate,
            Pageable pageable);
    
    byte[] exportLedgerHistory(
            UUID currentUserId,
            String type,
            String context,
            String status,
            String search,
            String startDate,
            String endDate);

    // Service-reusable balance mutation entrypoints (AEPS, BBPS, Recharge, DMT, Payout)
    WalletDtos.WalletBalanceResponse debitForService(
            UUID userId,
            BigDecimal amount,
            String narration,
            WalletTransactionContext context,
            String serviceName,
            String ipAddress,
            String idempotencyKey);

    WalletDtos.WalletBalanceResponse creditForService(
            UUID userId,
            BigDecimal amount,
            String narration,
            WalletTransactionContext context,
            String serviceName,
            String ipAddress,
            String idempotencyKey);

    WalletDtos.WalletBalanceResponse refundForService(
            UUID userId,
            BigDecimal amount,
            String narration,
            String parentReferenceNumber,
            WalletTransactionContext context,
            String serviceName,
            String ipAddress,
            String idempotencyKey);
}

