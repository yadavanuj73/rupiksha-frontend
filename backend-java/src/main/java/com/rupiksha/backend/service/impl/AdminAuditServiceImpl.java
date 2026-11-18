package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.AdminAuthDtos;
import com.rupiksha.backend.domain.AdminAuthAuditEventType;
import com.rupiksha.backend.domain.AdminAuthAuditLog;
import com.rupiksha.backend.repository.AdminAuthAuditLogRepository;
import com.rupiksha.backend.service.AdminAuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuditServiceImpl implements AdminAuditService {

    private final AdminAuthAuditLogRepository auditLogRepository;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logEvent(
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
    ) {
        try {
            AdminAuthAuditLog auditLog = new AdminAuthAuditLog();
            auditLog.setEventId(UUID.randomUUID().toString());
            auditLog.setAdminUserId(adminUserId);
            auditLog.setAdminUsername(adminUsername != null ? adminUsername.trim() : "anonymous");
            auditLog.setAdminRole(adminRole != null ? adminRole.trim() : "UNKNOWN");
            auditLog.setEventType(eventType);
            auditLog.setEventTimestamp(Instant.now());
            auditLog.setMaskedDestination(sanitizeMaskedDestination(maskedDestination));
            auditLog.setChallengeId(challengeId);
            auditLog.setSourceIp(sourceIp != null ? sourceIp.trim() : "unknown");
            auditLog.setUserAgent(truncate(userAgent, 500));
            auditLog.setCorrelationId(correlationId);
            auditLog.setOutcome(outcome != null ? outcome.trim() : "UNKNOWN");
            auditLog.setFailureReason(truncate(failureReason, 255));
            auditLog.setSessionId(sessionId);
            auditLog.setAuthVersion(authVersion);
            auditLog.setMetadata(sanitizeMetadata(metadata));

            auditLogRepository.saveAndFlush(auditLog);

            log.info("ADMIN_AUTH_AUDIT: event={}, user={}, role={}, outcome={}, dest={}, ip={}, reason={}",
                    eventType, auditLog.getAdminUsername(), auditLog.getAdminRole(),
                    outcome, auditLog.getMaskedDestination(), sourceIp, failureReason);
        } catch (Exception e) {
            log.error("Failed to persist admin authentication audit event: {}", e.getMessage(), e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AdminAuthDtos.AdminAuditLogView> getAuditLogs(Pageable pageable) {
        return auditLogRepository.findAllByOrderByEventTimestampDesc(pageable)
                .map(this::toView);
    }

    private AdminAuthDtos.AdminAuditLogView toView(AdminAuthAuditLog log) {
        return new AdminAuthDtos.AdminAuditLogView(
                log.getEventId(),
                log.getAdminUserId(),
                log.getAdminUsername(),
                log.getAdminRole(),
                log.getEventType() != null ? log.getEventType().name() : null,
                log.getEventTimestamp(),
                log.getMaskedDestination(),
                log.getChallengeId(),
                log.getSourceIp(),
                log.getUserAgent(),
                log.getOutcome(),
                log.getFailureReason(),
                log.getAuthVersion()
        );
    }

    private String sanitizeMaskedDestination(String dest) {
        if (dest == null || dest.isBlank()) return null;
        if (dest.startsWith("XXXXXXX")) return dest;
        return AdminDestinationService.maskNumber(dest);
    }

    private String sanitizeMetadata(String metadata) {
        if (metadata == null) return null;
        // Never allow raw tokens, passwords or OTPs in metadata
        return metadata.replaceAll("(?i)(password|otp|secret|token)=[^,\\s&]+", "$1=***");
    }

    private String truncate(String val, int maxLen) {
        if (val == null) return null;
        return val.length() <= maxLen ? val : val.substring(0, maxLen);
    }
}
