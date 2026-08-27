package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.PayoutTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PayoutTransactionRepository extends JpaRepository<PayoutTransaction, Long> {
    
    Optional<PayoutTransaction> findByOrderId(String orderId);
    
    List<PayoutTransaction> findByUserId(String userId);
    
    List<PayoutTransaction> findByUserIdAndStatus(String userId, String status);
    
    List<PayoutTransaction> findByUserIdAndCreatedAtBetween(
        String userId, 
        LocalDateTime startDate, 
        LocalDateTime endDate
    );
    
    List<PayoutTransaction> findByStatus(String status);
    
    boolean existsByOrderId(String orderId);

    @Query("SELECT t FROM PayoutTransaction t WHERE t.userId = :userId " +
           "AND (cast(:status as string) IS NULL OR t.status = :status) " +
           "AND (cast(:startDate as timestamp) IS NULL OR t.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR t.createdAt <= :endDate) " +
           "AND (cast(:search as string) IS NULL OR " +
           "lower(t.orderId) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.utr) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.beneficiaryName) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.accountNumber) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.mobileNumber) LIKE concat('%', lower(cast(:search as string)), '%'))")
    Page<PayoutTransaction> findWithFilters(
            @Param("userId") String userId,
            @Param("status") String status,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("search") String search,
            Pageable pageable);

    @Query("SELECT t FROM PayoutTransaction t WHERE t.userId = :userId " +
           "AND (cast(:status as string) IS NULL OR t.status = :status) " +
           "AND (cast(:startDate as timestamp) IS NULL OR t.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR t.createdAt <= :endDate) " +
           "AND (cast(:search as string) IS NULL OR " +
           "lower(t.orderId) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.utr) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.beneficiaryName) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.accountNumber) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.mobileNumber) LIKE concat('%', lower(cast(:search as string)), '%'))")
    List<PayoutTransaction> findAllWithFilters(
            @Param("userId") String userId,
            @Param("status") String status,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("search") String search,
            Sort sort);

    @Query("SELECT COUNT(t), COALESCE(SUM(t.amount), 0) FROM PayoutTransaction t " +
           "WHERE t.createdAt >= :startDate AND t.createdAt <= :endDate AND t.status IN ('SUCCESS', 'PENDING', 'INITIATED')")
    List<Object[]> getAggregatedStats(
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate);
}
