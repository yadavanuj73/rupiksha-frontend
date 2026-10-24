package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.FingpayCmsTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FingpayCmsTransactionRepository extends JpaRepository<FingpayCmsTransaction, UUID> {

    Optional<FingpayCmsTransaction> findByFpTransactionId(String fpTransactionId);

    Optional<FingpayCmsTransaction> findByMerchantTransactionId(String merchantTransactionId);

    List<FingpayCmsTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId);

    @Query("SELECT t FROM FingpayCmsTransaction t WHERE (:userId IS NULL OR t.user.id = :userId) " +
           "AND (cast(:status as string) IS NULL OR t.internalStatus = cast(:status as string)) " +
           "AND (cast(:startDate as timestamp) IS NULL OR t.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR t.createdAt <= :endDate) " +
           "AND (cast(:search as string) IS NULL OR lower(t.merchantTransactionId) LIKE concat('%', lower(cast(:search as string)), '%') " +
           "     OR lower(t.fpTransactionId) LIKE concat('%', lower(cast(:search as string)), '%') " +
           "     OR lower(t.bcLoginId) LIKE concat('%', lower(cast(:search as string)), '%') " +
           "     OR (t.remarks IS NOT NULL AND lower(t.remarks) LIKE concat('%', lower(cast(:search as string)), '%')))")
    Page<FingpayCmsTransaction> findWithFilters(
            @Param("userId") UUID userId,
            @Param("status") String status,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            @Param("search") String search,
            Pageable pageable);

    @Query("SELECT t FROM FingpayCmsTransaction t WHERE (:userId IS NULL OR t.user.id = :userId) " +
           "AND (cast(:status as string) IS NULL OR t.internalStatus = cast(:status as string)) " +
           "AND (cast(:startDate as timestamp) IS NULL OR t.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR t.createdAt <= :endDate) " +
           "AND (cast(:search as string) IS NULL OR lower(t.merchantTransactionId) LIKE concat('%', lower(cast(:search as string)), '%') " +
           "     OR lower(t.fpTransactionId) LIKE concat('%', lower(cast(:search as string)), '%') " +
           "     OR lower(t.bcLoginId) LIKE concat('%', lower(cast(:search as string)), '%') " +
           "     OR (t.remarks IS NOT NULL AND lower(t.remarks) LIKE concat('%', lower(cast(:search as string)), '%')))")
    List<FingpayCmsTransaction> findAllWithFilters(
            @Param("userId") UUID userId,
            @Param("status") String status,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            @Param("search") String search,
            Sort sort);

    @Query("SELECT COUNT(t) FROM FingpayCmsTransaction t WHERE (:userId IS NULL OR t.user.id = :userId) AND (cast(:status as string) IS NULL OR t.internalStatus = cast(:status as string))")
    long countByUserIdAndStatus(@Param("userId") UUID userId, @Param("status") String status);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM FingpayCmsTransaction t WHERE (:userId IS NULL OR t.user.id = :userId) AND t.internalStatus = 'SUCCESS'")
    BigDecimal sumSuccessfulVolume(@Param("userId") UUID userId);
}
