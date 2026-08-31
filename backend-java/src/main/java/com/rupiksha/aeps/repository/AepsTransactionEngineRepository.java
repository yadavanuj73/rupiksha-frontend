package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
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
           "AND (:serviceType IS NULL OR UPPER(t.serviceType) = UPPER(:serviceType)) " +
           "AND (:status IS NULL OR UPPER(t.status) = UPPER(:status)) " +
           "AND (:provider IS NULL OR LOWER(t.provider) = LOWER(:provider)) " +
           "AND (:startDate IS NULL OR t.initiatedAt >= :startDate) " +
           "AND (:endDate IS NULL OR t.initiatedAt <= :endDate) " +
           "AND (:search IS NULL OR lower(t.transactionId) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.referenceNumber) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.providerReference) LIKE lower(concat('%', :search, '%')))")
    Page<AepsTransactionEngine> findWithFilters(
            UUID userId,
            String serviceType,
            String status,
            String provider,
            LocalDateTime startDate,
            LocalDateTime endDate,
            String search,
            Pageable pageable);

    @Query("SELECT t FROM AepsTransactionEngine t WHERE t.userId = :userId " +
           "AND (:serviceType IS NULL OR UPPER(t.serviceType) = UPPER(:serviceType)) " +
           "AND (:status IS NULL OR UPPER(t.status) = UPPER(:status)) " +
           "AND (:provider IS NULL OR LOWER(t.provider) = LOWER(:provider)) " +
           "AND (:startDate IS NULL OR t.initiatedAt >= :startDate) " +
           "AND (:endDate IS NULL OR t.initiatedAt <= :endDate) " +
           "AND (:search IS NULL OR lower(t.transactionId) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.referenceNumber) LIKE lower(concat('%', :search, '%')) " +
           "OR lower(t.providerReference) LIKE lower(concat('%', :search, '%')))")
    List<AepsTransactionEngine> findAllWithFilters(
            UUID userId,
            String serviceType,
            String status,
            String provider,
            LocalDateTime startDate,
            LocalDateTime endDate,
            String search,
            Sort sort);
}

