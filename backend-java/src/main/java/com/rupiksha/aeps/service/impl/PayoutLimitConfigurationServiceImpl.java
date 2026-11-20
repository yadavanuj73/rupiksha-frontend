package com.rupiksha.aeps.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.dto.PayoutLimitSettingsDto;
import com.rupiksha.aeps.dto.PayoutLimitUpdateRequest;
import com.rupiksha.aeps.entity.PayoutLimitSettings;
import com.rupiksha.aeps.entity.PayoutLimitSettingsAuditLog;
import com.rupiksha.aeps.repository.PayoutLimitSettingsAuditLogRepository;
import com.rupiksha.aeps.repository.PayoutLimitSettingsRepository;
import com.rupiksha.aeps.service.PayoutLimitConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PayoutLimitConfigurationServiceImpl implements PayoutLimitConfigurationService {

    public static final String CACHE_KEY = "payout:limits:active";
    private static final Duration CACHE_TTL = Duration.ofMinutes(5);

    private final PayoutLimitSettingsRepository settingsRepository;
    private final PayoutLimitSettingsAuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private StringRedisTemplate redisTemplate;

    public static String formatInr(BigDecimal amount) {
        if (amount == null) return "0";
        long wholePart = amount.setScale(0, java.math.RoundingMode.FLOOR).longValue();
        String wholeStr = String.valueOf(wholePart);
        if (wholeStr.length() > 3) {
            String lastThree = wholeStr.substring(wholeStr.length() - 3);
            String remaining = wholeStr.substring(0, wholeStr.length() - 3);
            StringBuilder sb = new StringBuilder();
            while (remaining.length() > 2) {
                sb.insert(0, "," + remaining.substring(remaining.length() - 2));
                remaining = remaining.substring(0, remaining.length() - 2);
            }
            sb.insert(0, remaining);
            wholeStr = sb.toString() + "," + lastThree;
        }
        if (amount.scale() > 0 && amount.remainder(BigDecimal.ONE).compareTo(BigDecimal.ZERO) != 0) {
            String plain = amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
            String frac = plain.substring(plain.indexOf('.'));
            return wholeStr + frac;
        }
        return wholeStr;
    }

    @Override
    @Transactional(readOnly = true)
    public PayoutLimitSettingsDto getActiveLimits() {
        // 1. Try reading from Redis cache if available
        if (redisTemplate != null) {
            try {
                String cachedJson = redisTemplate.opsForValue().get(CACHE_KEY);
                if (cachedJson != null && !cachedJson.isBlank()) {
                    return objectMapper.readValue(cachedJson, PayoutLimitSettingsDto.class);
                }
            } catch (Exception e) {
                log.warn("Redis cache read failed for payout limits, falling back to database: {}", e.getMessage());
            }
        }

        // 2. Fetch authoritative configuration from Database (fail-closed if unavailable)
        PayoutLimitSettings entity = settingsRepository.findById(1L)
                .orElseThrow(() -> new IllegalStateException(
                        "Authoritative payout limit configuration is not configured in database. System fails closed for security."
                ));

        PayoutLimitSettingsDto dto = mapToDto(entity);

        // 3. Populate Redis cache if available
        if (redisTemplate != null) {
            try {
                String json = objectMapper.writeValueAsString(dto);
                redisTemplate.opsForValue().set(CACHE_KEY, json, CACHE_TTL);
            } catch (Exception e) {
                log.warn("Redis cache write failed for payout limits: {}", e.getMessage());
            }
        }

        return dto;
    }

    @Override
    @Transactional
    public PayoutLimitSettingsDto updateLimits(
            PayoutLimitUpdateRequest request,
            String adminUserId,
            String adminUsername,
            String correlationId,
            String clientIp,
            String userAgent
    ) {
        if (request == null) {
            throw new IllegalArgumentException("Payout limit update request cannot be null.");
        }

        BigDecimal min = request.getMinimumPayoutAmount();
        BigDecimal max = request.getMaximumPayoutAmount();

        // 1. Rigorous backend validation
        if (min == null || max == null) {
            throw new IllegalArgumentException("Both minimum and maximum payout amounts are mandatory.");
        }
        if (min.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Minimum payout amount must be greater than zero.");
        }
        if (max.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Maximum payout amount must be greater than zero.");
        }
        if (min.compareTo(max) > 0) {
            throw new IllegalArgumentException("Minimum payout amount cannot exceed maximum payout amount.");
        }
        if (min.scale() > 2 || max.scale() > 2) {
            throw new IllegalArgumentException("Payout limit amounts cannot exceed 2 decimal places.");
        }

        // 2. Retrieve existing settings with optimistic locking
        PayoutLimitSettings settings = settingsRepository.findById(1L)
                .orElseGet(() -> PayoutLimitSettings.builder()
                        .id(1L)
                        .minimumPayoutAmount(new BigDecimal("100.00"))
                        .maximumPayoutAmount(new BigDecimal("100000.00"))
                        .updatedBy(adminUserId != null ? adminUserId : "SYSTEM")
                        .version(0L)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build());

        BigDecimal prevMin = settings.getMinimumPayoutAmount();
        BigDecimal prevMax = settings.getMaximumPayoutAmount();

        // 3. Apply updates
        settings.setMinimumPayoutAmount(min);
        settings.setMaximumPayoutAmount(max);
        settings.setUpdatedBy(adminUserId != null ? adminUserId : "ADMIN");
        settings.setUpdatedAt(LocalDateTime.now());

        PayoutLimitSettings saved = settingsRepository.saveAndFlush(settings);
        PayoutLimitSettingsDto updatedDto = mapToDto(saved);

        // 4. Record comprehensive audit log
        try {
            String eventId = "EVT_PL_" + UUID.randomUUID().toString().replace("-", "");
            PayoutLimitSettingsAuditLog audit = PayoutLimitSettingsAuditLog.builder()
                    .eventId(eventId)
                    .adminUserId(adminUserId)
                    .adminUsername(adminUsername)
                    .previousMinimumAmount(prevMin)
                    .newMinimumAmount(min)
                    .previousMaximumAmount(prevMax)
                    .newMaximumAmount(max)
                    .eventTimestamp(Instant.now())
                    .correlationId(correlationId != null ? correlationId : UUID.randomUUID().toString())
                    .sourceIp(clientIp)
                    .userAgent(userAgent != null && userAgent.length() > 500 ? userAgent.substring(0, 500) : userAgent)
                    .operationResult("SUCCESS")
                    .metadata("Updated minimum from " + prevMin + " to " + min + ", maximum from " + prevMax + " to " + max)
                    .build();
            auditLogRepository.save(audit);
        } catch (Exception e) {
            log.warn("Failed to persist payout limit audit log: {}", e.getMessage());
        }

        // 5. Invalidate / refresh Redis cache
        if (redisTemplate != null) {
            try {
                String json = objectMapper.writeValueAsString(updatedDto);
                redisTemplate.opsForValue().set(CACHE_KEY, json, CACHE_TTL);
            } catch (Exception e) {
                log.warn("Failed to invalidate Redis cache for payout limits: {}", e.getMessage());
            }
        }

        log.info("[ADMIN_AUDIT] Payout limits updated by admin {}: min=₹{}, max=₹{}",
                adminUserId, min, max);

        return updatedDto;
    }

    @Override
    @Transactional(readOnly = true)
    public void validatePayoutAmount(BigDecimal individualPayoutAmount) {
        if (individualPayoutAmount == null) {
            throw new IllegalArgumentException("Payout amount is required.");
        }
        if (individualPayoutAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Payout amount must be greater than zero.");
        }

        // Fetch current authoritative limits (fail-closed if unavailable)
        PayoutLimitSettingsDto limits = getActiveLimits();
        if (limits == null || limits.getMinimumPayoutAmount() == null || limits.getMaximumPayoutAmount() == null) {
            throw new IllegalStateException("Authoritative payout limits cannot be resolved. Payout initiation rejected.");
        }

        BigDecimal min = limits.getMinimumPayoutAmount();
        BigDecimal max = limits.getMaximumPayoutAmount();

        // 1. Below minimum check
        if (individualPayoutAmount.compareTo(min) < 0) {
            throw new IllegalArgumentException("Minimum payout amount is ₹" + formatInr(min) + ".");
        }

        // 2. Above maximum check (strictly per individual transaction!)
        if (individualPayoutAmount.compareTo(max) > 0) {
            throw new IllegalArgumentException("Maximum payout amount per transaction is ₹" + formatInr(max) +
                    ". Please initiate a separate payout for any additional amount.");
        }
    }

    private PayoutLimitSettingsDto mapToDto(PayoutLimitSettings entity) {
        String formattedDate = entity.getUpdatedAt() != null
                ? entity.getUpdatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                : LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);

        return PayoutLimitSettingsDto.builder()
                .minimumPayoutAmount(entity.getMinimumPayoutAmount())
                .maximumPayoutAmount(entity.getMaximumPayoutAmount())
                .updatedBy(entity.getUpdatedBy())
                .updatedAt(formattedDate)
                .version(entity.getVersion())
                .build();
    }
}
