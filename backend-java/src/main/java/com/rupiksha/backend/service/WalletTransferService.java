package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.WalletTransferDtos;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface WalletTransferService {
    WalletTransferDtos.RecipientLookupResponse searchRecipient(String mobile, UUID currentUserId);

    WalletTransferDtos.WalletTransferResponse transferFunds(
            WalletTransferDtos.WalletTransferRequest request,
            UUID currentUserId,
            String clientIp,
            String idempotencyKey
    );

    WalletTransferDtos.WalletTransferResponse getTransferDetails(String transferReference, UUID currentUserId);

    WalletTransferDtos.WalletTransferHistoryPageResponse getTransferHistory(
            UUID currentUserId,
            String direction,
            String status,
            String search,
            String startDate,
            String endDate,
            Pageable pageable
    );
}
