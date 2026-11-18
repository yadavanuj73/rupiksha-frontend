package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.AdminAuthAuditLog;
import com.rupiksha.backend.domain.AdminAuthAuditEventType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface AdminAuthAuditLogRepository extends JpaRepository<AdminAuthAuditLog, Long> {

    Page<AdminAuthAuditLog> findAllByOrderByEventTimestampDesc(Pageable pageable);

    List<AdminAuthAuditLog> findByAdminUserIdOrderByEventTimestampDesc(UUID adminUserId);

    List<AdminAuthAuditLog> findByEventTypeOrderByEventTimestampDesc(AdminAuthAuditEventType eventType);

    long countBySourceIpAndEventTimestampAfterAndOutcome(String sourceIp, Instant after, String outcome);

    long countByAdminUserIdAndEventTimestampAfterAndOutcome(UUID adminUserId, Instant after, String outcome);
}
