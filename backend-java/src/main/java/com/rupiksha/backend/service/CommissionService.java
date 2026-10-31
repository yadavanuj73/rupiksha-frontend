package com.rupiksha.backend.service;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.backend.api.dto.CommissionDtos;
import com.rupiksha.backend.domain.BbpsTransaction;
import com.rupiksha.backend.domain.Recharge;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface CommissionService {

    /**
     * Idempotently calculates and distributes commission for a successfully completed AEPS transaction.
     */
    void processAepsCommission(AepsTransactionEngine txn);

    /**
     * Idempotently calculates and distributes percentage-based commission for a confirmed BBPS transaction.
     */
    void processBbpsCommission(BbpsTransaction bbpsTxn);

    /**
     * Lists all commission plans for a service.
     */
    List<CommissionDtos.CommissionPlanDto> getPlans(String serviceType);

    /**
     * Retrieves a single commission plan with slabs.
     */
    CommissionDtos.CommissionPlanDto getPlanById(UUID planId);

    /**
     * Updates slabs for an existing commission plan.
     */
    CommissionDtos.CommissionPlanDto updatePlanSlabs(UUID planId, CommissionDtos.UpdateSlabsRequest request, UUID adminId, String ipAddress);

    /**
     * Creates a new commission plan.
     */
    CommissionDtos.CommissionPlanDto createPlan(CommissionDtos.CreatePlanRequest request, UUID adminId, String ipAddress);

    /**
     * Retrieves commission transactions with role-based filtering and security isolation.
     */
    Page<CommissionDtos.CommissionTransactionDto> getTransactions(
            UUID currentUserId,
            boolean isAdmin,
            String serviceType,
            String status,
            String planCode,
            String startDate,
            String endDate,
            String search,
            Pageable pageable
    );

    /**
     * Retrieves summary statistics for a retailer.
     */
    CommissionDtos.CommissionSummaryDto getRetailerSummary(UUID retailerId);

    /**
     * Retrieves current active plan and slabs assigned to a retailer.
     */
    CommissionDtos.CommissionPlanDto getRetailerActivePlan(UUID retailerId);

    /**
     * Assigns a commission plan to a user.
     */
    void assignPlanToUser(UUID userId, UUID planId, UUID adminId, String ipAddress);

    /**
     * Upgrades/changes a retailer's commission plan with wallet payment deduction if applicable.
     */
    CommissionDtos.CommissionPlanDto upgradeRetailerPlan(UUID retailerId, UUID planId, String ipAddress);

    // ─── BBPS PERCENTAGE COMMISSION METHODS ────────────────────────────────────

    /**
     * Lists BBPS services with their commission configuration status.
     */
    List<CommissionDtos.BbpsServiceStatusDto> getBbpsServiceStatuses();

    /**
     * Retrieves percentage commission configs for all plans under a BBPS service.
     */
    List<CommissionDtos.BbpsCommissionConfigDto> getBbpsConfigs(String serviceId);

    /**
     * Updates percentages and enabled status for a BBPS service plan config.
     */
    CommissionDtos.BbpsCommissionConfigDto updateBbpsConfig(UUID configId, CommissionDtos.UpdateBbpsConfigRequest request, UUID adminId, String ipAddress);

    /**
     * Retrieves audit history for a BBPS service.
     */
    List<CommissionDtos.BbpsAuditDto> getBbpsAudits(String serviceId);

    /**
     * Reconciles and credits commission for any confirmed BBPS transactions that were not yet processed.
     */
    int reconcileUncreditedBbpsCommissions();

    // ─── MOBILE & DTH RECHARGE COMMISSION METHODS ──────────────────────────────

    /**
     * Idempotently calculates and distributes commission (Percentage or Fixed) for a confirmed Mobile Recharge.
     */
    void processRechargeCommission(Recharge recharge);

    /**
     * Lists operators for Mobile or DTH recharge with configuration status.
     */
    List<CommissionDtos.RechargeOperatorDto> getRechargeOperators(String serviceCategory);

    /**
     * Retrieves commission configs for all plans under an operator.
     */
    List<CommissionDtos.RechargeCommissionConfigDto> getRechargeConfigs(String serviceType, String operatorCode);

    /**
     * Updates commission values (Percentage or Fixed) and enabled status for an operator plan config.
     */
    CommissionDtos.RechargeCommissionConfigDto updateRechargeConfig(UUID configId, CommissionDtos.UpdateRechargeConfigRequest request, UUID adminId, String ipAddress);

    /**
     * Retrieves audit history for an operator.
     */
    List<CommissionDtos.RechargeAuditDto> getRechargeAudits(String serviceType, String operatorCode);

    /**
     * Reconciles and credits commission for any confirmed Mobile Recharge transactions that were not yet processed.
     */
    int reconcileUncreditedRechargeCommissions();
}
