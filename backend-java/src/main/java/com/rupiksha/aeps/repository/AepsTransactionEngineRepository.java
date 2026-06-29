package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AepsTransactionEngineRepository extends JpaRepository<AepsTransactionEngine, Long> {
    Optional<AepsTransactionEngine> findByTransactionId(String transactionId);
    boolean existsByTransactionId(String transactionId);
}
