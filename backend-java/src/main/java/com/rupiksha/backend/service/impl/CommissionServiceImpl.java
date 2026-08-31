package com.rupiksha.backend.service.impl;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.backend.api.dto.CommissionDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.service.CommissionService;
import com.rupiksha.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommissionServiceImpl implements CommissionService {

    private final CommissionPlanRepository commissionPlanRepository;
    private final CommissionSlabRepository commissionSlabRepository;
    private final CommissionTransactionRepository commissionTransactionRepository;
    private final UserRepository userRepository;
    private final WalletService walletService;

    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");

    private String generateCommissionReference() {
        String dateStr = LocalDate.now(IST_ZONE).format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randStr = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        return "COMM-" + dateStr + "-" + randStr;
    }

    private void enforceAdmin(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        boolean isAdmin = user.getRoles().stream()
                .anyMatch(r -> r.getName().name().equalsIgnoreCase("ADMIN"));
        if (!isAdmin) {
            throw new AccessDeniedException("Access denied: Only administrators can perform this operation.");
        }
    }

    @Override
    @Transactional
    public void processAepsCommission(AepsTransactionEngine txn) {
        if (txn == null || txn.getTransactionId() == null) {
            log.warn("Cannot process commission: Transaction payload or ID is null.");
            return;
        }

        String status = txn.getStatus();
        if (!"SUCCESS".equalsIgnoreCase(status) && !"APPROVED".equalsIgnoreCase(status)) {
            log.info("Skipping commission for non-successful AEPS transaction: ID={}, status={}", txn.getTransactionId(), status);
            return;
        }

        String serviceType = txn.getServiceType() != null ? txn.getServiceType().toUpperCase() : "";
        if (!"CASH_WITHDRAWAL".equals(serviceType) && !"AEPS_1".equals(serviceType)) {
            log.debug("Commission only enabled for AEPS 1 Cash Withdrawal in this phase. Txn service: {}", serviceType);
            return;
        }

        String txnId = txn.getTransactionId();
        BigDecimal txnAmount = txn.getAmount();

        if (txnAmount == null || txnAmount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Cannot process commission for transaction {}: invalid amount {}", txnId, txnAmount);
            return;
        }

        // Idempotency check: verify if already processed
        if (commissionTransactionRepository.existsByOriginalTransactionId(txnId)) {
            log.warn("Idempotency safeguard: Commission already processed for transaction ID: {}", txnId);
            return;
        }

        log.info("Processing commission for successful AEPS transaction: txnId={}, amount={}", txnId, txnAmount);

        // 1. Resolve Retailer
        User retailer = userRepository.findById(txn.getUserId()).orElse(null);
        if (retailer == null) {
            log.error("Commission calculation failed: Retailer user not found for ID: {}", txn.getUserId());
            return;
        }

        // 2. Resolve Retailer Plan
        CommissionPlan plan = retailer.getAepsCommissionPlan();
        if (plan == null || !Boolean.TRUE.equals(plan.getEnabled())) {
            plan = commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")
                    .or(() -> commissionPlanRepository.findByServiceTypeAndPlanCode("AEPS_1", "FREE"))
                    .orElse(null);
        }

        if (plan == null) {
            log.warn("Commission plan not found or disabled for service AEPS_1. Skipping commission distribution for txn {}", txnId);
            return;
        }

        // 3. Find matching slab
        List<CommissionSlab> matchingSlabs = commissionSlabRepository.findMatchingSlabs(plan.getId(), txnAmount);
        if (matchingSlabs.isEmpty()) {
            log.warn("No active commission slab found for plan: {} and amount: {}. Transaction: {}", plan.getPlanName(), txnAmount, txnId);
            return;
        }

        CommissionSlab slab = matchingSlabs.get(0);
        log.info("Matching slab found: [{}-{}] for plan: {} on txn: {}", 
                slab.getMinAmount(), slab.getMaxAmount(), plan.getPlanName(), txnId);

        // 4. Resolve Hierarchy
        User distributor = null;
        User superDistributor = null;

        User parent = retailer.getParentUser();
        if (parent != null) {
            boolean isDist = parent.getRoles().stream()
                    .anyMatch(r -> r.getName() == RoleName.DISTRIBUTOR);
            boolean isSuperDist = parent.getRoles().stream()
                    .anyMatch(r -> r.getName() == RoleName.SUPER_DISTRIBUTOR);

            if (isDist) {
                distributor = parent;
                User grandParent = distributor.getParentUser();
                if (grandParent != null && grandParent.getRoles().stream().anyMatch(r -> r.getName() == RoleName.SUPER_DISTRIBUTOR)) {
                    superDistributor = grandParent;
                }
            } else if (isSuperDist) {
                superDistributor = parent;
            }
        }

        String ip = txn.getIpAddress() != null && !txn.getIpAddress().isBlank() ? txn.getIpAddress() : "127.0.0.1";

        // 5. Credit Retailer
        BigDecimal retComm = slab.getRetailerCommission() != null ? slab.getRetailerCommission() : BigDecimal.ZERO;
        if (retComm.compareTo(BigDecimal.ZERO) > 0) {
            creditBeneficiary(
                    retailer,
                    "RETAILER",
                    retailer,
                    plan,
                    slab,
                    txnId,
                    txnAmount,
                    retComm,
                    ip,
                    "AEPS 1 Commission - ₹" + txnAmount + " transaction - Slab ₹" + slab.getMinAmount() + "-₹" + slab.getMaxAmount()
            );
        }

        // 6. Credit Distributor (if mapped in hierarchy)
        BigDecimal distComm = slab.getDistributorCommission() != null ? slab.getDistributorCommission() : BigDecimal.ZERO;
        if (distributor != null && distComm.compareTo(BigDecimal.ZERO) > 0) {
            creditBeneficiary(
                    distributor,
                    "DISTRIBUTOR",
                    retailer,
                    plan,
                    slab,
                    txnId,
                    txnAmount,
                    distComm,
                    ip,
                    "AEPS 1 Commission (Distributor) - ₹" + txnAmount + " transaction - Slab ₹" + slab.getMinAmount() + "-₹" + slab.getMaxAmount()
            );
        }

        // 7. Credit Super Distributor (if mapped in hierarchy)
        BigDecimal sdComm = slab.getSuperDistributorCommission() != null ? slab.getSuperDistributorCommission() : BigDecimal.ZERO;
        if (superDistributor != null && sdComm.compareTo(BigDecimal.ZERO) > 0) {
            creditBeneficiary(
                    superDistributor,
                    "SUPER_DISTRIBUTOR",
                    retailer,
                    plan,
                    slab,
                    txnId,
                    txnAmount,
                    sdComm,
                    ip,
                    "AEPS 1 Commission (Super Distributor) - ₹" + txnAmount + " transaction - Slab ₹" + slab.getMinAmount() + "-₹" + slab.getMaxAmount()
            );
        }

        log.info("Commission distribution completed for txn {}: Retailer(₹{}), Distributor(₹{}), SuperDistributor(₹{})",
                txnId, retComm, (distributor != null ? distComm : BigDecimal.ZERO), (superDistributor != null ? sdComm : BigDecimal.ZERO));
    }

    private void creditBeneficiary(
            User beneficiary,
            String role,
            User retailer,
            CommissionPlan plan,
            CommissionSlab slab,
            String originalTxnId,
            BigDecimal txnAmount,
            BigDecimal commAmount,
            String ip,
            String narration
    ) {
        String commRef = generateCommissionReference();
        String idempotencyKey = "COMM-" + originalTxnId + "-" + role + "-" + beneficiary.getId();

        try {
            // Credit wallet using existing enterprise wallet engine
            walletService.creditForService(
                    beneficiary.getId(),
                    commAmount,
                    narration,
                    WalletTransactionContext.COMMISSION,
                    "AEPS 1",
                    ip,
                    idempotencyKey
            );

            // Record in immutable commission audit ledger
            CommissionTransaction commTxn = CommissionTransaction.builder()
                    .commissionReference(commRef)
                    .originalTransactionId(originalTxnId)
                    .serviceType("AEPS_1")
                    .plan(plan)
                    .planCode(plan != null ? plan.getPlanCode() : null)
                    .slab(slab)
                    .slabMin(slab.getMinAmount())
                    .slabMax(slab.getMaxAmount())
                    .transactionAmount(txnAmount)
                    .beneficiaryUser(beneficiary)
                    .beneficiaryRole(role)
                    .retailerUser(retailer)
                    .commissionAmount(commAmount)
                    .status("SUCCESS")
                    .remarks(narration)
                    .createdAt(Instant.now())
                    .build();

            commissionTransactionRepository.save(commTxn);
            log.info("Created commission ledger entry: ref={}, beneficiary={}, role={}, amount=₹{}",
                    commRef, beneficiary.getUsername(), role, commAmount);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            log.warn("Commission entry already exists for txn {}, role {}, user {}. Skipping duplicate.", originalTxnId, role, beneficiary.getId());
        } catch (Exception e) {
            log.error("Failed to credit commission for txn {}, user {}: {}", originalTxnId, beneficiary.getId(), e.getMessage(), e);
            throw e; // Bubble up for transaction rollback
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<CommissionDtos.CommissionPlanDto> getPlans(String serviceType) {
        String st = (serviceType != null && !serviceType.isBlank()) ? serviceType.toUpperCase() : "AEPS_1";
        List<CommissionPlan> plans = commissionPlanRepository.findByServiceTypeWithSlabs(st);
        return plans.stream().map(this::mapPlanToDto).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CommissionDtos.CommissionPlanDto getPlanById(UUID planId) {
        CommissionPlan plan = commissionPlanRepository.findByIdWithSlabs(planId)
                .orElseThrow(() -> new IllegalArgumentException("Commission plan not found: " + planId));
        return mapPlanToDto(plan);
    }

    @Override
    @Transactional
    public CommissionDtos.CommissionPlanDto updatePlanSlabs(
            UUID planId,
            CommissionDtos.UpdateSlabsRequest request,
            UUID adminId,
            String ipAddress
    ) {
        enforceAdmin(adminId);
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin user not found"));

        CommissionPlan plan = commissionPlanRepository.findByIdWithSlabs(planId)
                .orElseThrow(() -> new IllegalArgumentException("Commission plan not found: " + planId));

        List<CommissionDtos.CommissionSlabDto> slabDtos = request.slabs();
        if (slabDtos == null || slabDtos.isEmpty()) {
            throw new IllegalArgumentException("Commission slabs cannot be empty.");
        }

        // Validate slabs
        validateSlabs(slabDtos);

        // Clear existing slabs and rebuild
        plan.getSlabs().clear();
        commissionPlanRepository.saveAndFlush(plan);

        for (CommissionDtos.CommissionSlabDto dto : slabDtos) {
            CommissionSlab slab = CommissionSlab.builder()
                    .commissionPlan(plan)
                    .minAmount(dto.minAmount())
                    .maxAmount(dto.maxAmount())
                    .retailerCommission(dto.retailerCommission())
                    .distributorCommission(dto.distributorCommission() != null ? dto.distributorCommission() : BigDecimal.ZERO)
                    .superDistributorCommission(dto.superDistributorCommission() != null ? dto.superDistributorCommission() : BigDecimal.ZERO)
                    .enabled(dto.enabled() != null ? dto.enabled() : true)
                    .build();
            plan.getSlabs().add(slab);
        }

        CommissionPlan saved = commissionPlanRepository.save(plan);
        log.info("Admin {} updated commission slabs for plan {} ({})", admin.getUsername(), plan.getPlanName(), plan.getId());
        return mapPlanToDto(saved);
    }

    @Override
    @Transactional
    public CommissionDtos.CommissionPlanDto createPlan(
            CommissionDtos.CreatePlanRequest request,
            UUID adminId,
            String ipAddress
    ) {
        enforceAdmin(adminId);
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin user not found"));

        String serviceType = request.serviceType().toUpperCase();
        String planCode = request.planCode().toUpperCase();

        if (commissionPlanRepository.findByServiceTypeAndPlanCode(serviceType, planCode).isPresent()) {
            throw new IllegalArgumentException("Commission plan with code '" + planCode + "' already exists for service '" + serviceType + "'.");
        }

        if (request.slabs() != null && !request.slabs().isEmpty()) {
            validateSlabs(request.slabs());
        }

        CommissionPlan plan = CommissionPlan.builder()
                .serviceType(serviceType)
                .planName(request.planName())
                .planCode(planCode)
                .price(request.price() != null ? request.price() : BigDecimal.ZERO)
                .isDefault(Boolean.TRUE.equals(request.isDefault()))
                .enabled(true)
                .build();

        if (request.slabs() != null) {
            for (CommissionDtos.CommissionSlabDto dto : request.slabs()) {
                CommissionSlab slab = CommissionSlab.builder()
                        .commissionPlan(plan)
                        .minAmount(dto.minAmount())
                        .maxAmount(dto.maxAmount())
                        .retailerCommission(dto.retailerCommission())
                        .distributorCommission(dto.distributorCommission() != null ? dto.distributorCommission() : BigDecimal.ZERO)
                        .superDistributorCommission(dto.superDistributorCommission() != null ? dto.superDistributorCommission() : BigDecimal.ZERO)
                        .enabled(dto.enabled() != null ? dto.enabled() : true)
                        .build();
                plan.getSlabs().add(slab);
            }
        }

        CommissionPlan saved = commissionPlanRepository.save(plan);
        log.info("Admin {} created commission plan {} ({})", admin.getUsername(), plan.getPlanName(), plan.getPlanCode());
        return mapPlanToDto(saved);
    }

    private void validateSlabs(List<CommissionDtos.CommissionSlabDto> slabs) {
        // Sort slabs by minAmount
        List<CommissionDtos.CommissionSlabDto> sorted = new ArrayList<>(slabs);
        sorted.sort(Comparator.comparing(CommissionDtos.CommissionSlabDto::minAmount));

        for (int i = 0; i < sorted.size(); i++) {
            CommissionDtos.CommissionSlabDto s = sorted.get(i);

            if (s.minAmount() == null || s.maxAmount() == null) {
                throw new IllegalArgumentException("Slab min and max amounts cannot be null.");
            }
            if (s.minAmount().compareTo(BigDecimal.ZERO) < 0 || s.maxAmount().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Slab amounts cannot be negative.");
            }
            if (s.minAmount().compareTo(s.maxAmount()) > 0) {
                throw new IllegalArgumentException("Slab min amount (" + s.minAmount() + ") cannot be greater than max amount (" + s.maxAmount() + ").");
            }
            if (s.retailerCommission() != null && s.retailerCommission().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Retailer commission cannot be negative.");
            }
            if (s.distributorCommission() != null && s.distributorCommission().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Distributor commission cannot be negative.");
            }
            if (s.superDistributorCommission() != null && s.superDistributorCommission().compareTo(BigDecimal.ZERO) < 0) {
                throw new IllegalArgumentException("Super distributor commission cannot be negative.");
            }

            // Check overlap with next slab
            if (i < sorted.size() - 1) {
                CommissionDtos.CommissionSlabDto next = sorted.get(i + 1);
                if (s.maxAmount().compareTo(next.minAmount()) >= 0) {
                    throw new IllegalArgumentException("Overlapping slabs detected between [" + s.minAmount() + " - " + s.maxAmount() +
                            "] and [" + next.minAmount() + " - " + next.maxAmount() + "]. Slabs must be mutually exclusive.");
                }
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CommissionDtos.CommissionTransactionDto> getTransactions(
            UUID currentUserId,
            boolean isAdmin,
            String serviceType,
            String status,
            String planCode,
            String startDate,
            String endDate,
            String search,
            Pageable pageable
    ) {
        UUID beneficiaryId = isAdmin ? null : currentUserId;
        String st = (serviceType != null && !serviceType.isBlank() && !"ALL".equalsIgnoreCase(serviceType)) ? serviceType.toUpperCase() : null;
        String stat = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) ? status.toUpperCase() : null;
        String pc = (planCode != null && !planCode.isBlank() && !"ALL".equalsIgnoreCase(planCode)) ? planCode.toUpperCase() : null;
        String searchStr = (search != null && !search.isBlank()) ? "%" + search.trim() + "%" : null;

        Instant start = null;
        Instant end = null;
        try {
            if (startDate != null && !startDate.isBlank()) {
                start = Instant.parse(startDate);
            }
            if (endDate != null && !endDate.isBlank()) {
                end = Instant.parse(endDate);
            }
        } catch (Exception e) {
            log.warn("Could not parse date range: start={}, end={}", startDate, endDate);
        }

        Page<CommissionTransaction> page = commissionTransactionRepository.findWithFilters(
                beneficiaryId, st, stat, pc, start, end, searchStr, pageable
        );

        return page.map(this::mapTransactionToDto);
    }

    @Override
    @Transactional(readOnly = true)
    public CommissionDtos.CommissionSummaryDto getRetailerSummary(UUID retailerId) {
        BigDecimal total = commissionTransactionRepository.sumTotalCommissionByBeneficiaryId(retailerId);

        // Today start and end in IST
        LocalDate today = LocalDate.now(IST_ZONE);
        Instant todayStart = today.atStartOfDay(IST_ZONE).toInstant();
        Instant todayEnd = today.plusDays(1).atStartOfDay(IST_ZONE).minusNanos(1).toInstant();
        BigDecimal todayComm = commissionTransactionRepository.sumCommissionByBeneficiaryIdAndDateRange(retailerId, todayStart, todayEnd);

        // This Month start and end in IST
        LocalDate firstDayOfMonth = today.withDayOfMonth(1);
        Instant monthStart = firstDayOfMonth.atStartOfDay(IST_ZONE).toInstant();
        Instant monthEnd = firstDayOfMonth.plusMonths(1).atStartOfDay(IST_ZONE).minusNanos(1).toInstant();
        BigDecimal monthComm = commissionTransactionRepository.sumCommissionByBeneficiaryIdAndDateRange(retailerId, monthStart, monthEnd);

        // AEPS 1 specific total
        BigDecimal aeps1Comm = commissionTransactionRepository.sumCommissionByBeneficiaryIdAndServiceType(retailerId, "AEPS_1");

        User user = userRepository.findById(retailerId).orElse(null);
        String planName = "Free Plan";
        String planCode = "FREE";
        if (user != null && user.getAepsCommissionPlan() != null) {
            planName = user.getAepsCommissionPlan().getPlanName();
            planCode = user.getAepsCommissionPlan().getPlanCode();
        }

        return new CommissionDtos.CommissionSummaryDto(
                total != null ? total : BigDecimal.ZERO,
                todayComm != null ? todayComm : BigDecimal.ZERO,
                monthComm != null ? monthComm : BigDecimal.ZERO,
                aeps1Comm != null ? aeps1Comm : BigDecimal.ZERO,
                planName,
                planCode
        );
    }

    @Override
    @Transactional(readOnly = true)
    public CommissionDtos.CommissionPlanDto getRetailerActivePlan(UUID retailerId) {
        User user = userRepository.findById(retailerId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + retailerId));

        CommissionPlan plan = user.getAepsCommissionPlan();
        if (plan == null) {
            plan = commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")
                    .or(() -> commissionPlanRepository.findByServiceTypeAndPlanCode("AEPS_1", "FREE"))
                    .orElseThrow(() -> new IllegalStateException("Default AEPS 1 commission plan not configured in system."));
        }

        return mapPlanToDto(plan);
    }

    @Override
    @Transactional
    public void assignPlanToUser(UUID userId, UUID planId, UUID adminId, String ipAddress) {
        enforceAdmin(adminId);
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Target user not found: " + userId));

        CommissionPlan plan = commissionPlanRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("Commission plan not found: " + planId));

        user.setAepsCommissionPlan(plan);
        userRepository.save(user);

        log.info("Admin {} assigned commission plan {} to user {}", admin.getUsername(), plan.getPlanName(), user.getUsername());
    }

    @Override
    @Transactional
    public CommissionDtos.CommissionPlanDto upgradeRetailerPlan(UUID retailerId, UUID planId, String ipAddress) {
        User retailer = userRepository.findById(retailerId)
                .orElseThrow(() -> new IllegalArgumentException("Retailer user not found"));

        CommissionPlan plan = commissionPlanRepository.findByIdWithSlabs(planId)
                .orElseThrow(() -> new IllegalArgumentException("Commission plan not found"));

        if (!Boolean.TRUE.equals(plan.getEnabled())) {
            throw new IllegalArgumentException("The selected commission plan is currently disabled");
        }

        if (retailer.getAepsCommissionPlan() != null && retailer.getAepsCommissionPlan().getId().equals(planId)) {
            return mapPlanToDto(plan);
        }

        BigDecimal price = plan.getPrice() != null ? plan.getPrice() : BigDecimal.ZERO;
        if (price.compareTo(BigDecimal.ZERO) > 0) {
            String idempotencyKey = "UPGRADE-" + retailerId + "-" + planId + "-" + System.currentTimeMillis();
            walletService.debitForService(
                    retailerId,
                    price,
                    "Commission Plan Upgrade: " + plan.getPlanName(),
                    WalletTransactionContext.PLAN_UPGRADE,
                    "PLAN_UPGRADE",
                    ipAddress != null ? ipAddress : "127.0.0.1",
                    idempotencyKey
            );
        }

        retailer.setAepsCommissionPlan(plan);
        userRepository.save(retailer);

        log.info("Retailer {} successfully upgraded commission plan to {}", retailer.getUsername(), plan.getPlanName());
        return mapPlanToDto(plan);
    }

    private CommissionDtos.CommissionPlanDto mapPlanToDto(CommissionPlan plan) {
        List<CommissionDtos.CommissionSlabDto> slabs = plan.getSlabs().stream()
                .map(s -> {
                    BigDecimal ret = s.getRetailerCommission() != null ? s.getRetailerCommission() : BigDecimal.ZERO;
                    BigDecimal dist = s.getDistributorCommission() != null ? s.getDistributorCommission() : BigDecimal.ZERO;
                    BigDecimal sd = s.getSuperDistributorCommission() != null ? s.getSuperDistributorCommission() : BigDecimal.ZERO;
                    BigDecimal total = ret.add(dist).add(sd);

                    return new CommissionDtos.CommissionSlabDto(
                            s.getId(),
                            s.getMinAmount(),
                            s.getMaxAmount(),
                            ret,
                            dist,
                            sd,
                            total,
                            s.getEnabled()
                    );
                })
                .sorted(Comparator.comparing(CommissionDtos.CommissionSlabDto::minAmount))
                .collect(Collectors.toList());

        return new CommissionDtos.CommissionPlanDto(
                plan.getId(),
                plan.getServiceType(),
                plan.getPlanName(),
                plan.getPlanCode(),
                plan.getPrice(),
                plan.getIsDefault(),
                plan.getEnabled(),
                slabs
        );
    }

    private CommissionDtos.CommissionTransactionDto mapTransactionToDto(CommissionTransaction txn) {
        String slabRange = "₹" + txn.getSlabMin() + " - ₹" + txn.getSlabMax();

        return new CommissionDtos.CommissionTransactionDto(
                txn.getId(),
                txn.getCommissionReference(),
                txn.getOriginalTransactionId(),
                txn.getServiceType(),
                txn.getPlanCode(),
                slabRange,
                txn.getTransactionAmount(),
                txn.getBeneficiaryUser().getId().toString(),
                txn.getBeneficiaryUser().getFullName(),
                txn.getBeneficiaryUser().getUsername(),
                txn.getBeneficiaryRole(),
                txn.getRetailerUser().getId().toString(),
                txn.getRetailerUser().getFullName(),
                txn.getRetailerUser().getUsername(),
                txn.getCommissionAmount(),
                txn.getStatus(),
                txn.getRemarks(),
                txn.getCreatedAt()
        );
    }
}
