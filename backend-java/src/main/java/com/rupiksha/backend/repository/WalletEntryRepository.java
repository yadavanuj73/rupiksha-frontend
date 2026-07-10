package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.WalletEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

import com.rupiksha.backend.domain.WalletTransactionStatus;
import com.rupiksha.backend.domain.WalletTransactionContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

public interface WalletEntryRepository extends JpaRepository<WalletEntry, UUID> {
    Optional<WalletEntry> findByIdempotencyKey(String idempotencyKey);

    @Query("select coalesce(sum(e.tds), 0) from WalletEntry e where :userId is null or e.wallet.user.id = :userId")
    BigDecimal sumTdsByUserId(UUID userId);

    @Query("select coalesce(sum(e.gst), 0) from WalletEntry e where :userId is null or e.wallet.user.id = :userId")
    BigDecimal sumGstByUserId(UUID userId);

    @Query("select e from WalletEntry e where " +
           "(:walletId is null or e.wallet.id = :walletId) and " +
           "(:status is null or e.status = :status) and " +
           "(:context is null or e.transactionContext = :context) and " +
           "(:entryType is null or e.entryType = :entryType) and " +
           "(:startDate is null or e.createdAt >= :startDate) and " +
           "(:endDate is null or e.createdAt <= :endDate) and " +
           "(:search is null or lower(e.narration) like :search or lower(e.referenceId) like :search or lower(e.wallet.user.username) like :search)")
    Page<WalletEntry> findWithFilters(
            UUID walletId,
            WalletTransactionStatus status,
            WalletTransactionContext context,
            String entryType,
            java.time.Instant startDate,
            java.time.Instant endDate,
            String search,
            Pageable pageable);
}

