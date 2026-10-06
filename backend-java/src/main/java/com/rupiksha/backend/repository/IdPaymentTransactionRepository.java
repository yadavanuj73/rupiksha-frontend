package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.IdPaymentStatus;
import com.rupiksha.backend.domain.IdPaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface IdPaymentTransactionRepository extends JpaRepository<IdPaymentTransaction, UUID> {
    Optional<IdPaymentTransaction> findByRazorpayOrderId(String razorpayOrderId);
    Optional<IdPaymentTransaction> findTopByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<IdPaymentTransaction> findTopByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, IdPaymentStatus status);
    List<IdPaymentTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<IdPaymentTransaction> findByStatusOrderByCreatedAtDesc(IdPaymentStatus status);
}
