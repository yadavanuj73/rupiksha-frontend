package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.FundRequestAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FundRequestAuditLogRepository extends JpaRepository<FundRequestAuditLog, UUID> {
    List<FundRequestAuditLog> findByFundRequestIdOrderByCreatedAtDesc(UUID fundRequestId);
}
