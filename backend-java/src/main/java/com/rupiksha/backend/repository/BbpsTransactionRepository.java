package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.BbpsTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface BbpsTransactionRepository extends JpaRepository<BbpsTransaction, UUID> {
    Optional<BbpsTransaction> findByIdempotencyKey(String idempotencyKey);
    Optional<BbpsTransaction> findByMerchantRefNo(String merchantRefNo);
    Optional<BbpsTransaction> findByProviderTxnId(String providerTxnId);
    Optional<BbpsTransaction> findByRequestId(String requestId);

    @Query("SELECT b FROM BbpsTransaction b WHERE (:userId IS NULL OR b.user.id = :userId) " +
           "AND (:status IS NULL OR b.status = :status) " +
           "AND (:category IS NULL OR b.category = :category) " +
           "AND (cast(:startDate as timestamp) IS NULL OR b.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR b.createdAt <= :endDate) " +
           "AND (:search IS NULL OR " +
           "     lower(b.mobileNumber) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "     lower(coalesce(b.consumerNumber, '')) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "     lower(b.merchantRefNo) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "     lower(coalesce(b.providerTxnId, '')) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "     lower(b.billerName) LIKE concat('%', lower(cast(:search as string)), '%'))")
    Page<BbpsTransaction> findWithFilters(
            @Param("userId") UUID userId,
            @Param("status") String status,
            @Param("category") String category,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("SELECT COUNT(b) FROM BbpsTransaction b WHERE (:userId IS NULL OR b.user.id = :userId) " +
           "AND (:category IS NULL OR b.category = :category) " +
           "AND (:status IS NULL OR b.status = :status)")
    long countByUserCategoryAndStatus(@Param("userId") UUID userId, @Param("category") String category, @Param("status") String status);

    @Query("SELECT COUNT(b) FROM BbpsTransaction b WHERE (:userId IS NULL OR b.user.id = :userId) " +
           "AND (:status IS NULL OR b.status = :status)")
    long countByUserAndStatus(@Param("userId") UUID userId, @Param("status") String status);
}
