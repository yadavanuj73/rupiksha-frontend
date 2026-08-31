package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDateTime;

@Repository
public interface AepsTransactionEngineRepository extends JpaRepository<AepsTransactionEngine, Long> {
    Optional<AepsTransactionEngine> findByTransactionId(String transactionId);
    boolean existsByTransactionId(String transactionId);

    @Query("SELECT t FROM AepsTransactionEngine t WHERE t.userId = :userId " +
           "AND (cast(:serviceType as string) IS NULL OR UPPER(t.serviceType) = UPPER(cast(:serviceType as string))) " +
           "AND (cast(:status as string) IS NULL OR UPPER(t.status) = UPPER(cast(:status as string))) " +
           "AND (cast(:provider as string) IS NULL OR LOWER(t.provider) = LOWER(cast(:provider as string))) " +
           "AND (cast(:startDate as timestamp) IS NULL OR t.initiatedAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR t.initiatedAt <= :endDate) " +
           "AND (cast(:search as string) IS NULL OR " +
           "lower(t.transactionId) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.referenceNumber) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.providerReference) LIKE concat('%', lower(cast(:search as string)), '%'))")
    Page<AepsTransactionEngine> findWithFilters(
            @Param("userId") UUID userId,
            @Param("serviceType") String serviceType,
            @Param("status") String status,
            @Param("provider") String provider,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("search") String search,
            Pageable pageable);

    @Query("SELECT t FROM AepsTransactionEngine t WHERE t.userId = :userId " +
           "AND (cast(:serviceType as string) IS NULL OR UPPER(t.serviceType) = UPPER(cast(:serviceType as string))) " +
           "AND (cast(:status as string) IS NULL OR UPPER(t.status) = UPPER(cast(:status as string))) " +
           "AND (cast(:provider as string) IS NULL OR LOWER(t.provider) = LOWER(cast(:provider as string))) " +
           "AND (cast(:startDate as timestamp) IS NULL OR t.initiatedAt >= :startDate) " +
           "AND (cast(:endDate as timestamp) IS NULL OR t.initiatedAt <= :endDate) " +
           "AND (cast(:search as string) IS NULL OR " +
           "lower(t.transactionId) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.referenceNumber) LIKE concat('%', lower(cast(:search as string)), '%') OR " +
           "lower(t.providerReference) LIKE concat('%', lower(cast(:search as string)), '%'))")
    List<AepsTransactionEngine> findAllWithFilters(
            @Param("userId") UUID userId,
            @Param("serviceType") String serviceType,
            @Param("status") String status,
            @Param("provider") String provider,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("search") String search,
            Sort sort);
}


