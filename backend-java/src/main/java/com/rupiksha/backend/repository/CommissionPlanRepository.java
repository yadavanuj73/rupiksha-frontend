package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.CommissionPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CommissionPlanRepository extends JpaRepository<CommissionPlan, UUID> {

    List<CommissionPlan> findByServiceTypeOrderByPriceAsc(String serviceType);

    Optional<CommissionPlan> findByServiceTypeAndPlanCode(String serviceType, String planCode);

    Optional<CommissionPlan> findByServiceTypeAndIsDefaultTrue(String serviceType);

    @Query("SELECT p FROM CommissionPlan p LEFT JOIN FETCH p.slabs s WHERE p.id = :id ORDER BY s.minAmount ASC")
    Optional<CommissionPlan> findByIdWithSlabs(@Param("id") UUID id);

    @Query("SELECT DISTINCT p FROM CommissionPlan p LEFT JOIN FETCH p.slabs s WHERE p.serviceType = :serviceType ORDER BY p.price ASC, s.minAmount ASC")
    List<CommissionPlan> findByServiceTypeWithSlabs(@Param("serviceType") String serviceType);
}
