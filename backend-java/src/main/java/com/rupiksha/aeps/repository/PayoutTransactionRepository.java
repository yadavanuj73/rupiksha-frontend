package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.PayoutTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
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
}

// Made with Bob
