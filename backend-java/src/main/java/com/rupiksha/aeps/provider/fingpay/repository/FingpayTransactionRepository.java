package com.rupiksha.aeps.provider.fingpay.repository;

import com.rupiksha.aeps.provider.fingpay.entity.FingpayTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface FingpayTransactionRepository extends JpaRepository<FingpayTransaction, Long> {

    Optional<FingpayTransaction> findByTxnid(String txnid);

    @Query("SELECT t FROM FingpayTransaction t WHERE t.uid = :uid " +
           "AND (cast(:status as string) IS NULL OR t.status = cast(:status as string)) " +
           "AND (cast(:startDate as timestamp) IS NULL OR t.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR t.createdAt <= :endDate) " +
           "AND (cast(:search as string) IS NULL OR " +
           "lower(t.txnid) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.ftxnin) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.aadhar) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.mobile) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.rrn) LIKE concat('%', lower(cast(:search as string)), '%'))")
    Page<FingpayTransaction> findWithFilters(
            @Param("uid") Long uid,
            @Param("status") String status,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("search") String search,
            Pageable pageable);

    @Query("SELECT t FROM FingpayTransaction t WHERE t.uid = :uid " +
           "AND (cast(:status as string) IS NULL OR t.status = cast(:status as string)) " +
           "AND (cast(:startDate as timestamp) IS NULL OR t.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR t.createdAt <= :endDate) " +
           "AND (cast(:search as string) IS NULL OR " +
           "lower(t.txnid) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.ftxnin) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.aadhar) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.mobile) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.rrn) LIKE concat('%', lower(cast(:search as string)), '%'))")
    List<FingpayTransaction> findAllWithFilters(
            @Param("uid") Long uid,
            @Param("status") String status,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("search") String search,
            Sort sort);
}
