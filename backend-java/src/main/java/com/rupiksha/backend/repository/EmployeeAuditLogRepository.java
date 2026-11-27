package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.EmployeeAuditLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EmployeeAuditLogRepository extends JpaRepository<EmployeeAuditLog, UUID> {
    List<EmployeeAuditLog> findByEmployeeIdOrderByCreatedAtDesc(UUID employeeId, Pageable pageable);

    List<EmployeeAuditLog> findTop200ByOrderByCreatedAtDesc();
}
