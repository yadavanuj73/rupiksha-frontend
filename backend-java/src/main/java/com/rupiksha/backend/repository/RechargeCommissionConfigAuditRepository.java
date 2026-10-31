package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.RechargeCommissionConfigAudit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RechargeCommissionConfigAuditRepository extends JpaRepository<RechargeCommissionConfigAudit, UUID> {

    List<RechargeCommissionConfigAudit> findByServiceTypeAndOperatorCodeOrderByCreatedAtDesc(String serviceType, String operatorCode);

    Page<RechargeCommissionConfigAudit> findByServiceTypeAndOperatorCodeOrderByCreatedAtDesc(String serviceType, String operatorCode, Pageable pageable);
}

