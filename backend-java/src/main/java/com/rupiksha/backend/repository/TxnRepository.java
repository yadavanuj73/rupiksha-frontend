package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.Txn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface TxnRepository extends JpaRepository<Txn, UUID> {
    Optional<Txn> findByIdempotencyKey(String idempotencyKey);
    Optional<Txn> findByProviderRef(String providerRef);
    List<Txn> findByUserIdOrderByCreatedAtDesc(UUID userId);
    
    Optional<Txn> findTopByUserIdAndServiceTypeOrderByCreatedAtDesc(UUID userId, String serviceType);
    Integer countByUserIdAndServiceType(UUID userId, String serviceType);
}

