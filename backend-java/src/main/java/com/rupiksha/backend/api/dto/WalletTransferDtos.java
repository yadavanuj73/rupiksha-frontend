package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class WalletTransferDtos {

    public record RecipientLookupResponse(
            String id,
            String fullName,
            String businessName,
            String mobile,
            String partyCode,
            String role,
            String city,
            String stateName,
            String addressLine1,
            String status,
            boolean eligible,
            String message
    ) {}

    public record WalletTransferRequest(
            String recipientMobile,
            String recipientId,
            @NotNull @DecimalMin(value = "1.00", message = "Transfer amount must be at least ₹1.00")
            BigDecimal amount,
            String remarks,
            String idempotencyKey
    ) {}

    public record WalletTransferResponse(
            String transferReference,
            String senderId,
            String senderName,
            String senderPartyCode,
            String recipientId,
            String recipientName,
            String recipientBusinessName,
            String recipientPartyCode,
            String recipientMobile,
            String recipientRole,
            BigDecimal amount,
            BigDecimal fee,
            BigDecimal totalDebit,
            BigDecimal recipientCredit,
            String status,
            String remarks,
            Instant createdAt,
            BigDecimal senderBalance
    ) {}

    public record WalletTransferHistoryItemDto(
            String id,
            String transferReference,
            String direction,
            String senderId,
            String senderName,
            String senderPartyCode,
            String senderMobile,
            String recipientId,
            String recipientName,
            String recipientPartyCode,
            String recipientMobile,
            String recipientRole,
            BigDecimal amount,
            BigDecimal fee,
            BigDecimal totalDebit,
            BigDecimal recipientCredit,
            String status,
            String remarks,
            Instant createdAt
    ) {}

    public record WalletTransferHistoryPageResponse(
            boolean success,
            String message,
            List<WalletTransferHistoryItemDto> data,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {}
}
