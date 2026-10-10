package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.WalletTransfer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface WalletTransferRepository extends JpaRepository<WalletTransfer, UUID> {
    Optional<WalletTransfer> findByTransferReference(String transferReference);

    Optional<WalletTransfer> findByIdempotencyKey(String idempotencyKey);

    @Query("SELECT wt FROM WalletTransfer wt " +
           "WHERE (:userId IS NULL OR wt.sender.id = :userId OR wt.recipient.id = :userId) " +
           "AND (:direction IS NULL " +
           "     OR (:direction = 'SENT' AND wt.sender.id = :userId) " +
           "     OR (:direction = 'RECEIVED' AND wt.recipient.id = :userId)) " +
           "AND (:status IS NULL OR wt.status = :status) " +
           "AND (:startDate IS NULL OR wt.createdAt >= :startDate) " +
           "AND (:endDate IS NULL OR wt.createdAt <= :endDate) " +
           "AND (:search IS NULL OR " +
           "     LOWER(wt.transferReference) LIKE :search OR " +
           "     LOWER(wt.sender.fullName) LIKE :search OR " +
           "     LOWER(wt.recipient.fullName) LIKE :search OR " +
           "     LOWER(wt.sender.partyCode) LIKE :search OR " +
           "     LOWER(wt.recipient.partyCode) LIKE :search OR " +
           "     LOWER(wt.sender.mobile) LIKE :search OR " +
           "     LOWER(wt.recipient.mobile) LIKE :search OR " +
           "     LOWER(coalesce(wt.remarks, '')) LIKE :search) " +
           "ORDER BY wt.createdAt DESC")
    Page<WalletTransfer> findTransfersForUser(
            @Param("userId") UUID userId,
            @Param("direction") String direction,
            @Param("status") String status,
            @Param("search") String search,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            Pageable pageable
    );
}
