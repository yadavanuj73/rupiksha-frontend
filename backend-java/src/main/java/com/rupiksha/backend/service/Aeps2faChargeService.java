package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.CommissionDtos;
import com.rupiksha.backend.domain.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface Aeps2faChargeService {

    record ChargeExecutionResult(
            boolean charged,
            String chargeReference,
            BigDecimal chargeAmount,
            BigDecimal walletBalance,
            BigDecimal outstandingAmount,
            String chargeStatus,
            String message
    ) {}

    /**
     * Evaluates and applies the configured 2FA charge when a user completes an eligible 2FA operation.
     * Guaranteed idempotent per original2faReference.
     */
    ChargeExecutionResult process2faCharge(User user, String original2faReference, String providerTxnId, String provider, String ipAddress);

    List<CommissionDtos.Aeps2faChargeConfigDto> getAllConfigs();

    CommissionDtos.Aeps2faChargeConfigDto updateConfig(UUID configId, CommissionDtos.UpdateAeps2faConfigRequest request, UUID adminId, String ipAddress);

    List<CommissionDtos.Aeps2faAuditDto> getAudits(UUID planId);

    CommissionDtos.Aeps2faChargeConfigDto getRetailerChargeConfig(UUID retailerId);

    Page<CommissionDtos.Aeps2faChargeTxnDto> getUserChargeHistory(UUID userId, Pageable pageable);

    Page<CommissionDtos.Aeps2faChargeTxnDto> getAllCharges(Pageable pageable);
}

