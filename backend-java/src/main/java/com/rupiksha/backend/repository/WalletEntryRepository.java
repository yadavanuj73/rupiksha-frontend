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
    java.util.List<WalletEntry> findByWalletId(UUID walletId);

    @Query("select coalesce(sum(e.tds), 0) from WalletEntry e where :userId is null or e.wallet.user.id = :userId")
    BigDecimal sumTdsByUserId(@org.springframework.data.repository.query.Param("userId") UUID userId);

    @Query("select coalesce(sum(e.gst), 0) from WalletEntry e where :userId is null or e.wallet.user.id = :userId")
    BigDecimal sumGstByUserId(@org.springframework.data.repository.query.Param("userId") UUID userId);

    @Query("select e from WalletEntry e where " +
           "e.wallet.id = coalesce(:walletId, e.wallet.id) and " +
           "e.status = coalesce(:status, e.status) and " +
           "(:context is null or e.transactionContext = :context) and " +
           "e.entryType = coalesce(:entryType, e.entryType) and " +
           "e.createdAt >= coalesce(:startDate, e.createdAt) and " +
           "e.createdAt <= coalesce(:endDate, e.createdAt) and " +
           "(lower(e.narration) like :search or lower(e.referenceId) like :search or lower(e.wallet.user.username) like :search)")
    Page<WalletEntry> findWithFilters(
            @org.springframework.data.repository.query.Param("walletId") UUID walletId,
            @org.springframework.data.repository.query.Param("status") WalletTransactionStatus status,
            @org.springframework.data.repository.query.Param("context") WalletTransactionContext context,
            @org.springframework.data.repository.query.Param("entryType") String entryType,
            @org.springframework.data.repository.query.Param("startDate") java.time.Instant startDate,
            @org.springframework.data.repository.query.Param("endDate") java.time.Instant endDate,
            @org.springframework.data.repository.query.Param("search") String search,
            Pageable pageable);
}


