package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.AepsTransactionHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AepsTransactionHistoryRepository extends JpaRepository<AepsTransactionHistory, Long> {
    List<AepsTransactionHistory> findByTransactionId(String transactionId);
}
