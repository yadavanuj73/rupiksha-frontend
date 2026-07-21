package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.Txn;
import com.rupiksha.backend.domain.TransactionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TxnRepository extends JpaRepository<Txn, UUID> {
    Optional<Txn> findByIdempotencyKey(String idempotencyKey);
    Optional<Txn> findByProviderRef(String providerRef);
    List<Txn> findByUserIdOrderByCreatedAtDesc(UUID userId);
    
    Optional<Txn> findTopByUserIdAndServiceTypeOrderByCreatedAtDesc(UUID userId, String serviceType);
    Integer countByUserIdAndServiceType(UUID userId, String serviceType);

    @Query("SELECT t FROM Txn t WHERE t.user.id = :userId " +
           "AND (:serviceType IS NULL OR t.serviceType = :serviceType OR (:isBbps = true AND t.serviceType LIKE 'BBPS_%')) " +
           "AND (:status IS NULL OR t.status = :status) " +
           "AND (:startDate IS NULL OR t.createdAt >= :startDate) " +
           "AND (:endDate IS NULL OR t.createdAt <= :endDate) " +
           "AND (:provider IS NULL OR lower(t.providerRef) = lower(:provider) OR lower(t.serviceType) LIKE lower(concat('%', :provider, '%')) OR (:provider = 'Airtel' AND lower(t.providerRef) LIKE '%airtel%') OR (:provider = 'Fingpay' AND lower(t.providerRef) LIKE '%fingpay%')) " +
           "AND (:search IS NULL OR lower(t.providerRef) LIKE lower(concat('%', :search, '%')) OR lower(t.idempotencyKey) LIKE lower(concat('%', :search, '%')))")
    Page<Txn> findWithFilters(
            UUID userId,
            String serviceType,
            Boolean isBbps,
            TransactionStatus status,
            String provider,
            Instant startDate,
            Instant endDate,
            String search,
            Pageable pageable);

    @Query("SELECT t FROM Txn t WHERE t.user.id = :userId " +
           "AND (:serviceType IS NULL OR t.serviceType = :serviceType OR (:isBbps = true AND t.serviceType LIKE 'BBPS_%')) " +
           "AND (:status IS NULL OR t.status = :status) " +
           "AND (:startDate IS NULL OR t.createdAt >= :startDate) " +
           "AND (:endDate IS NULL OR t.createdAt <= :endDate) " +
           "AND (:provider IS NULL OR lower(t.providerRef) = lower(:provider) OR lower(t.serviceType) LIKE lower(concat('%', :provider, '%')) OR (:provider = 'Airtel' AND lower(t.providerRef) LIKE '%airtel%') OR (:provider = 'Fingpay' AND lower(t.providerRef) LIKE '%fingpay%')) " +
           "AND (:search IS NULL OR lower(t.providerRef) LIKE lower(concat('%', :search, '%')) OR lower(t.idempotencyKey) LIKE lower(concat('%', :search, '%')))")
    List<Txn> findAllWithFilters(
            UUID userId,
            String serviceType,
            Boolean isBbps,
            TransactionStatus status,
            String provider,
            Instant startDate,
            Instant endDate,
            String search,
            Sort sort);
}


