package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.Recharge;
import com.rupiksha.backend.domain.TransactionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RechargeRepository extends JpaRepository<Recharge, UUID> {
    Optional<Recharge> findByMerchantRefNo(String merchantRefNo);

    @Query("SELECT r FROM Recharge r WHERE (:userId IS NULL OR r.user.id = :userId) " +
           "AND (cast(:status as string) IS NULL OR r.status = :status) " +
           "AND (cast(:startDate as timestamp) IS NULL OR r.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR r.createdAt <= :endDate) " +
           "AND (cast(:search as string) IS NULL OR " +
           "lower(r.merchantRefNo) LIKE lower(concat('%', cast(:search as string), '%')) OR " +
           "lower(r.mobileNo) LIKE lower(concat('%', cast(:search as string)), '%') OR " +
           "lower(coalesce(r.operatorTxnId, '')) LIKE lower(concat('%', cast(:search as string)), '%') OR " +
           "lower(r.user.mobile) LIKE lower(concat('%', cast(:search as string)), '%') OR " +
           "lower(coalesce(r.user.partyCode, '')) LIKE lower(concat('%', cast(:search as string)), '%') OR " +
           "lower(r.user.username) LIKE lower(concat('%', cast(:search as string)), '%') OR " +
           "lower(r.user.fullName) LIKE lower(concat('%', cast(:search as string)), '%'))")
    Page<Recharge> findForAdmin(
            @Param("userId") UUID userId,
            @Param("status") TransactionStatus status,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            @Param("search") String search,
            Pageable pageable);

    @Query("SELECT r FROM Recharge r WHERE (:userId IS NULL OR r.user.id = :userId) " +
           "AND (cast(:status as string) IS NULL OR r.status = :status) " +
           "AND (cast(:startDate as timestamp) IS NULL OR r.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR r.createdAt <= :endDate) " +
           "AND (cast(:search as string) IS NULL OR " +
           "lower(r.merchantRefNo) LIKE lower(concat('%', cast(:search as string)), '%') OR " +
           "lower(r.mobileNo) LIKE lower(concat('%', cast(:search as string)), '%') OR " +
           "lower(coalesce(r.operatorTxnId, '')) LIKE lower(concat('%', cast(:search as string)), '%') OR " +
           "lower(r.user.mobile) LIKE lower(concat('%', cast(:search as string)), '%') OR " +
           "lower(coalesce(r.user.partyCode, '')) LIKE lower(concat('%', cast(:search as string)), '%') OR " +
           "lower(r.user.username) LIKE lower(concat('%', cast(:search as string)), '%') OR " +
           "lower(r.user.fullName) LIKE lower(concat('%', cast(:search as string)), '%'))")
    List<Recharge> findAllForAdmin(
            @Param("userId") UUID userId,
            @Param("status") TransactionStatus status,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            @Param("search") String search,
            Sort sort);
}
