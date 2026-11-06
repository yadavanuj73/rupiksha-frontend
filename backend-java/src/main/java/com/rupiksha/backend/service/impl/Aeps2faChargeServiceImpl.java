package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.CommissionDtos;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.service.Aeps2faChargeService;
import com.rupiksha.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class Aeps2faChargeServiceImpl implements Aeps2faChargeService {

    private final Aeps2faChargeConfigRepository aeps2faChargeConfigRepository;
    private final Aeps2faChargeConfigAuditRepository aeps2faChargeConfigAuditRepository;
    private final Aeps2faChargeTxnRepository aeps2faChargeTxnRepository;
    private final CommissionPlanRepository commissionPlanRepository;
    private final UserRepository userRepository;
    private final WalletService walletService;

    @Override
    @Transactional
    public ChargeExecutionResult process2faCharge(User user, String original2faReference, String providerTxnId, String provider, String ipAddress) {
        if (original2faReference == null || original2faReference.isBlank()) {
            throw new IllegalArgumentException("Original 2FA reference cannot be null or blank");
        }

        // 1. Idempotency Check
        Optional<Aeps2faChargeTxn> existingOpt = aeps2faChargeTxnRepository.findByOriginal2faReference(original2faReference);
        if (existingOpt.isPresent()) {
            Aeps2faChargeTxn existing = existingOpt.get();
            log.info("Idempotency safeguard: 2FA charge already recorded for ref: {}, chargeRef: {}",
                    original2faReference, existing.getChargeReference());
            return new ChargeExecutionResult(
                    true,
                    existing.getChargeReference(),
                    existing.getAmountCharged(),
                    existing.getWalletClosingBalance(),
                    existing.getOutstandingAmount(),
                    existing.getTransactionStatus(),
                    "2FA charge already processed for reference"
            );
        }

        // 2. Resolve User Role
        String role = "RETAILER";
        if (user.getRoles().stream().anyMatch(r -> r.getName() == RoleName.SUPER_DISTRIBUTOR)) {
            role = "SUPER_DISTRIBUTOR";
        } else if (user.getRoles().stream().anyMatch(r -> r.getName() == RoleName.DISTRIBUTOR)) {
            role = "DISTRIBUTOR";
        }

        // 3. Resolve Applicable Membership Plan
        CommissionPlan plan = user.getAepsCommissionPlan();
        if (isPaidPlanExpired(user)) {
            log.info("User {} paid plan expired. Falling back to default Free plan for 2FA charge calculation.", user.getUsername());
            plan = null;
        }
        if (plan == null || !Boolean.TRUE.equals(plan.getEnabled())) {
            plan = commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")
                    .or(() -> commissionPlanRepository.findByServiceTypeAndPlanCode("AEPS_1", "FREE"))
                    .orElse(null);
        }

        if (plan == null) {
            log.warn("No AEPS 1 commission plan found in registry. Skipping 2FA charge for user: {}", user.getUsername());
            return new ChargeExecutionResult(false, null, BigDecimal.ZERO, getWalletBalance(user.getId()), BigDecimal.ZERO, "SKIPPED", "No AEPS 1 plan found");
        }

        final CommissionPlan effectivePlan = plan;

        // 4. Resolve 2FA Charge Configuration
        Aeps2faChargeConfig config = aeps2faChargeConfigRepository.findByPlan_Id(effectivePlan.getId())
                .or(() -> aeps2faChargeConfigRepository.findByPlan_PlanCode(effectivePlan.getPlanCode()))
                .orElse(null);

        if (config == null) {
            log.warn("No 2FA charge configuration found for plan: {}. Skipping for user: {}", plan.getPlanName(), user.getUsername());
            return new ChargeExecutionResult(false, null, BigDecimal.ZERO, getWalletBalance(user.getId()), BigDecimal.ZERO, "SKIPPED", "2FA configuration missing");
        }

        if (!Boolean.TRUE.equals(config.getEnabled())) {
            log.info("2FA charge is disabled for plan: {}. Skipping for user: {}", plan.getPlanName(), user.getUsername());
            return new ChargeExecutionResult(false, null, BigDecimal.ZERO, getWalletBalance(user.getId()), BigDecimal.ZERO, "DISABLED", "2FA charges disabled for plan");
        }

        // 5. Determine Applicable Charge for Role
        BigDecimal charge = switch (role) {
            case "SUPER_DISTRIBUTOR" -> config.getSuperDistributorCharge();
            case "DISTRIBUTOR" -> config.getDistributorCharge();
            default -> config.getRetailerCharge();
        };

        if (charge == null || charge.compareTo(BigDecimal.ZERO) <= 0) {
            log.info("Configured 2FA charge is ₹0.00 for role: {} under plan: {}. No wallet debit needed.", role, plan.getPlanName());
            return new ChargeExecutionResult(false, null, BigDecimal.ZERO, getWalletBalance(user.getId()), BigDecimal.ZERO, "ZERO_CHARGE", "Zero charge configured for role");
        }

        // 6. Debit User Wallet (Allows Negative Balance for 2FA Charge)
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randStr = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        String chargeRef = "CHG-2FA-" + dateStr + "-" + randStr;
        String idempotencyKey = "2FA-IDEM-" + original2faReference + "-" + user.getId();

        WalletDtos.WalletBalanceResponse balResp = walletService.debitFor2faCharge(
                user.getId(),
                charge,
                "Daily 2FA Session: " + original2faReference,
                "AEPS 1 2FA",
                ipAddress != null ? ipAddress : "127.0.0.1",
                idempotencyKey
        );

        BigDecimal closingBal = balResp.balance();
        BigDecimal openingBal = closingBal.add(charge);

        // 7. Calculate Outstanding Amount
        BigDecimal outstanding;
        if (openingBal.compareTo(BigDecimal.ZERO) <= 0) {
            outstanding = charge;
        } else if (closingBal.compareTo(BigDecimal.ZERO) < 0) {
            outstanding = closingBal.abs();
        } else {
            outstanding = BigDecimal.ZERO;
        }
        String settlementStatus = outstanding.compareTo(BigDecimal.ZERO) > 0 ? "UNSETTLED" : "NONE";

        // 8. Record 2FA Charge Transaction
        Aeps2faChargeTxn chargeTxn = Aeps2faChargeTxn.builder()
                .chargeReference(chargeRef)
                .original2faReference(original2faReference)
                .user(user)
                .userRole(role)
                .plan(plan)
                .planCode(plan.getPlanCode())
                .configuredChargeAmount(charge)
                .amountCharged(charge)
                .walletOpeningBalance(openingBal)
                .walletClosingBalance(closingBal)
                .outstandingAmount(outstanding)
                .settlementStatus(settlementStatus)
                .providerTransactionReference(providerTxnId)
                .transactionStatus("SUCCESS")
                .ipAddress(ipAddress != null ? ipAddress : "127.0.0.1")
                .build();

        try {
            aeps2faChargeTxnRepository.saveAndFlush(chargeTxn);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            Optional<Aeps2faChargeTxn> dup = aeps2faChargeTxnRepository.findByOriginal2faReference(original2faReference);
            if (dup.isPresent()) {
                Aeps2faChargeTxn d = dup.get();
                return new ChargeExecutionResult(true, d.getChargeReference(), d.getAmountCharged(), d.getWalletClosingBalance(), d.getOutstandingAmount(), d.getTransactionStatus(), "2FA charge already applied");
            }
            throw ex;
        }

        log.info("Successfully applied 2FA charge of ₹{} for user: {} (role: {}). Wallet: opening=₹{}, closing=₹{}, outstanding=₹{}",
                charge, user.getUsername(), role, openingBal, closingBal, outstanding);

        return new ChargeExecutionResult(true, chargeRef, charge, closingBal, outstanding, "SUCCESS", "2FA charge applied successfully");
    }

    private BigDecimal getWalletBalance(UUID userId) {
        try {
            return walletService.getBalance(userId.toString()).balance();
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }

    private boolean isPaidPlanExpired(User retailer) {
        if (retailer.getAepsCommissionPlanExpiresAt() == null) {
            return false;
        }
        return retailer.getAepsCommissionPlanExpiresAt().isBefore(Instant.now());
    }

    @Override
    @Transactional(readOnly = true)
    public List<CommissionDtos.Aeps2faChargeConfigDto> getAllConfigs() {
        return aeps2faChargeConfigRepository.findAllByOrderByCreatedAtAsc().stream()
                .map(this::mapConfigToDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public CommissionDtos.Aeps2faChargeConfigDto updateConfig(
            UUID configId,
            CommissionDtos.UpdateAeps2faConfigRequest request,
            UUID adminId,
            String ipAddress) {

        Aeps2faChargeConfig config = aeps2faChargeConfigRepository.findById(configId)
                .orElseThrow(() -> new IllegalArgumentException("2FA charge configuration not found: " + configId));

        if (request.retailerCharge().compareTo(BigDecimal.ZERO) < 0
                || request.distributorCharge().compareTo(BigDecimal.ZERO) < 0
                || request.superDistributorCharge().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("2FA charge amounts cannot be negative");
        }

        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin user not found: " + adminId));

        // Audit Log Entry
        Aeps2faChargeConfigAudit audit = Aeps2faChargeConfigAudit.builder()
                .config(config)
                .planId(config.getPlan().getId())
                .planCode(config.getPlanCode())
                .adminUserId(admin.getId())
                .adminUsername(admin.getUsername())
                .prevRetailerCharge(config.getRetailerCharge())
                .prevDistributorCharge(config.getDistributorCharge())
                .prevSuperDistributorCharge(config.getSuperDistributorCharge())
                .prevEnabled(config.getEnabled())
                .newRetailerCharge(request.retailerCharge())
                .newDistributorCharge(request.distributorCharge())
                .newSuperDistributorCharge(request.superDistributorCharge())
                .newEnabled(Boolean.TRUE.equals(request.enabled()))
                .ipAddress(ipAddress != null ? ipAddress : "127.0.0.1")
                .build();
        aeps2faChargeConfigAuditRepository.save(audit);

        // Update Config
        config.setRetailerCharge(request.retailerCharge());
        config.setDistributorCharge(request.distributorCharge());
        config.setSuperDistributorCharge(request.superDistributorCharge());
        if (request.enabled() != null) {
            config.setEnabled(request.enabled());
        }
        config.setUpdatedBy(admin.getUsername());

        Aeps2faChargeConfig saved = aeps2faChargeConfigRepository.save(config);
        log.info("Admin {} updated 2FA charge config for plan {}: Ret=₹{}, Dist=₹{}, SD=₹{}, Enabled={}",
                admin.getUsername(), config.getPlanCode(), request.retailerCharge(), request.distributorCharge(),
                request.superDistributorCharge(), config.getEnabled());

        return mapConfigToDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CommissionDtos.Aeps2faAuditDto> getAudits(UUID planId) {
        List<Aeps2faChargeConfigAudit> audits;
        if (planId != null) {
            audits = aeps2faChargeConfigAuditRepository.findByPlanIdOrderByCreatedAtDesc(planId);
        } else {
            audits = aeps2faChargeConfigAuditRepository.findAllByOrderByCreatedAtDesc(Pageable.ofSize(50)).getContent();
        }
        return audits.stream()
                .map(a -> new CommissionDtos.Aeps2faAuditDto(
                        a.getId(),
                        a.getConfig().getId(),
                        a.getPlanId(),
                        a.getPlanCode(),
                        a.getAdminUsername(),
                        a.getPrevRetailerCharge(),
                        a.getPrevDistributorCharge(),
                        a.getPrevSuperDistributorCharge(),
                        a.getPrevEnabled(),
                        a.getNewRetailerCharge(),
                        a.getNewDistributorCharge(),
                        a.getNewSuperDistributorCharge(),
                        a.getNewEnabled(),
                        a.getIpAddress(),
                        a.getCreatedAt()
                ))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CommissionDtos.Aeps2faChargeConfigDto getRetailerChargeConfig(UUID retailerId) {
        User retailer = userRepository.findById(retailerId)
                .orElseThrow(() -> new IllegalArgumentException("Retailer not found: " + retailerId));

        CommissionPlan plan = retailer.getAepsCommissionPlan();
        if (isPaidPlanExpired(retailer)) {
            plan = null;
        }
        if (plan == null || !Boolean.TRUE.equals(plan.getEnabled())) {
            plan = commissionPlanRepository.findByServiceTypeAndIsDefaultTrue("AEPS_1")
                    .or(() -> commissionPlanRepository.findByServiceTypeAndPlanCode("AEPS_1", "FREE"))
                    .orElse(null);
        }
        if (plan == null) {
            return null;
        }
        final CommissionPlan effectivePlan = plan;
        Aeps2faChargeConfig config = aeps2faChargeConfigRepository.findByPlan_Id(effectivePlan.getId())
                .or(() -> aeps2faChargeConfigRepository.findByPlan_PlanCode(effectivePlan.getPlanCode()))
                .orElse(null);
        return config != null ? mapConfigToDto(config) : null;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CommissionDtos.Aeps2faChargeTxnDto> getUserChargeHistory(UUID userId, Pageable pageable) {
        return aeps2faChargeTxnRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::mapTxnToDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CommissionDtos.Aeps2faChargeTxnDto> getAllCharges(Pageable pageable) {
        return aeps2faChargeTxnRepository.findAll(pageable)
                .map(this::mapTxnToDto);
    }

    private CommissionDtos.Aeps2faChargeConfigDto mapConfigToDto(Aeps2faChargeConfig c) {
        return new CommissionDtos.Aeps2faChargeConfigDto(
                c.getId(),
                c.getServiceType(),
                c.getPlan().getId(),
                c.getPlanCode(),
                c.getPlan().getPlanName(),
                c.getPlan().getPrice(),
                c.getRetailerCharge(),
                c.getDistributorCharge(),
                c.getSuperDistributorCharge(),
                c.getEnabled(),
                c.getCreatedBy(),
                c.getUpdatedBy(),
                c.getUpdatedAt()
        );
    }

    private CommissionDtos.Aeps2faChargeTxnDto mapTxnToDto(Aeps2faChargeTxn t) {
        return new CommissionDtos.Aeps2faChargeTxnDto(
                t.getId(),
                t.getChargeReference(),
                t.getOriginal2faReference(),
                t.getUser().getId(),
                t.getUser().getUsername(),
                t.getUserRole(),
                t.getPlanCode(),
                t.getConfiguredChargeAmount(),
                t.getAmountCharged(),
                t.getWalletOpeningBalance(),
                t.getWalletClosingBalance(),
                t.getOutstandingAmount(),
                t.getSettlementStatus(),
                t.getProviderTransactionReference(),
                t.getTransactionStatus(),
                t.getCreatedAt()
        );
    }
}

