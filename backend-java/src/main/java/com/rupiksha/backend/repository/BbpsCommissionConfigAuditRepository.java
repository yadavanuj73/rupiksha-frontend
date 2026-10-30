package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.BbpsCommissionConfigAudit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BbpsCommissionConfigAuditRepository extends JpaRepository<BbpsCommissionConfigAudit, UUID> {

    List<BbpsCommissionConfigAudit> findByServiceIdOrderByCreatedAtDesc(String serviceId);

    Page<BbpsCommissionConfigAudit> findByServiceIdOrderByCreatedAtDesc(String serviceId, Pageable pageable);
}

