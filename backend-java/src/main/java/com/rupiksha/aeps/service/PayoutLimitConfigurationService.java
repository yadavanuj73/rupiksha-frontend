package com.rupiksha.aeps.service;

import com.rupiksha.aeps.dto.PayoutLimitSettingsDto;
import com.rupiksha.aeps.dto.PayoutLimitUpdateRequest;

import java.math.BigDecimal;

public interface PayoutLimitConfigurationService {

    /**
     * Retrieves current authoritative minimum and maximum payout limit configuration.
     */
    PayoutLimitSettingsDto getActiveLimits();

    /**
     * Atomically updates minimum and maximum payout limits with audit logging and cache invalidation.
     */
    PayoutLimitSettingsDto updateLimits(
            PayoutLimitUpdateRequest request,
            String adminUserId,
            String adminUsername,
            String correlationId,
            String clientIp,
            String userAgent
    );

    /**
     * Validates an individual payout transaction amount against current authoritative limits.
     * CRITICAL: Strictly per individual transaction. Never cumulative, daily, or monthly.
     *
     * @param individualPayoutAmount the amount of the single payout request
     * @throws IllegalArgumentException if amount is outside the allowed range
     */
    void validatePayoutAmount(BigDecimal individualPayoutAmount);
}
