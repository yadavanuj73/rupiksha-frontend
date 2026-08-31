package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.CommissionSlab;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CommissionSlabRepository extends JpaRepository<CommissionSlab, UUID> {

    List<CommissionSlab> findByCommissionPlanIdOrderByMinAmountAsc(UUID commissionPlanId);

    @Query("SELECT s FROM CommissionSlab s WHERE s.commissionPlan.id = :planId AND s.enabled = true AND :amount >= s.minAmount AND :amount <= s.maxAmount ORDER BY s.minAmount ASC")
    List<CommissionSlab> findMatchingSlabs(@Param("planId") UUID planId, @Param("amount") BigDecimal amount);

    void deleteByCommissionPlanId(UUID commissionPlanId);
}
