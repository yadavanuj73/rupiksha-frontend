package com.rupiksha.backend.service;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.backend.api.dto.CommissionDtos;
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
}
