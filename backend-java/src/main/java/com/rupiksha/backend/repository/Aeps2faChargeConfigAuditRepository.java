package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.Aeps2faChargeConfigAudit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface Aeps2faChargeConfigAuditRepository extends JpaRepository<Aeps2faChargeConfigAudit, UUID> {

    List<Aeps2faChargeConfigAudit> findByPlanIdOrderByCreatedAtDesc(UUID planId);

    Page<Aeps2faChargeConfigAudit> findAllByOrderByCreatedAtDesc(Pageable pageable);
}

