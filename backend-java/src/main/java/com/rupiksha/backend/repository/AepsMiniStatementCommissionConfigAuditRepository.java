package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.AepsMiniStatementCommissionConfigAudit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AepsMiniStatementCommissionConfigAuditRepository extends JpaRepository<AepsMiniStatementCommissionConfigAudit, UUID> {

    List<AepsMiniStatementCommissionConfigAudit> findAllByOrderByCreatedAtDesc();

    Page<AepsMiniStatementCommissionConfigAudit> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<AepsMiniStatementCommissionConfigAudit> findByPlanCodeOrderByCreatedAtDesc(String planCode);
}

