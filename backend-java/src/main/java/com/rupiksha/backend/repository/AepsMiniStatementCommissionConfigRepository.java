package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.AepsMiniStatementCommissionConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AepsMiniStatementCommissionConfigRepository extends JpaRepository<AepsMiniStatementCommissionConfig, UUID> {

    @Query("SELECT c FROM AepsMiniStatementCommissionConfig c JOIN FETCH c.plan p ORDER BY p.price ASC")
    List<AepsMiniStatementCommissionConfig> findAllWithPlan();

    Optional<AepsMiniStatementCommissionConfig> findByPlan_Id(UUID planId);

    Optional<AepsMiniStatementCommissionConfig> findByPlan_PlanCode(String planCode);
}

