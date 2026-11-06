package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.Aeps2faChargeConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface Aeps2faChargeConfigRepository extends JpaRepository<Aeps2faChargeConfig, UUID> {

    Optional<Aeps2faChargeConfig> findByPlan_Id(UUID planId);

    Optional<Aeps2faChargeConfig> findByPlan_PlanCode(String planCode);

    List<Aeps2faChargeConfig> findAllByOrderByCreatedAtAsc();
}

