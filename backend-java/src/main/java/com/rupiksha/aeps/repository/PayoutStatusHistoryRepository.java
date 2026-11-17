package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.PayoutStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PayoutStatusHistoryRepository extends JpaRepository<PayoutStatusHistory, Long> {

    List<PayoutStatusHistory> findByOrderIdOrderByCreatedAtDesc(String orderId);

    List<PayoutStatusHistory> findByOrderIdOrderByCreatedAtAsc(String orderId);

    List<PayoutStatusHistory> findByPayoutTransactionIdOrderByCreatedAtDesc(Long payoutTransactionId);

    List<PayoutStatusHistory> findByUserIdOrderByCreatedAtDesc(String userId);
}
