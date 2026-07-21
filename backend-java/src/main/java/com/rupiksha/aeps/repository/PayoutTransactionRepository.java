package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.PayoutTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
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
           "AND (:status IS NULL OR t.status = :status) " +
           "AND (:startDate IS NULL OR t.createdAt >= :startDate) " +
           "AND (:endDate IS NULL OR t.createdAt <= :endDate) " +
           "AND (:search IS NULL OR lower(t.orderId) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.utr) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.beneficiaryName) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.accountNumber) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.mobileNumber) LIKE lower(concat('%', :search, '%')))")
    Page<PayoutTransaction> findWithFilters(
            String userId,
            String status,
            LocalDateTime startDate,
            LocalDateTime endDate,
            String search,
            Pageable pageable);

    @Query("SELECT t FROM PayoutTransaction t WHERE t.userId = :userId " +
           "AND (:status IS NULL OR t.status = :status) " +
           "AND (:startDate IS NULL OR t.createdAt >= :startDate) " +
           "AND (:endDate IS NULL OR t.createdAt <= :endDate) " +
           "AND (:search IS NULL OR lower(t.orderId) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.utr) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.beneficiaryName) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.accountNumber) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.mobileNumber) LIKE lower(concat('%', :search, '%')))")
    List<PayoutTransaction> findAllWithFilters(
            String userId,
            String status,
            LocalDateTime startDate,
            LocalDateTime endDate,
            String search,
            Sort sort);
}


// Made with Bob
