package com.rupiksha.aeps.provider.fingpay.repository;

import com.rupiksha.aeps.provider.fingpay.entity.FingpayTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface FingpayTransactionRepository extends JpaRepository<FingpayTransaction, Long> {

    Optional<FingpayTransaction> findByTxnid(String txnid);

    @Query("SELECT t FROM FingpayTransaction t WHERE t.uid = :uid " +
           "AND (:status IS NULL OR t.status = :status) " +
           "AND (:startDate IS NULL OR t.createdAt >= :startDate) " +
           "AND (:endDate IS NULL OR t.createdAt <= :endDate) " +
           "AND (:search IS NULL OR lower(t.txnid) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.ftxnin) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.aadhar) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.mobile) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.rrn) LIKE lower(concat('%', :search, '%')))")
    Page<FingpayTransaction> findWithFilters(
            Long uid,
            String status,
            LocalDateTime startDate,
            LocalDateTime endDate,
            String search,
            Pageable pageable);

    @Query("SELECT t FROM FingpayTransaction t WHERE t.uid = :uid " +
           "AND (:status IS NULL OR t.status = :status) " +
           "AND (:startDate IS NULL OR t.createdAt >= :startDate) " +
           "AND (:endDate IS NULL OR t.createdAt <= :endDate) " +
           "AND (:search IS NULL OR lower(t.txnid) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.ftxnin) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.aadhar) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.mobile) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.rrn) LIKE lower(concat('%', :search, '%')))")
    List<FingpayTransaction> findAllWithFilters(
            Long uid,
            String status,
            LocalDateTime startDate,
            LocalDateTime endDate,
            String search,
            Sort sort);
}