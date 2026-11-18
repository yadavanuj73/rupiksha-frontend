package com.rupiksha.backend.service;

import com.rupiksha.backend.domain.SmsDeliveryLog;
import com.rupiksha.backend.repository.SmsDeliveryLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SmsDeliveryService {

    private final SmsDeliveryLogRepository logRepository;

    @Transactional
    public SmsDeliveryLog recordOutboundSms(
            String clientSmsId,
            String providerMessageId,
            String mobile,
            String senderId,
            String status,
            String rawPayload
    ) {
        String cleanMobile = mobile != null ? mobile.replaceAll("[^0-9]", "") : "";
        String masked = cleanMobile.length() >= 10
                ? cleanMobile.substring(0, 2) + "XXXXXX" + cleanMobile.substring(cleanMobile.length() - 2)
                : "UNKNOWN";

        SmsDeliveryLog entry = new SmsDeliveryLog();
        entry.setClientSmsId(clientSmsId);
        entry.setProviderMessageId(providerMessageId);
        entry.setMobileMasked(masked);
        entry.setSenderId(senderId);
        entry.setStatus(status != null ? status.toUpperCase() : "ACCEPTED");
        entry.setRawPayload(rawPayload);
        entry.setCreatedAt(Instant.now());
        entry.setUpdatedAt(Instant.now());

        return logRepository.save(entry);
    }

    @Transactional
    public void handleDeliveryCallback(Map<String, ?> params) {
        if (params == null || params.isEmpty()) {
            log.warn("Empty SMS delivery callback received");
            return;
        }

        String messageId = getVal(params, "messageid", "messageId", "msgid");
        String clientSmsId = getVal(params, "clientsmsid", "clientSmsId");
        String errorStatus = getVal(params, "errorstatus", "errorStatus", "status");
        String deliveryTime = getVal(params, "deliverytime", "deliveryTime");
        String errorCode = getVal(params, "errorcode", "errorCode");
        String errorReason = getVal(params, "errorreason", "errorReason", "reason");
        String senderId = getVal(params, "senderid", "senderId");
        String mobile = getVal(params, "mobileno", "mobileNo", "mobile");

        String masked = mobile.length() >= 10
                ? mobile.substring(0, 2) + "XXXXXX" + mobile.substring(mobile.length() - 2)
                : "UNKNOWN";

        log.info("Processing DoveSoft delivery callback: msgId={}, clientSmsId={}, status={}, reason={}, mobile={}",
                messageId, clientSmsId, errorStatus, errorReason, masked);

        // Map status: DELIVRD vs UNDELIVRD
        String normalizedStatus = "ACCEPTED";
        if (errorStatus != null) {
            String upper = errorStatus.toUpperCase();
            if (upper.contains("DELIVRD") || "SUCCESS".equals(upper) || "DELIVERED".equals(upper)) {
                normalizedStatus = "DELIVRD";
            } else if (upper.contains("UNDELIV") || "FAILED".equals(upper) || "REJECTED".equals(upper)) {
                normalizedStatus = "UNDELIVRD";
            } else {
                normalizedStatus = upper;
            }
        }

        SmsDeliveryLog logEntry = null;
        if (!clientSmsId.isBlank()) {
            logEntry = logRepository.findByClientSmsId(clientSmsId).orElse(null);
        }
        if (logEntry == null && !messageId.isBlank()) {
            logEntry = logRepository.findByProviderMessageId(messageId).orElse(null);
        }

        if (logEntry == null) {
            logEntry = new SmsDeliveryLog();
            logEntry.setClientSmsId(!clientSmsId.isBlank() ? clientSmsId : null);
            logEntry.setProviderMessageId(!messageId.isBlank() ? messageId : null);
            logEntry.setMobileMasked(masked);
            logEntry.setSenderId(senderId);
            logEntry.setCreatedAt(Instant.now());
        }

        logEntry.setStatus(normalizedStatus);
        if (!errorCode.isBlank()) logEntry.setErrorCode(errorCode);
        if (!errorReason.isBlank()) logEntry.setErrorReason(errorReason);
        if (!deliveryTime.isBlank()) logEntry.setDeliveryTime(deliveryTime);
        logEntry.setRawPayload(params.toString());
        logEntry.setUpdatedAt(Instant.now());

        logRepository.save(logEntry);
        log.info("Saved SMS delivery report: status={}, msgId={}", normalizedStatus, messageId);
    }

    private String getVal(Map<String, ?> map, String... keys) {
        for (String k : keys) {
            Object v = map.get(k);
            if (v != null && !String.valueOf(v).isBlank() && !"null".equalsIgnoreCase(String.valueOf(v))) {
                return String.valueOf(v).trim();
            }
        }
        return "";
    }
}
