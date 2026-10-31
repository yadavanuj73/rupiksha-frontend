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
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import com.rupiksha.backend.repository.BbpsTransactionRepository;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommissionServiceImpl implements CommissionService {

    private final CommissionPlanRepository commissionPlanRepository;
    private final CommissionSlabRepository commissionSlabRepository;
    private final CommissionTransactionRepository commissionTransactionRepository;
    private final UserRepository userRepository;
    private final WalletService walletService;
    private final BbpsCommissionConfigRepository bbpsCommissionConfigRepository;
    private final BbpsCommissionConfigAuditRepository bbpsCommissionConfigAuditRepository;
    private final BbpsTransactionRepository bbpsTransactionRepository;
    private final RechargeCommissionConfigRepository rechargeCommissionConfigRepository;
    private final RechargeCommissionConfigAuditRepository rechargeCommissionConfigAuditRepository;
    private final RechargeRepository rechargeRepository;
    private final com.rupiksha.backend.config.AppProperties appProperties;

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

    private User resolveParentUser(User user) {
        if (user == null) return null;
        if (user.getParentUser() != null) {
            return user.getParentUser();
        }
        if (user.getAddedByUserRef() != null && !user.getAddedByUserRef().isBlank()) {
            String ref = user.getAddedByUserRef().trim();
            try {
                UUID parentId = UUID.fromString(ref);
                Optional<User> found = userRepository.findById(parentId);
                if (found.isPresent()) return found.get();
            } catch (Exception ignored) {}
            Optional<User> byMobile = userRepository.findByMobile(ref);
            if (byMobile.isPresent()) return byMobile.get();
            Optional<User> byPartyCode = userRepository.findByPartyCode(ref);
            if (byPartyCode.isPresent()) return byPartyCode.get();
            Optional<User> byUsername = userRepository.findByUsername(ref);
            if (byUsername.isPresent()) return byUsername.get();
        }
        if (user.getAddedByPartyCode() != null && !user.getAddedByPartyCode().isBlank()) {
            Optional<User> byPartyCode = userRepository.findByPartyCode(user.getAddedByPartyCode().trim());
            if (byPartyCode.isPresent()) return byPartyCode.get();
        }
        return null;
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
        if (isPaidPlanExpired(retailer)) {
            log.info("Retailer {} paid commission plan {} expired on {}. Falling back to default Free plan.",
                    retailer.getUsername(), plan != null ? plan.getPlanName() : "", retailer.getAepsCommissionPlanExpiresAt());
            plan = null;
        }
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

        // 4. Resolve Hierarchy with resilient multi-factor fallback
        User distributor = null;
        User superDistributor = null;

        User parent = resolveParentUser(retailer);
        if (parent != null) {
            boolean isDist = parent.getRoles().stream()
                    .anyMatch(r -> r.getName() == RoleName.DISTRIBUTOR);
            boolean isSuperDist = parent.getRoles().stream()
                    .anyMatch(r -> r.getName() == RoleName.SUPER_DISTRIBUTOR);

            if (isDist) {
                distributor = parent;
                User grandParent = resolveParentUser(distributor);
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

        // Update existing slabs in-place to preserve entity IDs and avoid foreign key constraint violations
        Map<UUID, CommissionSlab> existingSlabsMap = plan.getSlabs().stream()
                .filter(s -> s.getId() != null)
                .collect(Collectors.toMap(CommissionSlab::getId, Function.identity()));

        Set<UUID> incomingIds = new HashSet<>();
        List<CommissionSlab> newSlabsToAdd = new ArrayList<>();

        for (CommissionDtos.CommissionSlabDto dto : slabDtos) {
            if (dto.id() != null && existingSlabsMap.containsKey(dto.id())) {
                CommissionSlab slab = existingSlabsMap.get(dto.id());
                slab.setMinAmount(dto.minAmount());
                slab.setMaxAmount(dto.maxAmount());
                slab.setRetailerCommission(dto.retailerCommission());
                slab.setDistributorCommission(dto.distributorCommission() != null ? dto.distributorCommission() : BigDecimal.ZERO);
                slab.setSuperDistributorCommission(dto.superDistributorCommission() != null ? dto.superDistributorCommission() : BigDecimal.ZERO);
                slab.setEnabled(dto.enabled() != null ? dto.enabled() : true);
                incomingIds.add(dto.id());
            } else {
                CommissionSlab newSlab = CommissionSlab.builder()
                        .commissionPlan(plan)
                        .minAmount(dto.minAmount())
                        .maxAmount(dto.maxAmount())
                        .retailerCommission(dto.retailerCommission())
                        .distributorCommission(dto.distributorCommission() != null ? dto.distributorCommission() : BigDecimal.ZERO)
                        .superDistributorCommission(dto.superDistributorCommission() != null ? dto.superDistributorCommission() : BigDecimal.ZERO)
                        .enabled(dto.enabled() != null ? dto.enabled() : true)
                        .build();
                newSlabsToAdd.add(newSlab);
            }
        }

        // Remove slabs that were deleted by admin in UI
        plan.getSlabs().removeIf(s -> s.getId() != null && !incomingIds.contains(s.getId()));

        // Add newly created slabs
        plan.getSlabs().addAll(newSlabsToAdd);

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
        String searchStr = (search != null && !search.isBlank()) ? search.trim() : null;

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

        final Instant finalStart = start;
        final Instant finalEnd = end;

        Specification<CommissionTransaction> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (beneficiaryId != null) {
                predicates.add(cb.equal(root.get("beneficiaryUser").get("id"), beneficiaryId));
            }
            if (st != null) {
                predicates.add(cb.equal(root.get("serviceType"), st));
            }
            if (stat != null) {
                predicates.add(cb.equal(root.get("status"), stat));
            }
            if (pc != null) {
                predicates.add(cb.equal(root.get("planCode"), pc));
            }
            if (finalStart != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), finalStart));
            }
            if (finalEnd != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), finalEnd));
            }
            if (searchStr != null && !searchStr.isEmpty()) {
                String pattern = "%" + searchStr.toLowerCase() + "%";
                Predicate origTxn = cb.like(cb.lower(root.get("originalTransactionId")), pattern);
                Predicate commRef = cb.like(cb.lower(root.get("commissionReference")), pattern);
                Predicate userName = cb.like(cb.lower(root.get("beneficiaryUser").get("username")), pattern);
                Predicate fullName = cb.like(cb.lower(root.get("beneficiaryUser").get("fullName")), pattern);
                predicates.add(cb.or(origTxn, commRef, userName, fullName));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<CommissionTransaction> page = commissionTransactionRepository.findAll(spec, pageable);

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
        BigDecimal currentPlanPrice = BigDecimal.ZERO;
        Instant activatedAt = null;
        Instant expiresAt = null;
        Long daysRemaining = null;
        boolean isExpired = false;

        if (user != null && user.getAepsCommissionPlan() != null) {
            CommissionPlan userPlan = user.getAepsCommissionPlan();
            BigDecimal price = userPlan.getPrice() != null ? userPlan.getPrice() : BigDecimal.ZERO;
            if (price.compareTo(BigDecimal.ZERO) > 0) {
                if (isPaidPlanExpired(user)) {
                    isExpired = true;
                    planName = "Free Plan";
                    planCode = "FREE";
                    currentPlanPrice = BigDecimal.ZERO;
                } else {
                    planName = userPlan.getPlanName();
                    planCode = userPlan.getPlanCode();
                    currentPlanPrice = price;
                    activatedAt = user.getAepsCommissionPlanActivatedAt();
                    expiresAt = user.getAepsCommissionPlanExpiresAt();
                    daysRemaining = calculateDaysRemaining(expiresAt);
                }
            } else {
                planName = userPlan.getPlanName();
                planCode = userPlan.getPlanCode();
                currentPlanPrice = BigDecimal.ZERO;
            }
        }

        return new CommissionDtos.CommissionSummaryDto(
                total != null ? total : BigDecimal.ZERO,
                todayComm != null ? todayComm : BigDecimal.ZERO,
                monthComm != null ? monthComm : BigDecimal.ZERO,
                aeps1Comm != null ? aeps1Comm : BigDecimal.ZERO,
                planName,
                planCode,
                currentPlanPrice,
                activatedAt,
                expiresAt,
                daysRemaining,
                isExpired
        );
    }

    private boolean isPaidPlanExpired(User user) {
        if (user == null || user.getAepsCommissionPlan() == null) {
            return false;
        }
        CommissionPlan plan = user.getAepsCommissionPlan();
        BigDecimal price = plan.getPrice() != null ? plan.getPrice() : BigDecimal.ZERO;
        if (price.compareTo(BigDecimal.ZERO) <= 0) {
            // Free plan never expires
            return false;
        }
        Instant expiresAt = user.getAepsCommissionPlanExpiresAt();
        if (expiresAt == null) {
            return false;
        }
        return Instant.now().isAfter(expiresAt);
    }

    private Long calculateDaysRemaining(Instant expiresAt) {
        if (expiresAt == null) return null;
        long days = Duration.between(Instant.now(), expiresAt).toDays();
        return Math.max(0, days);
    }

    @Override
    @Transactional(readOnly = true)
    public CommissionDtos.CommissionPlanDto getRetailerActivePlan(UUID retailerId) {
        User user = userRepository.findById(retailerId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + retailerId));

        CommissionPlan plan = user.getAepsCommissionPlan();
        boolean isExpired = isPaidPlanExpired(user);

        if (plan == null || isExpired || !Boolean.TRUE.equals(plan.getEnabled())) {
            plan = commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")
                    .or(() -> commissionPlanRepository.findByServiceTypeAndPlanCode("AEPS_1", "FREE"))
                    .orElseThrow(() -> new IllegalStateException("Default AEPS 1 commission plan not configured in system."));
            return mapPlanToDtoWithUserContext(plan, null, null, null, isExpired);
        }

        Instant activatedAt = user.getAepsCommissionPlanActivatedAt();
        Instant expiresAt = user.getAepsCommissionPlanExpiresAt();
        Long daysRemaining = calculateDaysRemaining(expiresAt);

        return mapPlanToDtoWithUserContext(plan, activatedAt, expiresAt, daysRemaining, false);
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
        if (plan.getPrice() != null && plan.getPrice().compareTo(BigDecimal.ZERO) > 0) {
            user.setAepsCommissionPlanActivatedAt(Instant.now());
            user.setAepsCommissionPlanExpiresAt(Instant.now().plus(365, ChronoUnit.DAYS));
        } else {
            user.setAepsCommissionPlanActivatedAt(null);
            user.setAepsCommissionPlanExpiresAt(null);
        }
        userRepository.save(user);

        log.info("Admin {} assigned commission plan {} to user {}", admin.getUsername(), plan.getPlanName(), user.getUsername());
    }

    @Override
    @Transactional
    public CommissionDtos.CommissionPlanDto upgradeRetailerPlan(UUID retailerId, UUID planId, String ipAddress) {
        User retailer = userRepository.findById(retailerId)
                .orElseThrow(() -> new IllegalArgumentException("Retailer user not found"));

        CommissionPlan targetPlan = commissionPlanRepository.findByIdWithSlabs(planId)
                .orElseThrow(() -> new IllegalArgumentException("Commission plan not found"));

        if (!Boolean.TRUE.equals(targetPlan.getEnabled())) {
            throw new IllegalArgumentException("The selected commission plan is currently disabled");
        }

        CommissionPlan currentPlan = retailer.getAepsCommissionPlan();
        boolean hasActivePaidPlan = currentPlan != null 
                && currentPlan.getPrice() != null 
                && currentPlan.getPrice().compareTo(BigDecimal.ZERO) > 0 
                && !isPaidPlanExpired(retailer);

        BigDecimal targetPrice = targetPlan.getPrice() != null ? targetPlan.getPrice() : BigDecimal.ZERO;
        BigDecimal currentPrice = (hasActivePaidPlan && currentPlan.getPrice() != null) ? currentPlan.getPrice() : BigDecimal.ZERO;

        // If user is already on this exact plan
        if (currentPlan != null && currentPlan.getId().equals(planId)) {
            Instant activatedAt = retailer.getAepsCommissionPlanActivatedAt();
            Instant expiresAt = retailer.getAepsCommissionPlanExpiresAt();
            Long daysRemaining = calculateDaysRemaining(expiresAt);
            return mapPlanToDtoWithUserContext(targetPlan, activatedAt, expiresAt, daysRemaining, false);
        }

        // Downgrade Prevention: Cannot downgrade to lower-priced plan or Free plan while active plan is valid
        if (hasActivePaidPlan && targetPrice.compareTo(currentPrice) <= 0) {
            throw new IllegalArgumentException(
                    "Cannot downgrade your plan while your current active plan is valid. Plan downgrades are only permitted after your current plan expires."
            );
        }

        Instant newActivatedAt;
        Instant newExpiresAt;
        BigDecimal priceToDebit;

        if (hasActivePaidPlan) {
            // Upgrading from an active paid plan (e.g. ₹2,999 to ₹4,999 or ₹7,999)
            // 1. Charge difference amount + 500 extra
            priceToDebit = targetPrice.subtract(currentPrice).add(new BigDecimal("500"));
            // 2. Preserve remaining validity / original expiry date
            newActivatedAt = retailer.getAepsCommissionPlanActivatedAt() != null 
                    ? retailer.getAepsCommissionPlanActivatedAt() 
                    : Instant.now();
            newExpiresAt = retailer.getAepsCommissionPlanExpiresAt() != null 
                    ? retailer.getAepsCommissionPlanExpiresAt() 
                    : Instant.now().plus(365, ChronoUnit.DAYS);
        } else {
            // Fresh purchase from Free plan or after plan expiry
            priceToDebit = targetPrice;
            if (targetPrice.compareTo(BigDecimal.ZERO) > 0) {
                newActivatedAt = Instant.now();
                newExpiresAt = Instant.now().plus(365, ChronoUnit.DAYS);
            } else {
                newActivatedAt = null;
                newExpiresAt = null;
            }
        }

        if (priceToDebit.compareTo(BigDecimal.ZERO) > 0) {
            String idempotencyKey = "UPGRADE-" + retailerId + "-" + planId + "-" + System.currentTimeMillis();
            walletService.debitForService(
                    retailerId,
                    priceToDebit,
                    "Commission Plan Upgrade: " + targetPlan.getPlanName() + (hasActivePaidPlan ? " (Upgrade Difference)" : ""),
                    WalletTransactionContext.PLAN_UPGRADE,
                    "PLAN_UPGRADE",
                    ipAddress != null ? ipAddress : "127.0.0.1",
                    idempotencyKey
            );
        }

        retailer.setAepsCommissionPlan(targetPlan);
        retailer.setAepsCommissionPlanActivatedAt(newActivatedAt);
        retailer.setAepsCommissionPlanExpiresAt(newExpiresAt);
        userRepository.save(retailer);

        log.info("Retailer {} successfully upgraded commission plan to {} (Debited ₹{}, Expiry: {})", 
                retailer.getUsername(), targetPlan.getPlanName(), priceToDebit, newExpiresAt);

        Long daysRemaining = calculateDaysRemaining(newExpiresAt);
        return mapPlanToDtoWithUserContext(targetPlan, newActivatedAt, newExpiresAt, daysRemaining, false);
    }

    private CommissionDtos.CommissionPlanDto mapPlanToDto(CommissionPlan plan) {
        return mapPlanToDtoWithUserContext(plan, null, null, null, false);
    }

    private CommissionDtos.CommissionPlanDto mapPlanToDtoWithUserContext(
            CommissionPlan plan,
            Instant activatedAt,
            Instant expiresAt,
            Long daysRemaining,
            Boolean isExpired
    ) {
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
                slabs,
                activatedAt,
                expiresAt,
                daysRemaining,
                isExpired != null ? isExpired : false
        );
    }

    @Override
    @Transactional
    public void processBbpsCommission(BbpsTransaction bbpsTxn) {
        if (bbpsTxn == null || bbpsTxn.getId() == null) {
            log.warn("Cannot process BBPS commission: payload or ID is null.");
            return;
        }

        String status = bbpsTxn.getStatus();
        if (!"SUCCESS".equalsIgnoreCase(status)) {
            log.info("Skipping BBPS commission for non-successful transaction: ID={}, status={}", bbpsTxn.getId(), status);
            return;
        }

        String category = bbpsTxn.getCategory() != null ? bbpsTxn.getCategory().trim() : "";
        String serviceId = resolveBbpsServiceId(category);
        if (serviceId == null) {
            log.debug("Commission not configured or enabled for BBPS category: {}. Skipping. Txn ID: {}", category, bbpsTxn.getId());
            return;
        }

        String serviceDisplayName = "loan-repayment".equalsIgnoreCase(serviceId) ? "Loan Repayment" : "Electricity";
        String serviceType = "loan-repayment".equalsIgnoreCase(serviceId) ? "BBPS_LOAN_REPAYMENT" : "BBPS_ELECTRICITY";
        String bbpsCategory = "loan-repayment".equalsIgnoreCase(serviceId) ? "Loan Repayment" : "Electricity";
        String walletServiceName = "BBPS " + serviceDisplayName;

        String originalTxnId = bbpsTxn.getMerchantRefNo() != null ? bbpsTxn.getMerchantRefNo() : bbpsTxn.getId().toString();
        BigDecimal txnAmount = bbpsTxn.getAmount();

        if (txnAmount == null || txnAmount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Cannot process BBPS commission for transaction {}: invalid amount {}", originalTxnId, txnAmount);
            return;
        }

        // Idempotency check: verify if already processed
        if (commissionTransactionRepository.existsByOriginalTransactionId(originalTxnId)) {
            log.warn("Idempotency safeguard: Commission already processed for BBPS transaction ID: {}", originalTxnId);
            return;
        }

        log.info("Processing percentage commission for successful BBPS {} transaction: txnId={}, amount={}", serviceDisplayName, originalTxnId, txnAmount);

        // 1. Resolve Retailer
        User retailer = bbpsTxn.getUser();
        if (retailer == null || retailer.getId() == null) {
            log.error("BBPS Commission calculation failed: Retailer user not found on transaction {}", originalTxnId);
            return;
        }
        retailer = userRepository.findById(retailer.getId()).orElse(null);
        if (retailer == null) {
            log.error("BBPS Commission calculation failed: Retailer user not found in DB for ID: {}", bbpsTxn.getUser().getId());
            return;
        }

        // 2. Resolve Retailer Plan
        CommissionPlan plan = retailer.getAepsCommissionPlan();
        if (isPaidPlanExpired(retailer)) {
            log.info("Retailer {} paid commission plan {} expired on {}. Falling back to default Free plan.",
                    retailer.getUsername(), plan != null ? plan.getPlanName() : "", retailer.getAepsCommissionPlanExpiresAt());
            plan = null;
        }
        if (plan == null || !Boolean.TRUE.equals(plan.getEnabled())) {
            plan = commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")
                    .or(() -> commissionPlanRepository.findByServiceTypeAndPlanCode("AEPS_1", "FREE"))
                    .orElse(null);
        }

        if (plan == null) {
            log.warn("Active commission plan not found for retailer {}. Skipping BBPS commission for txn {}", retailer.getUsername(), originalTxnId);
            return;
        }

        // 3. Find matching BBPS Commission Config for service and plan with intelligent fallback
        Optional<BbpsCommissionConfig> configOpt = bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode(serviceId, plan.getPlanCode());
        if (configOpt.isEmpty()) {
            configOpt = bbpsCommissionConfigRepository.findByServiceIdAndPlan_Id(serviceId, plan.getId());
        }

        BbpsCommissionConfig config = null;
        if (configOpt.isPresent() && Boolean.TRUE.equals(configOpt.get().getEnabled()) 
                && configOpt.get().getRetailerPercentage() != null 
                && configOpt.get().getRetailerPercentage().compareTo(BigDecimal.ZERO) > 0) {
            config = configOpt.get();
        } else {
            // Intelligent fallback 1: If retailer plan config is missing, disabled, or 0%, check FREE plan for this service
            Optional<BbpsCommissionConfig> freeOpt = bbpsCommissionConfigRepository.findByServiceIdAndPlan_PlanCode(serviceId, "FREE");
            if (freeOpt.isPresent() && Boolean.TRUE.equals(freeOpt.get().getEnabled()) 
                    && freeOpt.get().getRetailerPercentage() != null 
                    && freeOpt.get().getRetailerPercentage().compareTo(BigDecimal.ZERO) > 0) {
                config = freeOpt.get();
                log.info("Retailer {} plan {} config missing/zero for {}. Falling back to active FREE plan config ({}%)",
                        retailer.getUsername(), plan.getPlanCode(), serviceId, config.getRetailerPercentage());
            } else {
                // Intelligent fallback 2: Check any active config for this service
                List<BbpsCommissionConfig> allConfigs = bbpsCommissionConfigRepository.findByServiceId(serviceId);
                Optional<BbpsCommissionConfig> anyActive = allConfigs.stream()
                        .filter(c -> Boolean.TRUE.equals(c.getEnabled()) && c.getRetailerPercentage() != null && c.getRetailerPercentage().compareTo(BigDecimal.ZERO) > 0)
                        .findFirst();
                if (anyActive.isPresent()) {
                    config = anyActive.get();
                    log.info("Using active fallback config from plan {} for service {} ({}%)",
                            config.getPlanCode(), serviceId, config.getRetailerPercentage());
                } else if (configOpt.isPresent() && Boolean.TRUE.equals(configOpt.get().getEnabled())) {
                    config = configOpt.get();
                }
            }
        }

        if (config == null || !Boolean.TRUE.equals(config.getEnabled())) {
            log.info("BBPS commission is disabled or not configured for service: {} and plan: {}. Skipping distribution for txn: {}",
                    serviceId, plan.getPlanCode(), originalTxnId);
            return;
        }

        BigDecimal retPct = config.getRetailerPercentage() != null ? config.getRetailerPercentage() : BigDecimal.ZERO;
        BigDecimal distPct = config.getDistributorPercentage() != null ? config.getDistributorPercentage() : BigDecimal.ZERO;
        BigDecimal sdPct = config.getSuperDistributorPercentage() != null ? config.getSuperDistributorPercentage() : BigDecimal.ZERO;

        // 4. Calculate Percentage Commissions: Commission = Eligible Amount * Percentage / 100
        BigDecimal hundred = new BigDecimal("100");
        BigDecimal retComm = txnAmount.multiply(retPct).divide(hundred, 2, RoundingMode.HALF_UP);
        BigDecimal distComm = txnAmount.multiply(distPct).divide(hundred, 2, RoundingMode.HALF_UP);
        BigDecimal sdComm = txnAmount.multiply(sdPct).divide(hundred, 2, RoundingMode.HALF_UP);

        log.info("Calculated BBPS percentages for txn {}: Ret({}% = ₹{}), Dist({}% = ₹{}), SD({}% = ₹{})",
                originalTxnId, retPct, retComm, distPct, distComm, sdPct, sdComm);

        // 5. Resolve Hierarchy with resilient multi-factor fallback
        User distributor = null;
        User superDistributor = null;

        User parent = resolveParentUser(retailer);
        if (parent != null) {
            boolean isDist = parent.getRoles().stream()
                    .anyMatch(r -> r.getName() == RoleName.DISTRIBUTOR);
            boolean isSuperDist = parent.getRoles().stream()
                    .anyMatch(r -> r.getName() == RoleName.SUPER_DISTRIBUTOR);

            if (isDist) {
                distributor = parent;
                User grandParent = resolveParentUser(distributor);
                if (grandParent != null && grandParent.getRoles().stream().anyMatch(r -> r.getName() == RoleName.SUPER_DISTRIBUTOR)) {
                    superDistributor = grandParent;
                }
            } else if (isSuperDist) {
                superDistributor = parent;
            }
        }

        String ip = "127.0.0.1";

        // 6. Credit Retailer
        if (retComm.compareTo(BigDecimal.ZERO) > 0) {
            creditBbpsBeneficiary(
                    retailer,
                    "RETAILER",
                    retailer,
                    plan,
                    config,
                    bbpsTxn,
                    txnAmount,
                    retComm,
                    retPct,
                    ip,
                    "BBPS " + serviceDisplayName + " Commission - ₹" + txnAmount + " (" + retPct + "%)",
                    serviceType,
                    bbpsCategory,
                    walletServiceName
            );
        }

        // 7. Credit Distributor (if mapped in hierarchy)
        if (distributor != null && distComm.compareTo(BigDecimal.ZERO) > 0) {
            creditBbpsBeneficiary(
                    distributor,
                    "DISTRIBUTOR",
                    retailer,
                    plan,
                    config,
                    bbpsTxn,
                    txnAmount,
                    distComm,
                    distPct,
                    ip,
                    "BBPS " + serviceDisplayName + " Commission (Distributor) - ₹" + txnAmount + " (" + distPct + "%)",
                    serviceType,
                    bbpsCategory,
                    walletServiceName
            );
        }

        // 8. Credit Super Distributor (if mapped in hierarchy)
        if (superDistributor != null && sdComm.compareTo(BigDecimal.ZERO) > 0) {
            creditBbpsBeneficiary(
                    superDistributor,
                    "SUPER_DISTRIBUTOR",
                    retailer,
                    plan,
                    config,
                    bbpsTxn,
                    txnAmount,
                    sdComm,
                    sdPct,
                    ip,
                    "BBPS " + serviceDisplayName + " Commission (Super Distributor) - ₹" + txnAmount + " (" + sdPct + "%)",
                    serviceType,
                    bbpsCategory,
                    walletServiceName
            );
        }

        log.info("BBPS commission distribution completed for txn {} ({}): Retailer(₹{}), Distributor(₹{}), SuperDistributor(₹{})",
                originalTxnId, serviceDisplayName, retComm, (distributor != null ? distComm : BigDecimal.ZERO), (superDistributor != null ? sdComm : BigDecimal.ZERO));
    }

    private String resolveBbpsServiceId(String category) {
        if (category == null || category.isBlank()) return null;
        String cat = category.trim().toLowerCase();
        if (cat.equals("loan repayment") || cat.equals("loan-repayment") || cat.equals("loans")) {
            return "loan-repayment";
        }
        if (cat.equals("electricity") || cat.equals("prepaid meter") || cat.equals("prepaid-meter")) {
            return "electricity";
        }
        return null;
    }

    private void creditBbpsBeneficiary(
            User beneficiary,
            String role,
            User retailer,
            CommissionPlan plan,
            BbpsCommissionConfig config,
            BbpsTransaction bbpsTxn,
            BigDecimal txnAmount,
            BigDecimal commAmount,
            BigDecimal appliedPercentage,
            String ip,
            String narration,
            String serviceType,
            String bbpsCategory,
            String walletServiceName
    ) {
        String originalTxnId = bbpsTxn.getMerchantRefNo() != null ? bbpsTxn.getMerchantRefNo() : bbpsTxn.getId().toString();
        String commRef = generateCommissionReference();
        String idempotencyKey = "COMM-BBPS-" + originalTxnId + "-" + role + "-" + beneficiary.getId();

        try {
            // Credit wallet using existing enterprise wallet engine
            walletService.creditForService(
                    beneficiary.getId(),
                    commAmount,
                    narration,
                    WalletTransactionContext.COMMISSION,
                    walletServiceName,
                    ip,
                    idempotencyKey
            );

            // Record in immutable commission audit ledger
            CommissionTransaction commTxn = CommissionTransaction.builder()
                    .commissionReference(commRef)
                    .originalTransactionId(originalTxnId)
                    .serviceType(serviceType)
                    .bbpsCategory(bbpsCategory)
                    .plan(plan)
                    .planCode(plan != null ? plan.getPlanCode() : null)
                    .slab(null)
                    .slabMin(null)
                    .slabMax(null)
                    .appliedPercentage(appliedPercentage)
                    .commissionBaseAmount(txnAmount)
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
            log.info("Created BBPS commission ledger entry: ref={}, beneficiary={}, role={}, amount=₹{}, rate={}%",
                    commRef, beneficiary.getUsername(), role, commAmount, appliedPercentage);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            log.warn("BBPS commission entry already exists for txn {}, role {}, user {}. Skipping duplicate.",
                    originalTxnId, role, beneficiary.getId());
        } catch (Exception e) {
            log.error("Failed to credit BBPS commission for txn {}, user {}: {}", originalTxnId, beneficiary.getId(), e.getMessage(), e);
            throw e;
        }
    }

    // ─── BBPS PERCENTAGE CONFIGURATION MANAGEMENT ──────────────────────────────

    private static final List<String[]> REGISTERED_BBPS_SERVICES = List.of(
            new String[]{"loan-repayment", "Loan Repayment"},
            new String[]{"fastag", "Fastag"},
            new String[]{"dth", "DTH"},
            new String[]{"mobile-prepaid", "Mobile Prepaid"},
            new String[]{"housing-society", "Housing Society"},
            new String[]{"motor-insurance", "Motor Insurance"},
            new String[]{"municipal-taxes", "Municipal Taxes"},
            new String[]{"electricity", "Electricity"},
            new String[]{"credit-card", "Credit Card"},
            new String[]{"water", "Water"},
            new String[]{"piped-gas", "Piped Gas"},
            new String[]{"lpg-gas", "LPG Gas"},
            new String[]{"broadband", "Broadband Postpaid"},
            new String[]{"landline", "Landline Postpaid"},
            new String[]{"life-insurance", "Life Insurance"},
            new String[]{"agent-collection", "Agent Collection"},
            new String[]{"education-fees", "Education Fees"},
            new String[]{"cable-tv", "Cable TV"},
            new String[]{"health-insurance", "Health Insurance"},
            new String[]{"hospital", "Hospital & Pathology"},
            new String[]{"rental", "Rental"},
            new String[]{"recurring-deposit", "Recurring Deposit"},
            new String[]{"clubs-associations", "Clubs and Associations"},
            new String[]{"prepaid-meter", "Prepaid Meter"},
            new String[]{"nps", "National Pension System"},
            new String[]{"metro", "Metro Card Recharge"},
            new String[]{"donations", "Donations & Temple"},
            new String[]{"toll", "Toll Plaza"},
            new String[]{"traffic-challan", "Traffic Challan"},
            new String[]{"gas-cylinder", "Gas Cylinder Booking"},
            new String[]{"subscription", "Subscription Fees"},
            new String[]{"mfi-emi", "MFI Loan Repayment"},
            new String[]{"general-insurance", "General Insurance"},
            new String[]{"other", "Other Services"}
    );

    @Override
    @Transactional(readOnly = true)
    public List<CommissionDtos.BbpsServiceStatusDto> getBbpsServiceStatuses() {
        List<CommissionDtos.BbpsServiceStatusDto> result = new ArrayList<>();

        for (String[] svc : REGISTERED_BBPS_SERVICES) {
            String sId = svc[0];
            String sName = svc[1];

            List<BbpsCommissionConfig> configs = bbpsCommissionConfigRepository.findByServiceId(sId);
            boolean configured = !configs.isEmpty();
            boolean enabled = configured && configs.stream().anyMatch(c -> Boolean.TRUE.equals(c.getEnabled()));
            int activeCount = configured ? (int) configs.stream().filter(c -> Boolean.TRUE.equals(c.getEnabled())).count() : 0;

            result.add(new CommissionDtos.BbpsServiceStatusDto(sId, sName, configured, enabled, activeCount));
        }

        return result;
    }

    @Override
    @Transactional
    public List<CommissionDtos.BbpsCommissionConfigDto> getBbpsConfigs(String serviceId) {
        String sId = (serviceId != null && !serviceId.isBlank()) ? serviceId.trim().toLowerCase() : "loan-repayment";

        List<BbpsCommissionConfig> configs = bbpsCommissionConfigRepository.findByServiceIdWithPlan(sId);

        // Auto-initialize configs from existing AEPS_1 membership plans if not yet seeded for this service
        if (configs.isEmpty()) {
            List<CommissionPlan> plans = commissionPlanRepository.findByServiceTypeWithSlabs("AEPS_1");
            if (!plans.isEmpty()) {
                String serviceName = REGISTERED_BBPS_SERVICES.stream()
                        .filter(s -> s[0].equalsIgnoreCase(sId))
                        .map(s -> s[1])
                        .findFirst()
                        .orElse(sId);

                boolean isPreSeeded = "loan-repayment".equalsIgnoreCase(sId) || "electricity".equalsIgnoreCase(sId);

                for (CommissionPlan plan : plans) {
                    BigDecimal ret = isPreSeeded ? getDefaultPercentage(plan.getPlanCode(), "RETAILER") : BigDecimal.ZERO;
                    BigDecimal dist = isPreSeeded ? getDefaultPercentage(plan.getPlanCode(), "DISTRIBUTOR") : BigDecimal.ZERO;
                    BigDecimal sd = isPreSeeded ? getDefaultPercentage(plan.getPlanCode(), "SUPER_DISTRIBUTOR") : BigDecimal.ZERO;

                    BbpsCommissionConfig newConfig = BbpsCommissionConfig.builder()
                            .serviceId(sId)
                            .serviceName(serviceName)
                            .commissionModel("PERCENTAGE")
                            .plan(plan)
                            .planCode(plan.getPlanCode())
                            .retailerPercentage(ret)
                            .distributorPercentage(dist)
                            .superDistributorPercentage(sd)
                            .enabled(isPreSeeded)
                            .build();

                    bbpsCommissionConfigRepository.save(newConfig);
                }
                configs = bbpsCommissionConfigRepository.findByServiceIdWithPlan(sId);
            }
        }

        return configs.stream().map(this::mapBbpsConfigToDto).collect(Collectors.toList());
    }

    private BigDecimal getDefaultPercentage(String planCode, String role) {
        if ("FREE".equalsIgnoreCase(planCode)) {
            if ("RETAILER".equals(role)) return new BigDecimal("0.2000");
            if ("DISTRIBUTOR".equals(role)) return new BigDecimal("0.1000");
            return new BigDecimal("0.0500");
        } else if ("PLAN_2999".equalsIgnoreCase(planCode)) {
            if ("RETAILER".equals(role)) return new BigDecimal("0.3500");
            if ("DISTRIBUTOR".equals(role)) return new BigDecimal("0.1500");
            return new BigDecimal("0.1000");
        } else if ("PLAN_4999".equalsIgnoreCase(planCode)) {
            if ("RETAILER".equals(role)) return new BigDecimal("0.4500");
            if ("DISTRIBUTOR".equals(role)) return new BigDecimal("0.2000");
            return new BigDecimal("0.1500");
        } else if ("PLAN_7999".equalsIgnoreCase(planCode)) {
            if ("RETAILER".equals(role)) return new BigDecimal("0.6000");
            if ("DISTRIBUTOR".equals(role)) return new BigDecimal("0.2500");
            return new BigDecimal("0.1500");
        }
        return BigDecimal.ZERO;
    }

    @Override
    @Transactional
    public CommissionDtos.BbpsCommissionConfigDto updateBbpsConfig(
            UUID configId,
            CommissionDtos.UpdateBbpsConfigRequest request,
            UUID adminId,
            String ipAddress
    ) {
        enforceAdmin(adminId);
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin user not found"));

        BbpsCommissionConfig config = bbpsCommissionConfigRepository.findById(configId)
                .orElseThrow(() -> new IllegalArgumentException("BBPS commission config not found: " + configId));

        BigDecimal ret = request.retailerPercentage() != null ? request.retailerPercentage() : BigDecimal.ZERO;
        BigDecimal dist = request.distributorPercentage() != null ? request.distributorPercentage() : BigDecimal.ZERO;
        BigDecimal sd = request.superDistributorPercentage() != null ? request.superDistributorPercentage() : BigDecimal.ZERO;

        if (ret.compareTo(BigDecimal.ZERO) < 0 || dist.compareTo(BigDecimal.ZERO) < 0 || sd.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Commission percentages cannot be negative.");
        }

        BigDecimal hundred = new BigDecimal("100.0000");
        if (ret.compareTo(hundred) > 0 || dist.compareTo(hundred) > 0 || sd.compareTo(hundred) > 0) {
            throw new IllegalArgumentException("Commission percentage cannot exceed 100%.");
        }

        BigDecimal total = ret.add(dist).add(sd);
        if (total.compareTo(hundred) > 0) {
            throw new IllegalArgumentException("Total combined commission percentage (" + total + "%) cannot exceed 100%.");
        }

        // Record Audit Trail
        BbpsCommissionConfigAudit audit = BbpsCommissionConfigAudit.builder()
                .config(config)
                .serviceId(config.getServiceId())
                .planCode(config.getPlanCode())
                .adminUser(admin)
                .adminUsername(admin.getUsername())
                .prevRetailerPercentage(config.getRetailerPercentage())
                .prevDistributorPercentage(config.getDistributorPercentage())
                .prevSuperDistributorPercentage(config.getSuperDistributorPercentage())
                .prevEnabled(config.getEnabled())
                .newRetailerPercentage(ret)
                .newDistributorPercentage(dist)
                .newSuperDistributorPercentage(sd)
                .newEnabled(request.enabled() != null ? request.enabled() : config.getEnabled())
                .ipAddress(ipAddress != null ? ipAddress : "127.0.0.1")
                .createdAt(Instant.now())
                .build();
        bbpsCommissionConfigAuditRepository.save(audit);

        boolean effectiveEnabled = Boolean.TRUE.equals(request.enabled());
        if (request.enabled() == null) {
            effectiveEnabled = (ret.compareTo(BigDecimal.ZERO) > 0 || dist.compareTo(BigDecimal.ZERO) > 0 || sd.compareTo(BigDecimal.ZERO) > 0)
                    || Boolean.TRUE.equals(config.getEnabled());
        }

        // Update Configuration
        config.setRetailerPercentage(ret);
        config.setDistributorPercentage(dist);
        config.setSuperDistributorPercentage(sd);
        config.setEnabled(effectiveEnabled);
        audit.setNewEnabled(effectiveEnabled);
        config.setUpdatedBy(admin);
        config.setUpdatedAt(Instant.now());

        BbpsCommissionConfig saved = bbpsCommissionConfigRepository.save(config);
        log.info("Admin {} updated BBPS commission config for service: {}, plan: {} (Ret: {}%, Dist: {}%, SD: {}%, Enabled: {})",
                admin.getUsername(), config.getServiceId(), config.getPlanCode(), ret, dist, sd, config.getEnabled());

        return mapBbpsConfigToDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CommissionDtos.BbpsAuditDto> getBbpsAudits(String serviceId) {
        String sId = (serviceId != null && !serviceId.isBlank()) ? serviceId.trim().toLowerCase() : "loan-repayment";
        List<BbpsCommissionConfigAudit> audits = bbpsCommissionConfigAuditRepository.findByServiceIdOrderByCreatedAtDesc(sId);
        return audits.stream().map(a -> new CommissionDtos.BbpsAuditDto(
                a.getId(),
                a.getServiceId(),
                a.getPlanCode(),
                a.getAdminUsername(),
                a.getPrevRetailerPercentage(),
                a.getPrevDistributorPercentage(),
                a.getPrevSuperDistributorPercentage(),
                a.getPrevEnabled(),
                a.getNewRetailerPercentage(),
                a.getNewDistributorPercentage(),
                a.getNewSuperDistributorPercentage(),
                a.getNewEnabled(),
                a.getIpAddress(),
                a.getCreatedAt()
        )).collect(Collectors.toList());
    }

    private CommissionDtos.BbpsCommissionConfigDto mapBbpsConfigToDto(BbpsCommissionConfig config) {
        CommissionPlan plan = config.getPlan();
        String planName = plan != null ? plan.getPlanName() : config.getPlanCode();
        BigDecimal price = plan != null && plan.getPrice() != null ? plan.getPrice() : BigDecimal.ZERO;

        return new CommissionDtos.BbpsCommissionConfigDto(
                config.getId(),
                config.getServiceId(),
                config.getServiceName(),
                config.getCommissionModel(),
                plan != null ? plan.getId() : null,
                config.getPlanCode(),
                planName,
                price,
                config.getRetailerPercentage(),
                config.getDistributorPercentage(),
                config.getSuperDistributorPercentage(),
                config.getTotalPercentage(),
                config.getEnabled(),
                config.getUpdatedAt()
        );
    }

    private CommissionDtos.CommissionTransactionDto mapTransactionToDto(CommissionTransaction txn) {
        String slabRange;
        if ("FIXED".equalsIgnoreCase(txn.getCommissionMode())) {
            BigDecimal fixedVal = txn.getAppliedCommissionValue() != null ? txn.getAppliedCommissionValue() : txn.getCommissionAmount();
            slabRange = "₹" + fixedVal.setScale(2, RoundingMode.HALF_UP) + " (Fixed)";
        } else if (txn.getAppliedCommissionValue() != null) {
            slabRange = txn.getAppliedCommissionValue() + "%";
        } else if (txn.getAppliedPercentage() != null) {
            slabRange = txn.getAppliedPercentage() + "%";
        } else if (txn.getSlabMin() != null && txn.getSlabMax() != null) {
            slabRange = "₹" + txn.getSlabMin() + " - ₹" + txn.getSlabMax();
        } else {
            slabRange = "Percentage";
        }

        User beneficiary = txn.getBeneficiaryUser();
        User retailer = txn.getRetailerUser();

        return new CommissionDtos.CommissionTransactionDto(
                txn.getId(),
                txn.getCommissionReference(),
                txn.getOriginalTransactionId(),
                txn.getServiceType(),
                txn.getPlanCode(),
                slabRange,
                txn.getTransactionAmount(),
                beneficiary != null && beneficiary.getId() != null ? beneficiary.getId().toString() : null,
                beneficiary != null ? beneficiary.getFullName() : null,
                beneficiary != null ? beneficiary.getUsername() : null,
                txn.getBeneficiaryRole(),
                retailer != null && retailer.getId() != null ? retailer.getId().toString() : null,
                retailer != null ? retailer.getFullName() : null,
                retailer != null ? retailer.getUsername() : null,
                txn.getCommissionAmount(),
                txn.getStatus(),
                txn.getRemarks(),
                txn.getCreatedAt(),
                txn.getAppliedPercentage(),
                txn.getCommissionBaseAmount(),
                txn.getBbpsCategory(),
                txn.getCommissionMode(),
                txn.getOperatorCode(),
                txn.getOperatorName(),
                txn.getAppliedCommissionValue(),
                txn.getMobileNo()
        );
    }

    @Override
    @Transactional
    public int reconcileUncreditedBbpsCommissions() {
        log.info("Running automated reconciliation for uncredited BBPS transactions...");
        List<BbpsTransaction> successTxns = bbpsTransactionRepository.findByStatus("SUCCESS");
        int creditedCount = 0;
        for (BbpsTransaction txn : successTxns) {
            String ref = txn.getMerchantRefNo() != null ? txn.getMerchantRefNo() : txn.getId().toString();
            if (!commissionTransactionRepository.existsByOriginalTransactionId(ref)) {
                try {
                    processBbpsCommission(txn);
                    if (commissionTransactionRepository.existsByOriginalTransactionId(ref)) {
                        creditedCount++;
                        log.info("Successfully reconciled and credited missing commission for BBPS txn: {}", ref);
                    }
                } catch (Exception e) {
                    log.error("Failed to reconcile commission for BBPS txn {}: {}", ref, e.getMessage());
                }
            }
        }
        log.info("Completed BBPS commission reconciliation. Credited {} uncredited transactions.", creditedCount);
        return creditedCount;
    }

    // ─── MOBILE & DTH RECHARGE COMMISSION IMPLEMENTATION ───────────────────────

    private String resolveOperatorName(String operatorCode) {
        if (operatorCode == null) return "Mobile Operator";
        String op = operatorCode.trim().toUpperCase();
        if (appProperties.venusRecharge() != null && appProperties.venusRecharge().operators() != null) {
            for (var o : appProperties.venusRecharge().operators()) {
                if (o.operatorCode().equalsIgnoreCase(op)) {
                    return o.name();
                }
            }
        }
        return switch (op) {
            case "JRE" -> "Jio Recharge";
            case "JTU" -> "Jio Topup";
            case "ATL" -> "Airtel";
            case "ACL" -> "Airtel Live";
            case "VDF" -> "Vi (Vodafone Idea)";
            case "BNT" -> "BSNL Topup";
            case "BNV" -> "BSNL Validity";
            case "VCT" -> "Videocon Topup";
            case "VCV" -> "Videocon Validity";
            default -> op;
        };
    }

    @Override
    @Transactional
    public void processRechargeCommission(Recharge recharge) {
        if (recharge == null || recharge.getMerchantRefNo() == null) {
            log.warn("Cannot process Recharge commission: payload or merchantRefNo is null.");
            return;
        }

        if (recharge.getStatus() != TransactionStatus.SUCCESS) {
            log.info("Skipping Recharge commission for non-successful transaction: Ref={}, status={}",
                    recharge.getMerchantRefNo(), recharge.getStatus());
            return;
        }

        String serviceType = recharge.getServiceType() != null ? recharge.getServiceType().trim().toUpperCase() : "MR";
        // Mobile Recharge only in this phase. DTH must remain inactive until explicitly implemented.
        if (!"MR".equalsIgnoreCase(serviceType) && !"MOBILE_RECHARGE".equalsIgnoreCase(serviceType)) {
            log.info("Commission only active for Mobile Recharge (MR). Skipping DTH or other type: {}", serviceType);
            return;
        }

        String merchantRefNo = recharge.getMerchantRefNo();
        BigDecimal txnAmount = recharge.getAmount();
        if (txnAmount == null || txnAmount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("Cannot process Recharge commission for transaction {}: invalid amount {}", merchantRefNo, txnAmount);
            return;
        }

        // Database/Repository idempotency check
        if (commissionTransactionRepository.existsByOriginalTransactionId(merchantRefNo)) {
            log.warn("Idempotency safeguard: Commission already processed for Recharge transaction: {}", merchantRefNo);
            return;
        }

        log.info("Processing commission for successful Mobile Recharge transaction: ref={}, operator={}, amount={}",
                merchantRefNo, recharge.getOperatorCode(), txnAmount);

        // 1. Resolve Retailer
        User retailer = recharge.getUser();
        if (retailer == null || retailer.getId() == null) {
            log.error("Recharge Commission calculation failed: Retailer user not found on transaction {}", merchantRefNo);
            return;
        }
        retailer = userRepository.findById(retailer.getId()).orElse(null);
        if (retailer == null) {
            log.error("Recharge Commission calculation failed: Retailer user not found in DB for ID: {}", recharge.getUser().getId());
            return;
        }

        // 2. Resolve Retailer Plan
        CommissionPlan plan = retailer.getAepsCommissionPlan();
        if (isPaidPlanExpired(retailer)) {
            log.info("Retailer {} paid commission plan {} expired on {}. Falling back to default Free plan.",
                    retailer.getUsername(), plan != null ? plan.getPlanName() : "", retailer.getAepsCommissionPlanExpiresAt());
            plan = null;
        }
        if (plan == null || !Boolean.TRUE.equals(plan.getEnabled())) {
            plan = commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")
                    .or(() -> commissionPlanRepository.findByServiceTypeAndPlanCode("AEPS_1", "FREE"))
                    .orElse(null);
        }

        if (plan == null) {
            log.warn("Active commission plan not found for retailer {}. Skipping Recharge commission for txn {}", retailer.getUsername(), merchantRefNo);
            return;
        }

        String opCode = recharge.getOperatorCode() != null ? recharge.getOperatorCode().trim().toUpperCase() : "";

        // 3. Find matching Recharge Commission Config for operator and plan with intelligent fallback
        Optional<RechargeCommissionConfig> configOpt = rechargeCommissionConfigRepository
                .findByServiceTypeAndOperatorCodeAndPlan_PlanCode("MOBILE_RECHARGE", opCode, plan.getPlanCode());
        if (configOpt.isEmpty()) {
            configOpt = rechargeCommissionConfigRepository
                    .findByServiceTypeAndOperatorCodeAndPlan_Id("MOBILE_RECHARGE", opCode, plan.getId());
        }

        RechargeCommissionConfig config = null;
        if (configOpt.isPresent() && Boolean.TRUE.equals(configOpt.get().getEnabled())
                && configOpt.get().getRetailerValue() != null
                && configOpt.get().getRetailerValue().compareTo(BigDecimal.ZERO) > 0) {
            config = configOpt.get();
        } else {
            // Fallback 1: FREE plan for this operator
            Optional<RechargeCommissionConfig> freeOpt = rechargeCommissionConfigRepository
                    .findByServiceTypeAndOperatorCodeAndPlan_PlanCode("MOBILE_RECHARGE", opCode, "FREE");
            if (freeOpt.isPresent() && Boolean.TRUE.equals(freeOpt.get().getEnabled())
                    && freeOpt.get().getRetailerValue() != null
                    && freeOpt.get().getRetailerValue().compareTo(BigDecimal.ZERO) > 0) {
                config = freeOpt.get();
                log.info("Retailer {} plan {} config missing/zero for operator {}. Falling back to active FREE plan config",
                        retailer.getUsername(), plan.getPlanCode(), opCode);
            } else {
                // Fallback 2: Any active config for this operator
                List<RechargeCommissionConfig> allConfigs = rechargeCommissionConfigRepository
                        .findByServiceTypeAndOperatorCode("MOBILE_RECHARGE", opCode);
                Optional<RechargeCommissionConfig> anyActive = allConfigs.stream()
                        .filter(c -> Boolean.TRUE.equals(c.getEnabled()) && c.getRetailerValue() != null && c.getRetailerValue().compareTo(BigDecimal.ZERO) > 0)
                        .findFirst();
                if (anyActive.isPresent()) {
                    config = anyActive.get();
                } else if (configOpt.isPresent() && Boolean.TRUE.equals(configOpt.get().getEnabled())) {
                    config = configOpt.get();
                }
            }
        }

        if (config == null || !Boolean.TRUE.equals(config.getEnabled())) {
            log.info("Mobile Recharge commission is disabled or not configured for operator: {} and plan: {}. Skipping distribution for txn: {}",
                    opCode, plan.getPlanCode(), merchantRefNo);
            return;
        }

        String mode = config.getCommissionMode() != null ? config.getCommissionMode().trim().toUpperCase() : "PERCENTAGE";
        BigDecimal retVal = config.getRetailerValue() != null ? config.getRetailerValue() : BigDecimal.ZERO;
        BigDecimal distVal = config.getDistributorValue() != null ? config.getDistributorValue() : BigDecimal.ZERO;
        BigDecimal sdVal = config.getSuperDistributorValue() != null ? config.getSuperDistributorValue() : BigDecimal.ZERO;

        BigDecimal retComm;
        BigDecimal distComm;
        BigDecimal sdComm;

        if ("FIXED".equals(mode)) {
            // Mode B: Fixed Rupee Commission per successful recharge
            retComm = retVal.setScale(2, RoundingMode.HALF_UP);
            distComm = distVal.setScale(2, RoundingMode.HALF_UP);
            sdComm = sdVal.setScale(2, RoundingMode.HALF_UP);
            log.info("Calculated Mobile Recharge FIXED commissions for txn {}: Ret(₹{}), Dist(₹{}), SD(₹{})",
                    merchantRefNo, retComm, distComm, sdComm);
        } else {
            // Mode A: Percentage-based: Commission = Eligible Recharge Amount * Percentage / 100
            BigDecimal hundred = new BigDecimal("100");
            retComm = txnAmount.multiply(retVal).divide(hundred, 2, RoundingMode.HALF_UP);
            distComm = txnAmount.multiply(distVal).divide(hundred, 2, RoundingMode.HALF_UP);
            sdComm = txnAmount.multiply(sdVal).divide(hundred, 2, RoundingMode.HALF_UP);
            log.info("Calculated Mobile Recharge PERCENTAGE commissions for txn {}: Ret({}% = ₹{}), Dist({}% = ₹{}), SD({}% = ₹{})",
                    merchantRefNo, retVal, retComm, distVal, distComm, sdVal, sdComm);
        }

        // 4. Resolve Hierarchy with resilient multi-factor fallback
        User distributor = null;
        User superDistributor = null;

        User parent = resolveParentUser(retailer);
        if (parent != null) {
            boolean isDist = parent.getRoles().stream()
                    .anyMatch(r -> r.getName() == RoleName.DISTRIBUTOR);
            boolean isSuperDist = parent.getRoles().stream()
                    .anyMatch(r -> r.getName() == RoleName.SUPER_DISTRIBUTOR);

            if (isDist) {
                distributor = parent;
                User grandParent = resolveParentUser(distributor);
                if (grandParent != null && grandParent.getRoles().stream().anyMatch(r -> r.getName() == RoleName.SUPER_DISTRIBUTOR)) {
                    superDistributor = grandParent;
                }
            } else if (isSuperDist) {
                superDistributor = parent;
            }
        }

        String ip = "127.0.0.1";
        String operatorDisplay = config.getOperatorName() != null ? config.getOperatorName() : opCode;
        String modeDisplay = "FIXED".equals(mode) ? ("₹" + retVal + " Fixed") : (retVal + "%");

        // 5. Credit Retailer
        if (retComm.compareTo(BigDecimal.ZERO) > 0) {
            creditRechargeBeneficiary(
                    retailer,
                    "RETAILER",
                    retailer,
                    plan,
                    config,
                    recharge,
                    txnAmount,
                    retComm,
                    retVal,
                    mode,
                    ip,
                    "Mobile Recharge Commission (" + operatorDisplay + ") - ₹" + txnAmount + " (" + modeDisplay + ")"
            );
        }

        // 6. Credit Distributor (if mapped in hierarchy)
        if (distributor != null && distComm.compareTo(BigDecimal.ZERO) > 0) {
            String distModeDisplay = "FIXED".equals(mode) ? ("₹" + distVal + " Fixed") : (distVal + "%");
            creditRechargeBeneficiary(
                    distributor,
                    "DISTRIBUTOR",
                    retailer,
                    plan,
                    config,
                    recharge,
                    txnAmount,
                    distComm,
                    distVal,
                    mode,
                    ip,
                    "Mobile Recharge Commission (Distributor - " + operatorDisplay + ") - ₹" + txnAmount + " (" + distModeDisplay + ")"
            );
        }

        // 7. Credit Super Distributor (if mapped in hierarchy)
        if (superDistributor != null && sdComm.compareTo(BigDecimal.ZERO) > 0) {
            String sdModeDisplay = "FIXED".equals(mode) ? ("₹" + sdVal + " Fixed") : (sdVal + "%");
            creditRechargeBeneficiary(
                    superDistributor,
                    "SUPER_DISTRIBUTOR",
                    retailer,
                    plan,
                    config,
                    recharge,
                    txnAmount,
                    sdComm,
                    sdVal,
                    mode,
                    ip,
                    "Mobile Recharge Commission (Super Distributor - " + operatorDisplay + ") - ₹" + txnAmount + " (" + sdModeDisplay + ")"
            );
        }

        log.info("Recharge commission distribution finished for txn {}: Retailer(₹{}), Distributor(₹{}), SuperDistributor(₹{})",
                merchantRefNo, retComm, (distributor != null ? distComm : BigDecimal.ZERO), (superDistributor != null ? sdComm : BigDecimal.ZERO));
    }

    private void creditRechargeBeneficiary(
            User beneficiary,
            String role,
            User retailer,
            CommissionPlan plan,
            RechargeCommissionConfig config,
            Recharge recharge,
            BigDecimal txnAmount,
            BigDecimal commAmount,
            BigDecimal appliedValue,
            String mode,
            String ip,
            String narration
    ) {
        String commRef = generateCommissionReference();
        String idempotencyKey = "COMM-" + recharge.getMerchantRefNo() + "-" + role + "-" + beneficiary.getId();

        try {
            // Credit wallet using enterprise wallet engine
            walletService.creditForService(
                    beneficiary.getId(),
                    commAmount,
                    narration,
                    WalletTransactionContext.COMMISSION,
                    "Mobile Recharge",
                    ip,
                    idempotencyKey
            );

            // Record in immutable commission audit ledger
            CommissionTransaction commTxn = CommissionTransaction.builder()
                    .commissionReference(commRef)
                    .originalTransactionId(recharge.getMerchantRefNo())
                    .serviceType("MOBILE_RECHARGE")
                    .plan(plan)
                    .planCode(plan != null ? plan.getPlanCode() : null)
                    .commissionMode(mode)
                    .operatorCode(recharge.getOperatorCode())
                    .operatorName(config != null ? config.getOperatorName() : recharge.getOperatorCode())
                    .appliedCommissionValue(appliedValue)
                    .appliedPercentage("PERCENTAGE".equals(mode) ? appliedValue : null)
                    .commissionBaseAmount(txnAmount)
                    .transactionAmount(txnAmount)
                    .beneficiaryUser(beneficiary)
                    .beneficiaryRole(role)
                    .retailerUser(retailer)
                    .commissionAmount(commAmount)
                    .mobileNo(recharge.getMobileNo())
                    .status("SUCCESS")
                    .remarks(narration)
                    .createdAt(Instant.now())
                    .build();

            commissionTransactionRepository.save(commTxn);
            log.info("Created Recharge commission ledger entry: ref={}, beneficiary={}, role={}, amount=₹{}, mode={}",
                    commRef, beneficiary.getUsername(), role, commAmount, mode);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            log.warn("Recharge commission entry already exists for txn {}, role {}, user {}. Skipping duplicate.",
                    recharge.getMerchantRefNo(), role, beneficiary.getId());
        } catch (Exception e) {
            log.error("Failed to credit Recharge commission for txn {}, user {}: {}",
                    recharge.getMerchantRefNo(), beneficiary.getId(), e.getMessage(), e);
            throw e;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<CommissionDtos.RechargeOperatorDto> getRechargeOperators(String serviceCategory) {
        String category = (serviceCategory != null && !serviceCategory.isBlank()) ? serviceCategory.trim().toUpperCase() : "MOBILE";
        if ("DTH".equals(category)) {
            // DTH is disabled / coming soon as per specification
            return List.of(
                    new CommissionDtos.RechargeOperatorDto("TATASKY", "Tata Play (Tata Sky)", "DTH", false, false, "PERCENTAGE", 0),
                    new CommissionDtos.RechargeOperatorDto("AIRTEL_DTH", "Airtel Digital TV", "DTH", false, false, "PERCENTAGE", 0),
                    new CommissionDtos.RechargeOperatorDto("DISH_TV", "Dish TV", "DTH", false, false, "PERCENTAGE", 0),
                    new CommissionDtos.RechargeOperatorDto("VIDEOCON_D2H", "Videocon d2h", "DTH", false, false, "PERCENTAGE", 0),
                    new CommissionDtos.RechargeOperatorDto("SUN_DIRECT", "Sun Direct", "DTH", false, false, "PERCENTAGE", 0)
            );
        }

        // Authoritative mobile operators from provider catalog
        Map<String, String> operatorMap = new LinkedHashMap<>();
        if (appProperties.venusRecharge() != null && appProperties.venusRecharge().operators() != null) {
            for (var op : appProperties.venusRecharge().operators()) {
                operatorMap.put(op.operatorCode().trim().toUpperCase(), op.name());
            }
        }
        if (operatorMap.isEmpty()) {
            operatorMap.put("JRE", "Jio Recharge");
            operatorMap.put("JTU", "Jio Topup");
            operatorMap.put("ATL", "Airtel");
            operatorMap.put("ACL", "Airtel Live");
            operatorMap.put("VDF", "Vi (Vodafone Idea)");
            operatorMap.put("BNT", "BSNL Topup");
            operatorMap.put("BNV", "BSNL Validity");
            operatorMap.put("VCT", "Videocon Topup");
            operatorMap.put("VCV", "Videocon Validity");
        }

        List<CommissionDtos.RechargeOperatorDto> result = new ArrayList<>();
        for (Map.Entry<String, String> entry : operatorMap.entrySet()) {
            String code = entry.getKey();
            String name = entry.getValue();

            List<RechargeCommissionConfig> configs = rechargeCommissionConfigRepository.findByServiceTypeAndOperatorCode("MOBILE_RECHARGE", code);
            boolean configured = !configs.isEmpty();
            boolean anyEnabled = configs.stream().anyMatch(c -> Boolean.TRUE.equals(c.getEnabled()));
            String commMode = configs.isEmpty() ? "PERCENTAGE" : configs.get(0).getCommissionMode();
            int activePlans = (int) configs.stream().filter(c -> Boolean.TRUE.equals(c.getEnabled())).count();

            result.add(new CommissionDtos.RechargeOperatorDto(
                    code,
                    name,
                    "MOBILE",
                    configured,
                    anyEnabled,
                    commMode,
                    activePlans
            ));
        }

        return result;
    }

    @Override
    @Transactional
    public List<CommissionDtos.RechargeCommissionConfigDto> getRechargeConfigs(String serviceType, String operatorCode) {
        String st = (serviceType != null && !serviceType.isBlank()) ? serviceType.trim().toUpperCase() : "MOBILE_RECHARGE";
        String op = (operatorCode != null && !operatorCode.isBlank()) ? operatorCode.trim().toUpperCase() : "JRE";

        List<RechargeCommissionConfig> configs = new ArrayList<>(rechargeCommissionConfigRepository.findByServiceTypeAndOperatorCodeWithPlan(st, op));

        // If configs are missing for any of the 4 membership plans, ensure they exist
        List<CommissionPlan> aepsPlans = commissionPlanRepository.findByServiceTypeOrderByPriceAsc("AEPS_1");
        if (configs.size() < aepsPlans.size()) {
            Set<UUID> presentPlanIds = configs.stream().map(c -> c.getPlan().getId()).collect(Collectors.toSet());
            String opName = resolveOperatorName(op);

            for (CommissionPlan p : aepsPlans) {
                if (!presentPlanIds.contains(p.getId())) {
                    BigDecimal defRet = "FREE".equalsIgnoreCase(p.getPlanCode()) ? new BigDecimal("1.0000")
                            : "PLAN_2999".equalsIgnoreCase(p.getPlanCode()) ? new BigDecimal("1.5000")
                            : "PLAN_4999".equalsIgnoreCase(p.getPlanCode()) ? new BigDecimal("2.0000")
                            : new BigDecimal("2.5000");

                    RechargeCommissionConfig newCfg = RechargeCommissionConfig.builder()
                            .serviceType(st)
                            .operatorCode(op)
                            .operatorName(opName)
                            .commissionMode("PERCENTAGE")
                            .plan(p)
                            .planCode(p.getPlanCode())
                            .retailerValue(defRet)
                            .distributorValue(new BigDecimal("0.2500"))
                            .superDistributorValue(new BigDecimal("0.2500"))
                            .enabled(true)
                            .createdAt(Instant.now())
                            .updatedAt(Instant.now())
                            .build();

                    try {
                        newCfg = rechargeCommissionConfigRepository.save(newCfg);
                        configs.add(newCfg);
                    } catch (Exception ignored) {}
                }
            }
            configs.sort(Comparator.comparing(c -> c.getPlan().getPrice()));
        }

        return configs.stream().map(c -> new CommissionDtos.RechargeCommissionConfigDto(
                c.getId(),
                c.getServiceType(),
                c.getOperatorCode(),
                c.getOperatorName(),
                c.getCommissionMode(),
                c.getPlan().getId(),
                c.getPlanCode(),
                c.getPlan().getPlanName(),
                c.getPlan().getPrice(),
                c.getRetailerValue(),
                c.getDistributorValue(),
                c.getSuperDistributorValue(),
                c.getTotalValue(),
                c.getEnabled(),
                c.getUpdatedAt()
        )).toList();
    }

    @Override
    @Transactional
    public CommissionDtos.RechargeCommissionConfigDto updateRechargeConfig(
            UUID configId,
            CommissionDtos.UpdateRechargeConfigRequest request,
            UUID adminId,
            String ipAddress
    ) {
        enforceAdmin(adminId);
        User admin = userRepository.findById(adminId).orElse(null);

        RechargeCommissionConfig config = rechargeCommissionConfigRepository.findById(configId)
                .orElseThrow(() -> new IllegalArgumentException("Recharge commission configuration not found: " + configId));

        String mode = request.commissionMode() != null ? request.commissionMode().trim().toUpperCase() : "PERCENTAGE";
        if (!"PERCENTAGE".equals(mode) && !"FIXED".equals(mode)) {
            throw new IllegalArgumentException("Invalid commission mode: " + request.commissionMode() + ". Must be PERCENTAGE or FIXED.");
        }

        BigDecimal ret = request.retailerValue() != null ? request.retailerValue() : BigDecimal.ZERO;
        BigDecimal dist = request.distributorValue() != null ? request.distributorValue() : BigDecimal.ZERO;
        BigDecimal sd = request.superDistributorValue() != null ? request.superDistributorValue() : BigDecimal.ZERO;

        if (ret.compareTo(BigDecimal.ZERO) < 0 || dist.compareTo(BigDecimal.ZERO) < 0 || sd.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Commission values cannot be negative.");
        }

        if ("PERCENTAGE".equals(mode)) {
            if (ret.compareTo(new BigDecimal("100")) > 0 || dist.compareTo(new BigDecimal("100")) > 0 || sd.compareTo(new BigDecimal("100")) > 0) {
                throw new IllegalArgumentException("Commission percentage cannot exceed 100%.");
            }
            if (ret.add(dist).add(sd).compareTo(new BigDecimal("100")) > 0) {
                throw new IllegalArgumentException("Total combined commission percentage (" + ret.add(dist).add(sd) + "%) cannot exceed 100%.");
            }
        } else {
            // Fixed mode: upper safety limit of ₹5,000 max fixed commission per recharge
            if (ret.compareTo(new BigDecimal("5000")) > 0 || dist.compareTo(new BigDecimal("5000")) > 0 || sd.compareTo(new BigDecimal("5000")) > 0) {
                throw new IllegalArgumentException("Fixed commission amount exceeds maximum business limit of ₹5,000.");
            }
        }

        // Record immutable audit entry
        RechargeCommissionConfigAudit audit = RechargeCommissionConfigAudit.builder()
                .configId(config.getId())
                .serviceType(config.getServiceType())
                .operatorCode(config.getOperatorCode())
                .planCode(config.getPlanCode())
                .adminUserId(adminId)
                .adminUsername(admin != null ? admin.getUsername() : "admin")
                .prevCommissionMode(config.getCommissionMode())
                .prevRetailerValue(config.getRetailerValue())
                .prevDistributorValue(config.getDistributorValue())
                .prevSuperDistributorValue(config.getSuperDistributorValue())
                .prevEnabled(config.getEnabled())
                .newCommissionMode(mode)
                .newRetailerValue(ret)
                .newDistributorValue(dist)
                .newSuperDistributorValue(sd)
                .newEnabled(request.enabled() != null ? request.enabled() : config.getEnabled())
                .ipAddress(ipAddress)
                .createdAt(Instant.now())
                .build();
        rechargeCommissionConfigAuditRepository.save(audit);

        // Update config
        config.setCommissionMode(mode);
        config.setRetailerValue(ret);
        config.setDistributorValue(dist);
        config.setSuperDistributorValue(sd);
        if (request.enabled() != null) {
            config.setEnabled(request.enabled());
        }
        config.setUpdatedBy(admin);
        config.setUpdatedAt(Instant.now());

        RechargeCommissionConfig saved = rechargeCommissionConfigRepository.save(config);

        return new CommissionDtos.RechargeCommissionConfigDto(
                saved.getId(),
                saved.getServiceType(),
                saved.getOperatorCode(),
                saved.getOperatorName(),
                saved.getCommissionMode(),
                saved.getPlan().getId(),
                saved.getPlanCode(),
                saved.getPlan().getPlanName(),
                saved.getPlan().getPrice(),
                saved.getRetailerValue(),
                saved.getDistributorValue(),
                saved.getSuperDistributorValue(),
                saved.getTotalValue(),
                saved.getEnabled(),
                saved.getUpdatedAt()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<CommissionDtos.RechargeAuditDto> getRechargeAudits(String serviceType, String operatorCode) {
        String st = (serviceType != null && !serviceType.isBlank()) ? serviceType.trim().toUpperCase() : "MOBILE_RECHARGE";
        String op = (operatorCode != null && !operatorCode.isBlank()) ? operatorCode.trim().toUpperCase() : "JRE";
        return rechargeCommissionConfigAuditRepository.findByServiceTypeAndOperatorCodeOrderByCreatedAtDesc(st, op)
                .stream().map(a -> new CommissionDtos.RechargeAuditDto(
                        a.getId(),
                        a.getServiceType(),
                        a.getOperatorCode(),
                        a.getPlanCode(),
                        a.getAdminUsername(),
                        a.getPrevCommissionMode(),
                        a.getPrevRetailerValue(),
                        a.getPrevDistributorValue(),
                        a.getPrevSuperDistributorValue(),
                        a.getPrevEnabled(),
                        a.getNewCommissionMode(),
                        a.getNewRetailerValue(),
                        a.getNewDistributorValue(),
                        a.getNewSuperDistributorValue(),
                        a.getNewEnabled(),
                        a.getIpAddress(),
                        a.getCreatedAt()
                )).toList();
    }

    @Override
    @Transactional
    public int reconcileUncreditedRechargeCommissions() {
        log.info("Running automated reconciliation for uncredited Mobile Recharge commissions...");
        List<Recharge> successRecharges = rechargeRepository.findAll().stream()
                .filter(r -> r.getStatus() == TransactionStatus.SUCCESS)
                .toList();

        int creditedCount = 0;
        for (Recharge r : successRecharges) {
            String ref = r.getMerchantRefNo();
            if (ref != null && !commissionTransactionRepository.existsByOriginalTransactionId(ref)) {
                try {
                    processRechargeCommission(r);
                    if (commissionTransactionRepository.existsByOriginalTransactionId(ref)) {
                        creditedCount++;
                        log.info("Successfully reconciled and credited missing commission for Mobile Recharge txn: {}", ref);
                    }
                } catch (Exception e) {
                    log.error("Failed to reconcile commission for Mobile Recharge txn {}: {}", ref, e.getMessage());
                }
            }
        }
        log.info("Completed Mobile Recharge commission reconciliation. Credited {} uncredited transactions.", creditedCount);
        return creditedCount;
    }

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void onApplicationReady() {
        try {
            reconcileUncreditedBbpsCommissions();
        } catch (Exception e) {
            log.error("Error running startup BBPS commission reconciliation: {}", e.getMessage(), e);
        }
        try {
            reconcileUncreditedRechargeCommissions();
        } catch (Exception e) {
            log.error("Error running startup Recharge commission reconciliation: {}", e.getMessage(), e);
        }
    }
}
