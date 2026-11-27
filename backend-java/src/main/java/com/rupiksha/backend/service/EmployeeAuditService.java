package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.domain.Employee;
import com.rupiksha.backend.domain.EmployeeAuditLog;
import com.rupiksha.backend.repository.EmployeeAuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmployeeAuditService {

    private final EmployeeAuditLogRepository auditLogRepository;

    public void log(
            Employee employee,
            String actorType,
            String actorId,
            String actorUsername,
            String eventType,
            UUID targetUserId,
            UUID targetEmployeeId,
            String details,
            String ipAddress,
            String userAgent,
            String outcome
    ) {
        EmployeeAuditLog log = new EmployeeAuditLog();
        if (employee != null) {
            log.setEmployeeId(employee.getId());
            log.setEmployeeUsername(employee.getUsername());
        }
        log.setActorType(actorType == null ? "SYSTEM" : actorType);
        log.setActorId(actorId);
        log.setActorUsername(actorUsername);
        log.setEventType(eventType);
        log.setTargetUserId(targetUserId);
        log.setTargetEmployeeId(targetEmployeeId);
        log.setDetails(sanitizeDetails(details));
        log.setIpAddress(truncate(ipAddress, 64));
        log.setUserAgent(truncate(userAgent, 500));
        log.setOutcome(outcome == null ? "SUCCESS" : outcome);
        auditLogRepository.save(log);
    }

    public List<EmployeeDtos.EmployeeAuditLogView> getRecentForEmployee(UUID employeeId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        return auditLogRepository.findByEmployeeIdOrderByCreatedAtDesc(employeeId, PageRequest.of(0, safeLimit))
                .stream()
                .map(this::toView)
                .toList();
    }

    public List<EmployeeDtos.EmployeeAuditLogView> getRecentAll() {
        return auditLogRepository.findTop200ByOrderByCreatedAtDesc()
                .stream()
                .map(this::toView)
                .toList();
    }

    private EmployeeDtos.EmployeeAuditLogView toView(EmployeeAuditLog log) {
        return new EmployeeDtos.EmployeeAuditLogView(
                log.getId() != null ? log.getId().toString() : null,
                log.getEmployeeId() != null ? log.getEmployeeId().toString() : null,
                log.getEmployeeUsername(),
                log.getActorType(),
                log.getActorId(),
                log.getActorUsername(),
                log.getEventType(),
                log.getTargetUserId() != null ? log.getTargetUserId().toString() : null,
                log.getTargetEmployeeId() != null ? log.getTargetEmployeeId().toString() : null,
                log.getDetails(),
                log.getIpAddress(),
                log.getOutcome(),
                log.getCreatedAt()
        );
    }

    private String sanitizeDetails(String raw) {
        if (raw == null) return null;
        return raw.replaceAll("(?i)(password|token|otp|secret)=\\S+", "$1=[REDACTED]");
    }

    private String truncate(String val, int maxLen) {
        if (val == null) return null;
        return val.length() <= maxLen ? val : val.substring(0, maxLen);
    }
}
