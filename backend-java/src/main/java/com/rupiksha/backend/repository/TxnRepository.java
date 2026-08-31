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
           "AND (cast(:serviceType as string) IS NULL OR t.serviceType = cast(:serviceType as string) OR (:isBbps = true AND t.serviceType LIKE 'BBPS_%')) " +
           "AND (cast(:status as string) IS NULL OR t.status = :status) " +
           "AND (cast(:startDate as timestamp) IS NULL OR t.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR t.createdAt <= :endDate) " +
           "AND (cast(:provider as string) IS NULL OR lower(t.providerRef) = lower(cast(:provider as string)) OR lower(t.serviceType) LIKE lower(concat('%', cast(:provider as string), '%')) OR (cast(:provider as string) = 'Airtel' AND lower(t.providerRef) LIKE '%airtel%') OR (cast(:provider as string) = 'Fingpay' AND lower(t.providerRef) LIKE '%fingpay%')) " +
           "AND (cast(:search as string) IS NULL OR lower(t.providerRef) LIKE lower(concat('%', cast(:search as string), '%')) OR lower(t.idempotencyKey) LIKE lower(concat('%', cast(:search as string), '%')))")
    Page<Txn> findWithFilters(
            @org.springframework.data.repository.query.Param("userId") UUID userId,
            @org.springframework.data.repository.query.Param("serviceType") String serviceType,
            @org.springframework.data.repository.query.Param("isBbps") Boolean isBbps,
            @org.springframework.data.repository.query.Param("status") TransactionStatus status,
            @org.springframework.data.repository.query.Param("provider") String provider,
            @org.springframework.data.repository.query.Param("startDate") Instant startDate,
            @org.springframework.data.repository.query.Param("endDate") Instant endDate,
            @org.springframework.data.repository.query.Param("search") String search,
            Pageable pageable);

    @Query("SELECT t FROM Txn t WHERE t.user.id = :userId " +
           "AND (cast(:serviceType as string) IS NULL OR t.serviceType = cast(:serviceType as string) OR (:isBbps = true AND t.serviceType LIKE 'BBPS_%')) " +
           "AND (cast(:status as string) IS NULL OR t.status = :status) " +
           "AND (cast(:startDate as timestamp) IS NULL OR t.createdAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR t.createdAt <= :endDate) " +
           "AND (cast(:provider as string) IS NULL OR lower(t.providerRef) = lower(cast(:provider as string)) OR lower(t.serviceType) LIKE lower(concat('%', cast(:provider as string), '%')) OR (cast(:provider as string) = 'Airtel' AND lower(t.providerRef) LIKE '%airtel%') OR (cast(:provider as string) = 'Fingpay' AND lower(t.providerRef) LIKE '%fingpay%')) " +
           "AND (cast(:search as string) IS NULL OR lower(t.providerRef) LIKE lower(concat('%', cast(:search as string), '%')) OR lower(t.idempotencyKey) LIKE lower(concat('%', cast(:search as string), '%')))")
    List<Txn> findAllWithFilters(
            @org.springframework.data.repository.query.Param("userId") UUID userId,
            @org.springframework.data.repository.query.Param("serviceType") String serviceType,
            @org.springframework.data.repository.query.Param("isBbps") Boolean isBbps,
            @org.springframework.data.repository.query.Param("status") TransactionStatus status,
            @org.springframework.data.repository.query.Param("provider") String provider,
            @org.springframework.data.repository.query.Param("startDate") Instant startDate,
            @org.springframework.data.repository.query.Param("endDate") Instant endDate,
            @org.springframework.data.repository.query.Param("search") String search,
            Sort sort);
}



