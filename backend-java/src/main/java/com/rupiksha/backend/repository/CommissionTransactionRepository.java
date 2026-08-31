package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.CommissionTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CommissionTransactionRepository extends JpaRepository<CommissionTransaction, UUID> {

    List<CommissionTransaction> findByOriginalTransactionId(String originalTransactionId);

    boolean existsByOriginalTransactionIdAndBeneficiaryUserIdAndBeneficiaryRole(
            String originalTransactionId,
            UUID beneficiaryUserId,
            String beneficiaryRole
    );

    boolean existsByOriginalTransactionId(String originalTransactionId);

    Optional<CommissionTransaction> findByCommissionReference(String commissionReference);

    Page<CommissionTransaction> findByBeneficiaryUserId(UUID beneficiaryUserId, Pageable pageable);

    @Query(value = "SELECT ct FROM CommissionTransaction ct " +
            "LEFT JOIN FETCH ct.beneficiaryUser " +
            "LEFT JOIN FETCH ct.retailerUser " +
            "WHERE " +
            "(:beneficiaryId IS NULL OR ct.beneficiaryUser.id = :beneficiaryId) AND " +
            "(:serviceType IS NULL OR ct.serviceType = :serviceType) AND " +
            "(:status IS NULL OR ct.status = :status) AND " +
            "(:planCode IS NULL OR ct.planCode = :planCode) AND " +
            "(:startDate IS NULL OR ct.createdAt >= :startDate) AND " +
            "(:endDate IS NULL OR ct.createdAt <= :endDate) AND " +
            "(:search IS NULL OR LOWER(ct.originalTransactionId) LIKE LOWER(CAST(:search AS string)) OR LOWER(ct.commissionReference) LIKE LOWER(CAST(:search AS string)) OR LOWER(ct.beneficiaryUser.username) LIKE LOWER(CAST(:search AS string)) OR LOWER(ct.beneficiaryUser.fullName) LIKE LOWER(CAST(:search AS string)))",
           countQuery = "SELECT COUNT(ct) FROM CommissionTransaction ct WHERE " +
            "(:beneficiaryId IS NULL OR ct.beneficiaryUser.id = :beneficiaryId) AND " +
            "(:serviceType IS NULL OR ct.serviceType = :serviceType) AND " +
            "(:status IS NULL OR ct.status = :status) AND " +
            "(:planCode IS NULL OR ct.planCode = :planCode) AND " +
            "(:startDate IS NULL OR ct.createdAt >= :startDate) AND " +
            "(:endDate IS NULL OR ct.createdAt <= :endDate) AND " +
            "(:search IS NULL OR LOWER(ct.originalTransactionId) LIKE LOWER(CAST(:search AS string)) OR LOWER(ct.commissionReference) LIKE LOWER(CAST(:search AS string)) OR LOWER(ct.beneficiaryUser.username) LIKE LOWER(CAST(:search AS string)) OR LOWER(ct.beneficiaryUser.fullName) LIKE LOWER(CAST(:search AS string)))")
    Page<CommissionTransaction> findWithFilters(
            @Param("beneficiaryId") UUID beneficiaryId,
            @Param("serviceType") String serviceType,
            @Param("status") String status,
            @Param("planCode") String planCode,
            @Param("startDate") Instant startDate,
            @Param("endDate") Instant endDate,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("SELECT COALESCE(SUM(ct.commissionAmount), 0) FROM CommissionTransaction ct WHERE ct.beneficiaryUser.id = :userId AND ct.status = 'SUCCESS'")
    BigDecimal sumTotalCommissionByBeneficiaryId(@Param("userId") UUID userId);

    @Query("SELECT COALESCE(SUM(ct.commissionAmount), 0) FROM CommissionTransaction ct WHERE ct.beneficiaryUser.id = :userId AND ct.status = 'SUCCESS' AND ct.createdAt >= :start AND ct.createdAt <= :end")
    BigDecimal sumCommissionByBeneficiaryIdAndDateRange(
            @Param("userId") UUID userId,
            @Param("start") Instant start,
            @Param("end") Instant end
    );

    @Query("SELECT COALESCE(SUM(ct.commissionAmount), 0) FROM CommissionTransaction ct WHERE ct.beneficiaryUser.id = :userId AND ct.serviceType = :serviceType AND ct.status = 'SUCCESS'")
    BigDecimal sumCommissionByBeneficiaryIdAndServiceType(
            @Param("userId") UUID userId,
            @Param("serviceType") String serviceType
    );
}
