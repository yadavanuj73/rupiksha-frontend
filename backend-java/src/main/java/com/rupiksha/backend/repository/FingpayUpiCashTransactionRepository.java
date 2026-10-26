package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.FingpayUpiCashTransaction;
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

public interface FingpayUpiCashTransactionRepository extends JpaRepository<FingpayUpiCashTransaction, UUID> {

    Optional<FingpayUpiCashTransaction> findByPartnerRequestId(String partnerRequestId);

    Optional<FingpayUpiCashTransaction> findByFpTransactionId(String fpTransactionId);

    @Query("SELECT t FROM FingpayUpiCashTransaction t WHERE t.partnerRequestId = :ref OR t.fpTransactionId = :ref")
    Optional<FingpayUpiCashTransaction> findByAnyReference(@Param("ref") String ref);

    List<FingpayUpiCashTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId);

    @Query("SELECT t FROM FingpayUpiCashTransaction t WHERE (:userId IS NULL OR t.user.id = :userId) " +
           "AND (cast(:status as string) IS NULL OR t.internalStatus = cast(:status as string)) " +
           "AND (cast(:startDate as timestamp) IS NULL OR t.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR t.createdAt <= :endDate) " +
           "AND (cast(:search as string) IS NULL OR lower(t.partnerRequestId) LIKE concat('%', lower(cast(:search as string)), '%') " +
           "     OR (t.fpTransactionId IS NOT NULL AND lower(t.fpTransactionId) LIKE concat('%', lower(cast(:search as string)), '%')) " +
           "     OR (t.bankRrn IS NOT NULL AND lower(t.bankRrn) LIKE concat('%', lower(cast(:search as string)), '%')) " +
           "     OR (t.payerName IS NOT NULL AND lower(t.payerName) LIKE concat('%', lower(cast(:search as string)), '%')) " +
           "     OR (t.payerVpa IS NOT NULL AND lower(t.payerVpa) LIKE concat('%', lower(cast(:search as string)), '%')) " +
           "     OR lower(t.bcLoginId) LIKE concat('%', lower(cast(:search as string)), '%'))")
    Page<FingpayUpiCashTransaction> findWithFilters(
            @Param("userId") UUID userId,
            @Param("status") String status,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            @Param("search") String search,
            Pageable pageable);

    @Query("SELECT t FROM FingpayUpiCashTransaction t WHERE (:userId IS NULL OR t.user.id = :userId) " +
           "AND (cast(:status as string) IS NULL OR t.internalStatus = cast(:status as string)) " +
           "AND (cast(:startDate as timestamp) IS NULL OR t.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR t.createdAt <= :endDate) " +
           "AND (cast(:search as string) IS NULL OR lower(t.partnerRequestId) LIKE concat('%', lower(cast(:search as string)), '%') " +
           "     OR (t.fpTransactionId IS NOT NULL AND lower(t.fpTransactionId) LIKE concat('%', lower(cast(:search as string)), '%')) " +
           "     OR (t.bankRrn IS NOT NULL AND lower(t.bankRrn) LIKE concat('%', lower(cast(:search as string)), '%')) " +
           "     OR (t.payerName IS NOT NULL AND lower(t.payerName) LIKE concat('%', lower(cast(:search as string)), '%')) " +
           "     OR (t.payerVpa IS NOT NULL AND lower(t.payerVpa) LIKE concat('%', lower(cast(:search as string)), '%')) " +
           "     OR lower(t.bcLoginId) LIKE concat('%', lower(cast(:search as string)), '%'))")
    List<FingpayUpiCashTransaction> findAllWithFilters(
            @Param("userId") UUID userId,
            @Param("status") String status,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            @Param("search") String search,
            Sort sort);

    @Query("SELECT COUNT(t) FROM FingpayUpiCashTransaction t WHERE (:userId IS NULL OR t.user.id = :userId) AND (cast(:status as string) IS NULL OR t.internalStatus = cast(:status as string))")
    long countByUserIdAndStatus(@Param("userId") UUID userId, @Param("status") String status);

    @Query("SELECT COUNT(t) FROM FingpayUpiCashTransaction t WHERE (:userId IS NULL OR t.user.id = :userId)")
    long countAllByUserId(@Param("userId") UUID userId);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM FingpayUpiCashTransaction t WHERE (:userId IS NULL OR t.user.id = :userId) AND t.internalStatus = 'SUCCESS'")
    BigDecimal sumSuccessfulVolume(@Param("userId") UUID userId);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM FingpayUpiCashTransaction t WHERE t.user.id = :userId AND t.internalStatus = 'SUCCESS' AND t.createdAt >= :startOfDay")
    BigDecimal sumTodaySuccessfulVolume(@Param("userId") UUID userId, @Param("startOfDay") Instant startOfDay);
}
