package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.BbpsCommissionConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BbpsCommissionConfigRepository extends JpaRepository<BbpsCommissionConfig, UUID> {

    @Query("SELECT c FROM BbpsCommissionConfig c JOIN FETCH c.plan p WHERE c.serviceId = :serviceId ORDER BY p.price ASC")
    List<BbpsCommissionConfig> findByServiceIdWithPlan(@Param("serviceId") String serviceId);

    List<BbpsCommissionConfig> findByServiceId(String serviceId);

    Optional<BbpsCommissionConfig> findByServiceIdAndPlan_PlanCode(String serviceId, String planCode);

    Optional<BbpsCommissionConfig> findByServiceIdAndPlan_Id(String serviceId, UUID planId);

    boolean existsByServiceId(String serviceId);

    @Query("SELECT DISTINCT c.serviceId FROM BbpsCommissionConfig c")
    List<String> findDistinctServiceIds();
}

