package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.CommissionTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CommissionTransactionRepository extends JpaRepository<CommissionTransaction, UUID>, JpaSpecificationExecutor<CommissionTransaction> {

    List<CommissionTransaction> findByOriginalTransactionId(String originalTransactionId);

    boolean existsByOriginalTransactionIdAndBeneficiaryUserIdAndBeneficiaryRole(
            String originalTransactionId,
            UUID beneficiaryUserId,
            String beneficiaryRole
    );

    boolean existsByOriginalTransactionId(String originalTransactionId);

    Optional<CommissionTransaction> findByCommissionReference(String commissionReference);

    Page<CommissionTransaction> findByBeneficiaryUser_Id(UUID beneficiaryUserId, Pageable pageable);

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
