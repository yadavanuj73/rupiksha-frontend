package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.AdminAuthDtos;
import com.rupiksha.backend.domain.AdminAuthAuditEventType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface AdminAuditService {

    void logEvent(
            AdminAuthAuditEventType eventType,
            UUID adminUserId,
            String adminUsername,
            String adminRole,
            String maskedDestination,
            String challengeId,
            String sourceIp,
            String userAgent,
            String correlationId,
            String outcome,
            String failureReason,
            String sessionId,
            Integer authVersion,
            String metadata
    );

    Page<AdminAuthDtos.AdminAuditLogView> getAuditLogs(Pageable pageable);
}
