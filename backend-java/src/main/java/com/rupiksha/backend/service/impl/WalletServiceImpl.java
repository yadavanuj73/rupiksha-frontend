package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.service.ProofStorageService;
import com.rupiksha.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.TransactionDefinition;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WalletServiceImpl implements WalletService {

    private final WalletRepository walletRepository;
    private final WalletEntryRepository walletEntryRepository;
    private final UserRepository userRepository;
    private final FundRequestRepository fundRequestRepository;
    private final AuditLogRepository auditLogRepository;
    private final AdminBankAccountRepository adminBankAccountRepository;
    private final FundRequestAuditLogRepository fundRequestAuditLogRepository;
    private final com.rupiksha.backend.service.ProofStorageService proofStorageService;
    private final AppProperties appProperties;
    private final PlatformTransactionManager transactionManager;
    private final com.rupiksha.backend.service.AdminWalletActionPinService adminWalletActionPinService;
    @org.springframework.context.annotation.Lazy
    private final com.rupiksha.backend.service.Aeps2faSettlementService aeps2faSettlementService;

    // Helper to generate reference number (WLT-YYYYMMDD-XXXXXX)
    private String generateReferenceNumber() {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randStr = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        return "WLT-" + dateStr + "-" + randStr;
    }

    private void enforceAdmin(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        boolean isAdmin = user.getRoles().stream()
                .anyMatch(r -> r.getName().name().equalsIgnoreCase("ADMIN"));
        if (!isAdmin) {
            throw new AccessDeniedException("Access denied: only administrators can perform manual wallet mutations");
        }
    }

    // Helper to check user hierarchy (recursive upline lookup)
    private void checkHierarchy(User operator, User target) {
        boolean isAdmin = operator.getRoles().stream()
                .anyMatch(r -> r.getName().name().equalsIgnoreCase("ADMIN"));
        if (isAdmin) {
            return;
        }

        String parentIdStr = operator.getId().toString();
        String childParentRef = target.getAddedByUserRef();

        while (childParentRef != null && !childParentRef.isBlank()) {
            if (childParentRef.equalsIgnoreCase(parentIdStr)) {
                return;
            }
            try {
                UUID parentUuid = UUID.fromString(childParentRef);
                User nextParent = userRepository.findById(parentUuid).orElse(null);
                if (nextParent == null) {
                    break;
                }
                childParentRef = nextParent.getAddedByUserRef();
            } catch (Exception e) {
                break;
            }
        }
        throw new SecurityException("Access Denied: Target user " + target.getUsername() + " is not in your hierarchy tree");
    }

    private void checkHierarchyOrSelf(User operator, User target) {
        if (operator.getId().equals(target.getId())) {
            return;
        }
        checkHierarchy(operator, target);
    }

    // Lock wallets in a fixed sorted order of user UUIDs to prevent database deadlocks
    private List<Wallet> lockWallets(UUID idA, UUID idB) {
        if (idA.equals(idB)) {
            Wallet w = getOrCreateWalletWithLock(idA);
            return List.of(w);
        }
        UUID firstId = idA.compareTo(idB) < 0 ? idA : idB;
        UUID secondId = idA.compareTo(idB) < 0 ? idB : idA;

        Wallet w1 = getOrCreateWalletWithLock(firstId);
        Wallet w2 = getOrCreateWalletWithLock(secondId);

        if (firstId.equals(idA)) {
            return List.of(w1, w2);
        } else {
            return List.of(w2, w1);
        }
    }

    // Gate validations for wallet status
    private void validateWalletStatus(Wallet wallet, String entryType) {
        WalletStatus status = wallet.getStatus();
        if (status == WalletStatus.BLOCKED || status == WalletStatus.FROZEN) {
            throw new IllegalStateException("Your wallet is frozen. Please contact admin.");
        }
        if (status == WalletStatus.SUSPENDED) {
            if (!"CREDIT".equalsIgnoreCase(entryType) && !"TAX".equalsIgnoreCase(entryType)) {
                throw new IllegalStateException("Transaction blocked: Wallet is SUSPENDED (only credits allowed)");
            }
        }
    }

    // Validates Transaction state machine transitions
    private void validateStateTransition(WalletTransactionStatus current, WalletTransactionStatus next) {
        if (current == next) {
            return;
        }
        boolean valid = false;
        switch (current) {
            case INITIATED:
                valid = (next == WalletTransactionStatus.PROCESSING || next == WalletTransactionStatus.PENDING || next == WalletTransactionStatus.CANCELLED);
                break;
            case PROCESSING:
                valid = (next == WalletTransactionStatus.SUCCESS || next == WalletTransactionStatus.FAILED);
                break;
            case PENDING:
                valid = (next == WalletTransactionStatus.SUCCESS || next == WalletTransactionStatus.FAILED || next == WalletTransactionStatus.CANCELLED);
                break;
            case FAILED:
                valid = (next == WalletTransactionStatus.REFUNDED);
                break;
            case SUCCESS:
                valid = (next == WalletTransactionStatus.REVERSED);
                break;
            default:
                break;
        }
        if (!valid) {
            throw new IllegalStateException("Invalid transaction state transition from " + current + " to " + next);
        }
    }

    private Wallet getOrCreateWallet(UUID userId) {
        Optional<Wallet> opt = walletRepository.findByUserId(userId);
        if (opt.isPresent()) {
            return opt.get();
        }

        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        try {
            return template.execute(status -> {
                return walletRepository.findByUserId(userId).orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
                    Wallet wallet = new Wallet();
                    wallet.setUser(user);
                    wallet.setBalance(BigDecimal.ZERO);
                    wallet.setLockedBalance(BigDecimal.ZERO);
                    wallet.setStatus(WalletStatus.ACTIVE);
                    return walletRepository.saveAndFlush(wallet);
                });
            });
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            return walletRepository.findByUserId(userId)
                    .orElseThrow(() -> new IllegalStateException("Failed to find wallet after concurrent creation", e));
        }
    }

    private Wallet getOrCreateWalletWithLock(UUID userId) {
        Optional<Wallet> walletOpt = walletRepository.findByUserIdWithLock(userId);
        if (walletOpt.isPresent()) {
            return walletOpt.get();
        }
        try {
            getOrCreateWallet(userId);
        } catch (Exception e) {
            // Ignore to allow retry finding
        }
        return walletRepository.findByUserIdWithLock(userId)
                .orElseThrow(() -> new IllegalStateException("Failed to lock newly created wallet"));
    }

    private BigDecimal getGstRateForUser(User u) {
        // Return 0 or configurable rate if applicable
        return BigDecimal.ZERO;
    }

    private String resolvePartyCode(User u) {
        if (u == null) return "";
        if (u.getPartyCode() != null && !u.getPartyCode().isBlank()) {
            return u.getPartyCode();
        }
        RoleName role = u.getRoles().isEmpty() ? RoleName.RETAILER : u.getRoles().iterator().next().getName();
        String rolePrefix = switch (role) {
            case SUPER_DISTRIBUTOR -> "RPSD";
            case DISTRIBUTOR -> "RPD";
            case ADMIN -> "RPADM";
            default -> "RPR";
        };
        String state = u.getStateName();
        String plate = "BR";
        if (state != null && !state.isBlank()) {
            String upper = state.trim().toUpperCase();
            if (upper.length() == 2 && upper.matches("[A-Z]{2}")) plate = upper;
            else if (upper.contains("MAHA") || upper.contains("MH")) plate = "MH";
            else if (upper.contains("UP") || upper.contains("UTTAR")) plate = "UP";
            else if (upper.contains("DL") || upper.contains("DELHI")) plate = "DL";
        }
        int codeNum = Math.abs(u.getId().hashCode() % 90000) + 10000;
        String generated = rolePrefix + plate + codeNum;
        try {
            u.setPartyCode(generated);
            userRepository.save(u);
        } catch (Exception ignored) {}
        return generated;
    }

    private User resolveUser(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("User identifier is required");
        }
        String clean = identifier.trim();
        try {
            UUID id = UUID.fromString(clean);
            Optional<User> byId = userRepository.findById(id);
            if (byId.isPresent()) return byId.get();
        } catch (IllegalArgumentException ignored) {
            // Not a UUID, fallback to lookup by partyCode, username, or mobile
        }
        return userRepository.findByPartyCode(clean)
                .or(() -> userRepository.findByUsername(clean))
                .or(() -> userRepository.findAllByMobile(clean).stream().findFirst())
                .orElseThrow(() -> new IllegalArgumentException("Target user not found for identifier: " + identifier));
    }

    private WalletDtos.WalletBalanceResponse mapBalanceResponse(Wallet w) {
        User u = w.getUser();
        String roleStr = u.getRoles().isEmpty() ? "RETAILER" : u.getRoles().iterator().next().getName().name();
        String partyCode = resolvePartyCode(u);
        return new WalletDtos.WalletBalanceResponse(
                u.getId().toString(),
                u.getFullName(),
                u.getUsername(),
                u.getMobile(),
                roleStr,
                w.getBalance(),
                w.getLockedBalance(),
                w.getBalance().subtract(w.getLockedBalance()),
                getGstRateForUser(u),
                w.getStatus().name(),
                partyCode
        );
    }

    @Override
    @Transactional(readOnly = true)
    public WalletDtos.WalletBalanceResponse getBalance(String userId) {
        User user = resolveUser(userId);
        Wallet wallet = getOrCreateWallet(user.getId());
        return mapBalanceResponse(wallet);
    }

    @Override
    @Transactional
    public List<WalletDtos.WalletBalanceResponse> getWalletsList(UUID currentUserId) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName().name().equalsIgnoreCase("ADMIN"));
        if (!isAdmin) {
            throw new AccessDeniedException("Access denied: non-admin users cannot access the Admin Wallet Manager dataset");
        }

        List<User> users = userRepository.findAll();

        return users.stream()
                .map(u -> getOrCreateWallet(u.getId()))
                .map(this::mapBalanceResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse credit(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey) {
        return credit(request, operatorId, ipAddress, idempotencyKey, request.pin());
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse credit(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey, String pin) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new IllegalArgumentException("Idempotency key is required");
        }

        // Idempotency check
        Optional<WalletEntry> existing = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            return mapBalanceResponse(existing.get().getWallet());
        }

        enforceAdmin(operatorId);

        User operator = userRepository.findById(operatorId)
                .orElseThrow(() -> new IllegalArgumentException("Operator not found"));
        User targetUser = resolveUser(request.userId());
        User target = targetUser;

        BigDecimal amount = request.amount();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }

        // 1. Mandatory Centralized PIN verification before any balance modification
        adminWalletActionPinService.verifyActionPin(
                operator.getId(),
                operator.getUsername(),
                AdminWalletOperationType.CREDIT_FUND,
                target.getId(),
                target.getUsername(),
                amount,
                null,
                pin,
                ipAddress,
                null,
                idempotencyKey
        );

        Wallet tgtWallet = getOrCreateWalletWithLock(target.getId());
        validateWalletStatus(tgtWallet, "CREDIT");

        String refNum = generateReferenceNumber();
        try {
            if (aeps2faSettlementService != null) {
                aeps2faSettlementService.settleOutstandingCharges(targetUser.getId(), amount, refNum);
            }

            BigDecimal oldTgtBal = tgtWallet.getBalance();
            BigDecimal newTgtBal = oldTgtBal.add(amount);
            tgtWallet.setBalance(newTgtBal);
            walletRepository.save(tgtWallet);
            try { walletRepository.flush(); } catch (Exception ignored) {}

            WalletEntry tgtEntry = new WalletEntry();
            tgtEntry.setWallet(tgtWallet);
            tgtEntry.setAmount(amount);
            tgtEntry.setEntryType("CREDIT");
            tgtEntry.setReferenceId(refNum);
            tgtEntry.setNarration(sanitizeNarration("Credit from " + operator.getUsername() + ": " + request.getNarrationOrRemark()));
            tgtEntry.setOpeningBalance(oldTgtBal);
            tgtEntry.setClosingBalance(newTgtBal);
            tgtEntry.setOperator(operator);
            tgtEntry.setIpAddress(ipAddress);
            tgtEntry.setIdempotencyKey(idempotencyKey);
            tgtEntry.setTransactionContext(WalletTransactionContext.ADMIN_CREDIT);
            tgtEntry.setStatus(WalletTransactionStatus.SUCCESS);

            try {
                walletEntryRepository.saveAndFlush(tgtEntry);
            } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                Optional<WalletEntry> dup = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
                if (dup.isPresent()) {
                    return mapBalanceResponse(dup.get().getWallet());
                }
                throw ex;
            }

            AuditLog auditTgt = AuditLog.builder()
                    .operator(operator)
                    .targetUser(target)
                    .oldBalance(oldTgtBal)
                    .newBalance(newTgtBal)
                    .amount(amount)
                    .walletType("MAIN")
                    .ledgerType("CREDIT")
                    .referenceNumber(refNum)
                    .ipAddress(ipAddress)
                    .remark(sanitizeRemark("Credited target user from operator " + operator.getUsername()))
                    .build();
            auditLogRepository.save(auditTgt);

            adminWalletActionPinService.recordOperationSuccess(
                    operator.getId(),
                    operator.getUsername(),
                    AdminWalletOperationType.CREDIT_FUND,
                    target.getId(),
                    target.getUsername(),
                    amount,
                    null,
                    refNum,
                    ipAddress,
                    idempotencyKey,
                    "Credit committed"
            );

            return mapBalanceResponse(tgtWallet);
        } catch (Exception ex) {
            adminWalletActionPinService.recordOperationFailure(
                    operator.getId(),
                    operator.getUsername(),
                    AdminWalletOperationType.CREDIT_FUND,
                    target.getId(),
                    target.getUsername(),
                    amount,
                    null,
                    ex.getMessage(),
                    ipAddress,
                    idempotencyKey
            );
            throw ex;
        }
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse debit(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey) {
        return debit(request, operatorId, ipAddress, idempotencyKey, request.pin());
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse debit(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey, String pin) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new IllegalArgumentException("Idempotency key is required");
        }

        Optional<WalletEntry> existing = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            return mapBalanceResponse(existing.get().getWallet());
        }

        enforceAdmin(operatorId);

        User operator = userRepository.findById(operatorId)
                .orElseThrow(() -> new IllegalArgumentException("Operator not found"));
        User targetUser = resolveUser(request.userId());
        User target = targetUser;

        BigDecimal amount = request.amount();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }

        // 1. Mandatory Centralized PIN verification before any balance modification
        adminWalletActionPinService.verifyActionPin(
                operator.getId(),
                operator.getUsername(),
                AdminWalletOperationType.DEBIT_FUND,
                target.getId(),
                target.getUsername(),
                amount,
                null,
                pin,
                ipAddress,
                null,
                idempotencyKey
        );

        Wallet tgtWallet = getOrCreateWalletWithLock(target.getId());
        validateWalletStatus(tgtWallet, "DEBIT");

        BigDecimal availableBalance = tgtWallet.getBalance().subtract(tgtWallet.getLockedBalance());
        if (amount.compareTo(availableBalance) > 0) {
            adminWalletActionPinService.recordOperationFailure(
                    operator.getId(),
                    operator.getUsername(),
                    AdminWalletOperationType.DEBIT_FUND,
                    target.getId(),
                    target.getUsername(),
                    amount,
                    null,
                    "Insufficient wallet balance of target user",
                    ipAddress,
                    idempotencyKey
            );
            throw new IllegalArgumentException("Insufficient wallet balance of target user");
        }

        String refNum = generateReferenceNumber();
        try {
            BigDecimal oldTgtBal = tgtWallet.getBalance();
            BigDecimal newTgtBal = oldTgtBal.subtract(amount);
            tgtWallet.setBalance(newTgtBal);
            walletRepository.save(tgtWallet);
            try { walletRepository.flush(); } catch (Exception ignored) {}

            WalletEntry tgtEntry = new WalletEntry();
            tgtEntry.setWallet(tgtWallet);
            tgtEntry.setAmount(amount);
            tgtEntry.setEntryType("DEBIT");
            tgtEntry.setReferenceId(refNum);
            tgtEntry.setNarration(sanitizeNarration("Debit by operator " + operator.getUsername() + ": " + request.getNarrationOrRemark()));
            tgtEntry.setOpeningBalance(oldTgtBal);
            tgtEntry.setClosingBalance(newTgtBal);
            tgtEntry.setOperator(operator);
            tgtEntry.setIpAddress(ipAddress);
            tgtEntry.setIdempotencyKey(idempotencyKey);
            tgtEntry.setTransactionContext(WalletTransactionContext.ADMIN_DEBIT);
            tgtEntry.setStatus(WalletTransactionStatus.SUCCESS);

            try {
                walletEntryRepository.saveAndFlush(tgtEntry);
            } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                Optional<WalletEntry> dup = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
                if (dup.isPresent()) {
                    return mapBalanceResponse(dup.get().getWallet());
                }
                throw ex;
            }

            AuditLog auditTgt = AuditLog.builder()
                    .operator(operator)
                    .targetUser(target)
                    .oldBalance(oldTgtBal)
                    .newBalance(newTgtBal)
                    .amount(amount)
                    .walletType("MAIN")
                    .ledgerType("DEBIT")
                    .referenceNumber(refNum)
                    .ipAddress(ipAddress)
                    .remark(sanitizeRemark("Debited target user by operator " + operator.getUsername()))
                    .build();
            auditLogRepository.save(auditTgt);

            adminWalletActionPinService.recordOperationSuccess(
                    operator.getId(),
                    operator.getUsername(),
                    AdminWalletOperationType.DEBIT_FUND,
                    target.getId(),
                    target.getUsername(),
                    amount,
                    null,
                    refNum,
                    ipAddress,
                    idempotencyKey,
                    "Debit committed"
            );

            return mapBalanceResponse(tgtWallet);
        } catch (Exception ex) {
            adminWalletActionPinService.recordOperationFailure(
                    operator.getId(),
                    operator.getUsername(),
                    AdminWalletOperationType.DEBIT_FUND,
                    target.getId(),
                    target.getUsername(),
                    amount,
                    null,
                    ex.getMessage(),
                    ipAddress,
                    idempotencyKey
            );
            throw ex;
        }
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse lock(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey) {
        return lock(request, operatorId, ipAddress, idempotencyKey, request.pin());
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse lock(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey, String pin) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new IllegalArgumentException("Idempotency key is required");
        }

        Optional<WalletEntry> existing = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            return mapBalanceResponse(existing.get().getWallet());
        }

        enforceAdmin(operatorId);

        User operator = userRepository.findById(operatorId)
                .orElseThrow(() -> new IllegalArgumentException("Operator not found"));
        User targetUser = resolveUser(request.userId());
        User target = targetUser;

        BigDecimal amount = request.amount();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }

        // 1. Mandatory Centralized PIN verification before locking funds
        adminWalletActionPinService.verifyActionPin(
                operator.getId(),
                operator.getUsername(),
                AdminWalletOperationType.LOCK_AMOUNT,
                target.getId(),
                target.getUsername(),
                amount,
                null,
                pin,
                ipAddress,
                null,
                idempotencyKey
        );

        Wallet wallet = getOrCreateWalletWithLock(target.getId());
        validateWalletStatus(wallet, "DEBIT");

        BigDecimal available = wallet.getBalance().subtract(wallet.getLockedBalance());
        if (available.compareTo(amount) < 0) {
            adminWalletActionPinService.recordOperationFailure(
                    operator.getId(),
                    operator.getUsername(),
                    AdminWalletOperationType.LOCK_AMOUNT,
                    target.getId(),
                    target.getUsername(),
                    amount,
                    null,
                    "Insufficient available wallet balance to lock",
                    ipAddress,
                    idempotencyKey
            );
            throw new IllegalArgumentException("Insufficient available wallet balance to lock");
        }

        String refNum = generateReferenceNumber();
        try {
            wallet.setLockedBalance(wallet.getLockedBalance().add(amount));
            walletRepository.save(wallet);
            try { walletRepository.flush(); } catch (Exception ignored) {}

            WalletEntry entry = new WalletEntry();
            entry.setWallet(wallet);
            entry.setAmount(amount);
            entry.setEntryType("LOCK");
            entry.setReferenceId(refNum);
            entry.setNarration(sanitizeNarration("Balance locked: " + request.getNarrationOrRemark()));
            entry.setOpeningBalance(wallet.getBalance());
            entry.setClosingBalance(wallet.getBalance());
            entry.setOperator(operator);
            entry.setIpAddress(ipAddress);
            entry.setIdempotencyKey(idempotencyKey);
            entry.setTransactionContext(WalletTransactionContext.LOCK_BALANCE);
            entry.setStatus(WalletTransactionStatus.SUCCESS);

            try {
                walletEntryRepository.saveAndFlush(entry);
            } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                Optional<WalletEntry> dup = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
                if (dup.isPresent()) {
                    return mapBalanceResponse(dup.get().getWallet());
                }
                throw ex;
            }

            AuditLog audit = AuditLog.builder()
                    .operator(operator)
                    .targetUser(target)
                    .oldBalance(wallet.getBalance())
                    .newBalance(wallet.getBalance())
                    .amount(amount)
                    .walletType("MAIN")
                    .ledgerType("LOCK")
                    .referenceNumber(refNum)
                    .ipAddress(ipAddress)
                    .remark(sanitizeRemark("Locked balance amount: " + amount))
                    .build();
            auditLogRepository.save(audit);

            adminWalletActionPinService.recordOperationSuccess(
                    operator.getId(),
                    operator.getUsername(),
                    AdminWalletOperationType.LOCK_AMOUNT,
                    target.getId(),
                    target.getUsername(),
                    amount,
                    null,
                    refNum,
                    ipAddress,
                    idempotencyKey,
                    "Lock committed"
            );

            return mapBalanceResponse(wallet);
        } catch (Exception ex) {
            adminWalletActionPinService.recordOperationFailure(
                    operator.getId(),
                    operator.getUsername(),
                    AdminWalletOperationType.LOCK_AMOUNT,
                    target.getId(),
                    target.getUsername(),
                    amount,
                    null,
                    ex.getMessage(),
                    ipAddress,
                    idempotencyKey
            );
            throw ex;
        }
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse release(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey) {
        return release(request, operatorId, ipAddress, idempotencyKey, request.pin());
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse release(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey, String pin) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new IllegalArgumentException("Idempotency key is required");
        }

        Optional<WalletEntry> existing = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            return mapBalanceResponse(existing.get().getWallet());
        }

        enforceAdmin(operatorId);

        User operator = userRepository.findById(operatorId)
                .orElseThrow(() -> new IllegalArgumentException("Operator not found"));
        User targetUser = resolveUser(request.userId());
        User target = targetUser;

        BigDecimal amount = request.amount();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }

        // 1. Mandatory Centralized PIN verification before releasing locked funds
        adminWalletActionPinService.verifyActionPin(
                operator.getId(),
                operator.getUsername(),
                AdminWalletOperationType.RELEASE_LOCK_AMOUNT,
                target.getId(),
                target.getUsername(),
                amount,
                null,
                pin,
                ipAddress,
                null,
                idempotencyKey
        );

        Wallet wallet = getOrCreateWalletWithLock(target.getId());
        validateWalletStatus(wallet, "CREDIT");

        if (wallet.getLockedBalance().compareTo(amount) < 0) {
            adminWalletActionPinService.recordOperationFailure(
                    operator.getId(),
                    operator.getUsername(),
                    AdminWalletOperationType.RELEASE_LOCK_AMOUNT,
                    target.getId(),
                    target.getUsername(),
                    amount,
                    null,
                    "Release amount exceeds current locked balance",
                    ipAddress,
                    idempotencyKey
            );
            throw new IllegalArgumentException("Release amount exceeds current locked balance");
        }

        String refNum = generateReferenceNumber();
        try {
            wallet.setLockedBalance(wallet.getLockedBalance().subtract(amount));
            walletRepository.save(wallet);
            try { walletRepository.flush(); } catch (Exception ignored) {}

            WalletEntry entry = new WalletEntry();
            entry.setWallet(wallet);
            entry.setAmount(amount);
            entry.setEntryType("UNLOCK");
            entry.setReferenceId(refNum);
            entry.setNarration(sanitizeNarration("Balance released: " + request.getNarrationOrRemark()));
            entry.setOpeningBalance(wallet.getBalance());
            entry.setClosingBalance(wallet.getBalance());
            entry.setOperator(operator);
            entry.setIpAddress(ipAddress);
            entry.setIdempotencyKey(idempotencyKey);
            entry.setTransactionContext(WalletTransactionContext.RELEASE_LOCK);
            entry.setStatus(WalletTransactionStatus.SUCCESS);

            try {
                walletEntryRepository.saveAndFlush(entry);
            } catch (org.springframework.dao.DataIntegrityViolationException ex) {
                Optional<WalletEntry> dup = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
                if (dup.isPresent()) {
                    return mapBalanceResponse(dup.get().getWallet());
                }
                throw ex;
            }

            AuditLog audit = AuditLog.builder()
                    .operator(operator)
                    .targetUser(target)
                    .oldBalance(wallet.getBalance())
                    .newBalance(wallet.getBalance())
                    .amount(amount)
                    .walletType("MAIN")
                    .ledgerType("UNLOCK")
                    .referenceNumber(refNum)
                    .ipAddress(ipAddress)
                    .remark(sanitizeRemark("Released locked balance amount: " + amount))
                    .build();
            auditLogRepository.save(audit);

            adminWalletActionPinService.recordOperationSuccess(
                    operator.getId(),
                    operator.getUsername(),
                    AdminWalletOperationType.RELEASE_LOCK_AMOUNT,
                    target.getId(),
                    target.getUsername(),
                    amount,
                    null,
                    refNum,
                    ipAddress,
                    idempotencyKey,
                    "Release committed"
            );

            return mapBalanceResponse(wallet);
        } catch (Exception ex) {
            adminWalletActionPinService.recordOperationFailure(
                    operator.getId(),
                    operator.getUsername(),
                    AdminWalletOperationType.RELEASE_LOCK_AMOUNT,
                    target.getId(),
                    target.getUsername(),
                    amount,
                    null,
                    ex.getMessage(),
                    ipAddress,
                    idempotencyKey
            );
            throw ex;
        }
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse giveCommission(WalletDtos.CommissionRequest request, UUID operatorId, String ipAddress, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new IllegalArgumentException("Idempotency key is required");
        }

        Optional<WalletEntry> existing = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            return mapBalanceResponse(existing.get().getWallet());
        }

        enforceAdmin(operatorId);

        User operator = userRepository.findById(operatorId)
                .orElseThrow(() -> new IllegalArgumentException("Operator not found"));
        User targetUser = resolveUser(request.userId());
        User target = targetUser;

        Wallet tgtWallet = getOrCreateWalletWithLock(target.getId());
        validateWalletStatus(tgtWallet, "CREDIT");

        BigDecimal grossAmount = request.amount();
        if (grossAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }

        // Centralized configuration from AppProperties
        BigDecimal tdsPct = BigDecimal.valueOf(2.0); // Default 2%
        BigDecimal gstPct = BigDecimal.ZERO; // Default 0%
        if (appProperties != null && appProperties.wallet() != null) {
            if (appProperties.wallet().tdsPercentage() != null) {
                tdsPct = appProperties.wallet().tdsPercentage();
            }
            if (appProperties.wallet().gstPercentage() != null) {
                gstPct = appProperties.wallet().gstPercentage();
            }
        }

        if (tdsPct.compareTo(BigDecimal.ZERO) < 0 || gstPct.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Tax percentages must be valid non-negative values");
        }

        BigDecimal tdsAmount = grossAmount.multiply(tdsPct).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        BigDecimal gstAmount = grossAmount.multiply(gstPct).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
        BigDecimal netCredited = grossAmount.subtract(tdsAmount).subtract(gstAmount);

        if (netCredited.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("TDS and GST percentages exceed the gross commission amount");
        }

        BigDecimal oldTgtBal = tgtWallet.getBalance();
        BigDecimal newTgtBal = oldTgtBal.add(netCredited);
        tgtWallet.setBalance(newTgtBal);
        walletRepository.save(tgtWallet);
        try { walletRepository.flush(); } catch (Exception ignored) {}

        String refNum = generateReferenceNumber();

        WalletEntry tgtEntry = new WalletEntry();
        tgtEntry.setWallet(tgtWallet);
        tgtEntry.setAmount(netCredited);
        tgtEntry.setEntryType("CREDIT");
        tgtEntry.setReferenceId(refNum);
        tgtEntry.setNarration(sanitizeNarration("Commission credited: " + request.getNarrationOrRemark()));
        tgtEntry.setOpeningBalance(oldTgtBal);
        tgtEntry.setClosingBalance(newTgtBal);
        tgtEntry.setOperator(operator);
        tgtEntry.setIpAddress(ipAddress);
        tgtEntry.setIdempotencyKey(idempotencyKey);
        tgtEntry.setGst(gstAmount);
        tgtEntry.setTds(tdsAmount);
        tgtEntry.setTransactionContext(WalletTransactionContext.COMMISSION);
        tgtEntry.setStatus(WalletTransactionStatus.SUCCESS);

        try {
            walletEntryRepository.saveAndFlush(tgtEntry);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            Optional<WalletEntry> dup = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
            if (dup.isPresent()) {
                return mapBalanceResponse(dup.get().getWallet());
            }
            throw ex;
        }

        AuditLog auditTgt = AuditLog.builder()
                .operator(operator)
                .targetUser(target)
                .oldBalance(oldTgtBal)
                .newBalance(newTgtBal)
                .amount(netCredited)
                .walletType("MAIN")
                .ledgerType("CREDIT")
                .referenceNumber(refNum)
                .ipAddress(ipAddress)
                .remark(sanitizeRemark("Credited commission net: " + netCredited + " (TDS: " + tdsAmount + ", GST: " + gstAmount + ")"))
                .build();
        auditLogRepository.save(auditTgt);

        return mapBalanceResponse(tgtWallet);
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse cmsRefund(WalletDtos.WalletEntryRequest request, UUID operatorId, String ipAddress, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new IllegalArgumentException("Idempotency key is required");
        }

        Optional<WalletEntry> existing = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) {
            return mapBalanceResponse(existing.get().getWallet());
        }

        enforceAdmin(operatorId);

        User operator = userRepository.findById(operatorId)
                .orElseThrow(() -> new IllegalArgumentException("Operator not found"));
        User targetUser = resolveUser(request.userId());
        User target = targetUser;

        Wallet tgtWallet = getOrCreateWalletWithLock(target.getId());
        validateWalletStatus(tgtWallet, "CREDIT");

        BigDecimal amount = request.amount();
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }

        String refNum = generateReferenceNumber();
        if (aeps2faSettlementService != null) {
            aeps2faSettlementService.settleOutstandingCharges(targetUser.getId(), amount, refNum);
        }

        BigDecimal oldTgtBal = tgtWallet.getBalance();
        BigDecimal newTgtBal = oldTgtBal.add(amount);
        tgtWallet.setBalance(newTgtBal);
        walletRepository.save(tgtWallet);
        try { walletRepository.flush(); } catch (Exception ignored) {}

        WalletEntry tgtEntry = new WalletEntry();
        tgtEntry.setWallet(tgtWallet);
        tgtEntry.setAmount(amount);
        tgtEntry.setEntryType("CREDIT");
        tgtEntry.setReferenceId(refNum);
        tgtEntry.setNarration(sanitizeNarration("CMS Refund by " + operator.getUsername() + ": " + request.getNarrationOrRemark()));
        tgtEntry.setOpeningBalance(oldTgtBal);
        tgtEntry.setClosingBalance(newTgtBal);
        tgtEntry.setOperator(operator);
        tgtEntry.setIpAddress(ipAddress);
        tgtEntry.setIdempotencyKey(idempotencyKey);
        tgtEntry.setTransactionContext(WalletTransactionContext.CMS_REFUND);
        tgtEntry.setStatus(WalletTransactionStatus.SUCCESS);

        try {
            walletEntryRepository.saveAndFlush(tgtEntry);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            Optional<WalletEntry> dup = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
            if (dup.isPresent()) {
                return mapBalanceResponse(dup.get().getWallet());
            }
            throw ex;
        }

        AuditLog auditTgt = AuditLog.builder()
                .operator(operator)
                .targetUser(target)
                .oldBalance(oldTgtBal)
                .newBalance(newTgtBal)
                .amount(amount)
                .walletType("MAIN")
                .ledgerType("CMS_REFUND")
                .referenceNumber(refNum)
                .ipAddress(ipAddress)
                .remark(sanitizeRemark("CMS Refund processed for user " + target.getUsername() + " by " + operator.getUsername()))
                .build();
        auditLogRepository.save(auditTgt);

        return mapBalanceResponse(tgtWallet);
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse updateWalletStatus(WalletDtos.WalletStatusUpdateRequest request, UUID adminId, String ipAddress) {
        return updateWalletStatus(request, adminId, ipAddress, request.pin());
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse updateWalletStatus(WalletDtos.WalletStatusUpdateRequest request, UUID adminId, String ipAddress, String pin) {
        enforceAdmin(adminId);

        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin not found"));

        User target = resolveUser(request.userId());

        String rawStatus = request.status() != null ? request.status().trim().toUpperCase() : "ACTIVE";
        WalletStatus newStatus;
        if ("FREEZE".equals(rawStatus) || "FROZEN".equals(rawStatus)) {
            newStatus = WalletStatus.FROZEN;
        } else if ("UNFREEZE".equals(rawStatus)) {
            newStatus = WalletStatus.ACTIVE;
        } else {
            try {
                newStatus = WalletStatus.valueOf(rawStatus);
            } catch (IllegalArgumentException e) {
                newStatus = WalletStatus.ACTIVE;
            }
        }

        AdminWalletOperationType opType = (newStatus == WalletStatus.FROZEN) ?
                AdminWalletOperationType.FREEZE_WALLET : AdminWalletOperationType.UNFREEZE_WALLET;

        // 1. Mandatory Centralized PIN verification before freeze/unfreeze
        adminWalletActionPinService.verifyActionPin(
                admin.getId(),
                admin.getUsername(),
                opType,
                target.getId(),
                target.getUsername(),
                BigDecimal.ZERO,
                null,
                pin,
                ipAddress,
                null,
                null
        );

        Wallet wallet = getOrCreateWallet(target.getId());
        WalletStatus oldStatus = wallet.getStatus();

        String refNum = generateReferenceNumber();
        try {
            // Update with JPA version tracking
            wallet.setStatus(newStatus);
            walletRepository.save(wallet);
            try { walletRepository.flush(); } catch (Exception ignored) {}

            // Write log to audit ledger
            WalletEntry entry = new WalletEntry();
            entry.setWallet(wallet);
            entry.setAmount(BigDecimal.ZERO);
            entry.setEntryType("STATUS_CHANGE");
            entry.setReferenceId(refNum);
            entry.setNarration(sanitizeNarration("Wallet status changed from " + oldStatus + " to " + newStatus + ": " + request.remark()));
            entry.setOpeningBalance(wallet.getBalance());
            entry.setClosingBalance(wallet.getBalance());
            entry.setOperator(admin);
            entry.setIpAddress(ipAddress);
            entry.setTransactionContext(WalletTransactionContext.STATUS_CHANGE);
            entry.setStatus(WalletTransactionStatus.SUCCESS);
            walletEntryRepository.save(entry);

            AuditLog audit = AuditLog.builder()
                    .operator(admin)
                    .targetUser(target)
                    .oldBalance(wallet.getBalance())
                    .newBalance(wallet.getBalance())
                    .amount(BigDecimal.ZERO)
                    .walletType("MAIN")
                    .ledgerType("STATUS_CHANGE")
                    .referenceNumber(refNum)
                    .ipAddress(ipAddress)
                    .remark(sanitizeRemark("Status override: " + oldStatus + " -> " + newStatus + ". Details: " + request.remark()))
                    .build();
            auditLogRepository.save(audit);

            adminWalletActionPinService.recordOperationSuccess(
                    admin.getId(),
                    admin.getUsername(),
                    opType,
                    target.getId(),
                    target.getUsername(),
                    BigDecimal.ZERO,
                    null,
                    refNum,
                    ipAddress,
                    null,
                    "Status changed from " + oldStatus + " to " + newStatus
            );

            return mapBalanceResponse(wallet);
        } catch (Exception ex) {
            adminWalletActionPinService.recordOperationFailure(
                    admin.getId(),
                    admin.getUsername(),
                    opType,
                    target.getId(),
                    target.getUsername(),
                    BigDecimal.ZERO,
                    null,
                    ex.getMessage(),
                    ipAddress,
                    null
            );
            throw ex;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public WalletDtos.TaxSummaryResponse getTaxSummary(UUID currentUserId) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName().name().equalsIgnoreCase("ADMIN"));

        BigDecimal tdsSum;
        BigDecimal gstSum;

        if (isAdmin) {
            tdsSum = walletEntryRepository.sumTdsByUserId(null);
            gstSum = walletEntryRepository.sumGstByUserId(null);
        } else {
            tdsSum = walletEntryRepository.sumTdsByUserId(currentUserId);
            gstSum = walletEntryRepository.sumGstByUserId(currentUserId);
        }

        return new WalletDtos.TaxSummaryResponse(tdsSum, gstSum);
    }

    @Override
    @Transactional
    public WalletDtos.FundRequestResponse createFundRequest(WalletDtos.FundRequestCreateRequest request, UUID currentUserId) {
        User target = userRepository.findById(UUID.fromString(request.userId()))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Current User not found"));

        checkHierarchyOrSelf(currentUser, target);

        FundRequest fr = FundRequest.builder()
                .user(target)
                .amount(request.amount())
                .status("PENDING")
                .utrNumber(request.utrNumber())
                .method(request.method())
                .remark(request.remark())
                .createdAt(Instant.now())
                .build();
        fr = fundRequestRepository.save(fr);

        // Add non-financial record to ledger trace
        String refNum = generateReferenceNumber();
        Wallet w = getOrCreateWallet(target.getId());

        WalletEntry entry = new WalletEntry();
        entry.setWallet(w);
        entry.setAmount(request.amount());
        entry.setEntryType("FUND_REQUEST");
        entry.setReferenceId(refNum);
        entry.setNarration("Fund request submitted for UTR: " + request.utrNumber());
        entry.setOpeningBalance(w.getBalance());
        entry.setClosingBalance(w.getBalance());
        entry.setOperator(currentUser);
        entry.setTransactionContext(WalletTransactionContext.FUND_REQUEST_CREATED);
        entry.setStatus(WalletTransactionStatus.PENDING);
        walletEntryRepository.save(entry);

        return toFundRequestResponse(fr);
    }

    private WalletDtos.FundRequestResponse toFundRequestResponse(FundRequest fr) {
        if (fr == null) return null;
        User reqUser = fr.getUser();
        String primaryRole = fr.getUserRole();
        if (primaryRole == null && reqUser != null && reqUser.getRoles() != null) {
            primaryRole = reqUser.getRoles().stream()
                    .map(r -> r.getName().name())
                    .findFirst()
                    .orElse("RETAILER");
        }
        return new WalletDtos.FundRequestResponse(
                fr.getId() != null ? fr.getId().toString() : null,
                reqUser != null && reqUser.getId() != null ? reqUser.getId().toString() : null,
                reqUser != null ? reqUser.getUsername() : null,
                reqUser != null ? reqUser.getFullName() : null,
                reqUser != null ? reqUser.getMobile() : null,
                primaryRole,
                fr.getAmount(),
                fr.getStatus(),
                fr.getUtrNumber(),
                fr.getMethod(),
                fr.getPaymentBank(),
                fr.getPaymentDateTime(),
                fr.getUserNote(),
                fr.getRemark(),
                fr.getAdminRemark(),
                fr.getRejectionReason(),
                fr.getBankAccount() != null && fr.getBankAccount().getId() != null ? fr.getBankAccount().getId().toString() : null,
                fr.getReceivingAccountHolder(),
                fr.getReceivingBankName(),
                fr.getReceivingAccountMasked(),
                fr.getReceivingIfsc(),
                fr.getReceivingBranch(),
                fr.getProofStoragePath() != null && !fr.getProofStoragePath().isBlank(),
                fr.getProofOriginalFilename(),
                fr.getApprovedBy() != null ? fr.getApprovedBy().getUsername() : null,
                fr.getApprovedAt(),
                fr.getCreatedAt()
        );
    }

    @Override
    @Transactional
    public WalletDtos.FundRequestResponse createFundRequestWithProof(
            WalletDtos.FundRequestSubmitRequest request,
            org.springframework.web.multipart.MultipartFile proofFile,
            UUID currentUserId,
            String ipAddress) {

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user not found"));

        if (request.amount() == null || request.amount().compareTo(BigDecimal.ONE) < 0) {
            throw new IllegalArgumentException("Requested amount must be at least ₹1.00");
        }

        String primaryRole = currentUser.getRoles().stream()
                .map(r -> r.getName().name())
                .findFirst()
                .orElse("RETAILER");

        AdminBankAccount bankAccount = adminBankAccountRepository.findById(request.bankAccountId())
                .orElseThrow(() -> new IllegalArgumentException("Selected bank account does not exist"));

        if (!Boolean.TRUE.equals(bankAccount.getIsActive())) {
            throw new IllegalArgumentException("The selected bank account is inactive. Please choose an active receiving bank account.");
        }

        String utr = request.utrNumber().trim();
        if (fundRequestRepository.existsByUtrNumberIgnoreCaseAndStatusIn(utr, List.of("PENDING", "APPROVED"))) {
            throw new IllegalArgumentException("A fund request with UTR '" + utr + "' has already been submitted and is pending or approved.");
        }

        ProofStorageService.StoredProof storedProof;
        try {
            storedProof = proofStorageService.storeProof(proofFile);
        } catch (Exception e) {
            log.error("Failed to store proof file for fund request by user {}", currentUser.getUsername(), e);
            throw new IllegalArgumentException("Transaction proof upload failed: " + e.getMessage(), e);
        }

        Instant paymentTime = request.paymentDateTime() != null ? request.paymentDateTime() : Instant.now();

        FundRequest fr = FundRequest.builder()
                .user(currentUser)
                .bankAccount(bankAccount)
                .receivingAccountHolder(bankAccount.getAccountHolderName())
                .receivingBankName(bankAccount.getBankName())
                .receivingAccountMasked(bankAccount.getAccountNumberMasked())
                .receivingIfsc(bankAccount.getIfscCode())
                .receivingBranch(bankAccount.getBranch())
                .userRole(primaryRole)
                .amount(request.amount())
                .status("PENDING")
                .utrNumber(utr)
                .method(request.method().trim())
                .paymentBank(request.paymentBank() != null ? request.paymentBank().trim() : null)
                .paymentDateTime(paymentTime)
                .userNote(request.userNote() != null ? request.userNote().trim() : null)
                .remark(request.userNote())
                .proofStoragePath(storedProof.storagePath())
                .proofOriginalFilename(storedProof.originalFilename())
                .proofContentType(storedProof.contentType())
                .proofFileSize(storedProof.fileSize())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        FundRequest saved = fundRequestRepository.save(fr);

        FundRequestAuditLog audit = FundRequestAuditLog.builder()
                .fundRequest(saved)
                .previousStatus("NONE")
                .newStatus("PENDING")
                .actionType("SUBMITTED")
                .actionReason("Fund request submitted by user " + currentUser.getUsername())
                .ipAddress(ipAddress)
                .createdAt(Instant.now())
                .build();
        fundRequestAuditLogRepository.save(audit);

        // Add non-financial record to ledger trace for auditability
        String refNum = generateReferenceNumber();
        Wallet w = getOrCreateWallet(currentUser.getId());

        WalletEntry entry = new WalletEntry();
        entry.setWallet(w);
        entry.setAmount(request.amount());
        entry.setEntryType("FUND_REQUEST");
        entry.setReferenceId(refNum);
        entry.setNarration("Fund request submitted for UTR: " + utr);
        entry.setOpeningBalance(w.getBalance());
        entry.setClosingBalance(w.getBalance());
        entry.setOperator(currentUser);
        entry.setIpAddress(ipAddress);
        entry.setTransactionContext(WalletTransactionContext.FUND_REQUEST_CREATED);
        entry.setStatus(WalletTransactionStatus.PENDING);
        walletEntryRepository.save(entry);

        log.info("User {} ({}) submitted fund request {} for ₹{} (UTR: {})",
                currentUser.getUsername(), primaryRole, saved.getId(), saved.getAmount(), utr);

        return toFundRequestResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<WalletDtos.FundRequestResponse> getMyFundRequests(UUID currentUserId) {
        return fundRequestRepository.findByUserIdOrderByCreatedAtDesc(currentUserId).stream()
                .map(this::toFundRequestResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ProofData getFundRequestProof(UUID requestId, UUID currentUserId, boolean isAdmin) {
        FundRequest fr = fundRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Fund request not found"));

        if (!isAdmin && !fr.getUser().getId().equals(currentUserId)) {
            throw new AccessDeniedException("Access denied: You can only view proof for your own fund requests");
        }

        if (fr.getProofStoragePath() == null || fr.getProofStoragePath().isBlank()) {
            throw new IllegalArgumentException("No proof document associated with this fund request");
        }

        try {
            byte[] bytes = proofStorageService.loadProof(fr.getProofStoragePath());
            String ct = fr.getProofContentType() != null ? fr.getProofContentType() : "image/jpeg";
            String fn = fr.getProofOriginalFilename() != null ? fr.getProofOriginalFilename() : "proof.jpg";
            return new ProofData(bytes, ct, fn);
        } catch (Exception e) {
            log.error("Failed to load proof image for request {}", requestId, e);
            throw new IllegalStateException("Failed to load proof file", e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<WalletDtos.FundRequestResponse> getFundRequests(UUID currentUserId) {
        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName().name().equalsIgnoreCase("ADMIN"));

        List<FundRequest> reqs;
        if (isAdmin) {
            reqs = fundRequestRepository.findAll();
        } else {
            // Distributors can view their hierarchy's fund requests
            String currentUserIdStr = currentUserId.toString();
            reqs = fundRequestRepository.findAll().stream()
                    .filter(fr -> {
                        User reqUser = fr.getUser();
                        if (reqUser.getId().equals(currentUserId)) {
                            return true;
                        }
                        String ref = reqUser.getAddedByUserRef();
                        while (ref != null && !ref.isBlank()) {
                            if (ref.equalsIgnoreCase(currentUserIdStr)) {
                                return true;
                            }
                            try {
                                UUID parentUuid = UUID.fromString(ref);
                                User nextParent = userRepository.findById(parentUuid).orElse(null);
                                if (nextParent == null) {
                                    break;
                                }
                                ref = nextParent.getAddedByUserRef();
                            } catch (Exception e) {
                                break;
                            }
                        }
                        return false;
                    })
                    .collect(Collectors.toList());
        }

        return reqs.stream()
                .map(this::toFundRequestResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public WalletDtos.FundRequestResponse approveFundRequest(UUID requestId, UUID adminId, String ipAddress) {
        return approveFundRequest(requestId, null, adminId, ipAddress, null);
    }

    @Override
    @Transactional
    public WalletDtos.FundRequestResponse approveFundRequest(UUID requestId, String remark, UUID adminId, String ipAddress) {
        return approveFundRequest(requestId, remark, adminId, ipAddress, null);
    }

    @Override
    @Transactional
    public WalletDtos.FundRequestResponse approveFundRequest(UUID requestId, String remark, UUID adminId, String ipAddress, String pin) {
        enforceAdmin(adminId);

        FundRequest fr = fundRequestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Fund request not found"));

        if (!"PENDING".equalsIgnoreCase(fr.getStatus())) {
            throw new IllegalStateException("Only PENDING requests can be approved");
        }

        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin operator not found"));

        User targetUser = fr.getUser();

        // 1. Mandatory Centralized PIN verification before fund request approval
        adminWalletActionPinService.verifyActionPin(
                admin.getId(),
                admin.getUsername(),
                AdminWalletOperationType.APPROVE_FUND_REQUEST,
                targetUser.getId(),
                targetUser.getUsername(),
                fr.getAmount(),
                fr.getId().toString(),
                pin,
                ipAddress,
                null,
                requestId.toString()
        );

        Wallet tgtWallet = getOrCreateWalletWithLock(targetUser.getId());
        validateWalletStatus(tgtWallet, "CREDIT");

        BigDecimal amount = fr.getAmount();
        String refNum = generateReferenceNumber();

        try {
            if (aeps2faSettlementService != null) {
                aeps2faSettlementService.settleOutstandingCharges(targetUser.getId(), amount, refNum);
            }

            BigDecimal oldTgtBal = tgtWallet.getBalance();
            BigDecimal newTgtBal = oldTgtBal.add(amount);
            tgtWallet.setBalance(newTgtBal);
            walletRepository.save(tgtWallet);
            try { walletRepository.flush(); } catch (Exception ignored) {}

            fr.setStatus("APPROVED");
            fr.setApprovedBy(admin);
            fr.setApprovedAt(Instant.now());
            fr.setAdminRemark(remark != null && !remark.isBlank() ? remark : ("Approved by " + admin.getUsername() + " - Ref: " + refNum));
            fundRequestRepository.save(fr);

            WalletEntry tgtEntry = new WalletEntry();
            tgtEntry.setWallet(tgtWallet);
            tgtEntry.setAmount(amount);
            tgtEntry.setEntryType("CREDIT");
            tgtEntry.setReferenceId(refNum);
            tgtEntry.setIdempotencyKey("FUND_REQ_APPROVE_" + fr.getId());
            tgtEntry.setNarration(sanitizeNarration("Request approved, UTR: " + fr.getUtrNumber()));
            tgtEntry.setOpeningBalance(oldTgtBal);
            tgtEntry.setClosingBalance(newTgtBal);
            tgtEntry.setOperator(admin);
            tgtEntry.setIpAddress(ipAddress);
            tgtEntry.setTransactionContext(WalletTransactionContext.FUND_REQUEST_APPROVED);
            tgtEntry.setStatus(WalletTransactionStatus.SUCCESS);
            walletEntryRepository.save(tgtEntry);

            if (fundRequestAuditLogRepository != null) {
                FundRequestAuditLog frAudit = FundRequestAuditLog.builder()
                        .fundRequest(fr)
                        .previousStatus("PENDING")
                        .newStatus("APPROVED")
                        .admin(admin)
                        .actionType("APPROVED")
                        .actionReason(fr.getAdminRemark())
                        .ipAddress(ipAddress)
                        .createdAt(Instant.now())
                        .build();
                fundRequestAuditLogRepository.save(frAudit);
            }

            AuditLog auditTgt = AuditLog.builder()
                    .operator(admin)
                    .targetUser(targetUser)
                    .oldBalance(oldTgtBal)
                    .newBalance(newTgtBal)
                    .amount(amount)
                    .walletType("MAIN")
                    .ledgerType("CREDIT")
                    .referenceNumber(refNum)
                    .ipAddress(ipAddress)
                    .remark("Credited user for request approval from Admin: " + admin.getUsername())
                    .build();
            auditLogRepository.save(auditTgt);

            adminWalletActionPinService.recordOperationSuccess(
                    admin.getId(),
                    admin.getUsername(),
                    AdminWalletOperationType.APPROVE_FUND_REQUEST,
                    targetUser.getId(),
                    targetUser.getUsername(),
                    amount,
                    fr.getId().toString(),
                    refNum,
                    ipAddress,
                    requestId.toString(),
                    "Fund request approved"
            );

            return toFundRequestResponse(fr);
        } catch (Exception ex) {
            adminWalletActionPinService.recordOperationFailure(
                    admin.getId(),
                    admin.getUsername(),
                    AdminWalletOperationType.APPROVE_FUND_REQUEST,
                    targetUser.getId(),
                    targetUser.getUsername(),
                    amount,
                    fr.getId().toString(),
                    ex.getMessage(),
                    ipAddress,
                    requestId.toString()
            );
            throw ex;
        }
    }

    @Override
    @Transactional
    public WalletDtos.FundRequestResponse rejectFundRequest(UUID requestId, UUID adminId, String ipAddress) {
        return rejectFundRequest(requestId, null, adminId, ipAddress, null);
    }

    @Override
    @Transactional
    public WalletDtos.FundRequestResponse rejectFundRequest(UUID requestId, String remark, UUID adminId, String ipAddress) {
        return rejectFundRequest(requestId, remark, adminId, ipAddress, null);
    }

    @Override
    @Transactional
    public WalletDtos.FundRequestResponse rejectFundRequest(UUID requestId, String remark, UUID adminId, String ipAddress, String pin) {
        enforceAdmin(adminId);

        FundRequest fr = fundRequestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Fund request not found"));

        if (!"PENDING".equalsIgnoreCase(fr.getStatus())) {
            throw new IllegalStateException("Only PENDING requests can be rejected");
        }

        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin operator not found"));

        User targetUser = fr.getUser();

        // 1. Mandatory Centralized PIN verification before fund request rejection
        adminWalletActionPinService.verifyActionPin(
                admin.getId(),
                admin.getUsername(),
                AdminWalletOperationType.REJECT_FUND_REQUEST,
                targetUser.getId(),
                targetUser.getUsername(),
                fr.getAmount(),
                fr.getId().toString(),
                pin,
                ipAddress,
                null,
                requestId.toString()
        );

        String refNum = generateReferenceNumber();
        try {
            fr.setStatus("REJECTED");
            fr.setApprovedBy(admin);
            fr.setApprovedAt(Instant.now());
            String declineReason = remark != null && !remark.isBlank() ? remark : ("Rejected by " + admin.getUsername());
            fr.setAdminRemark(declineReason);
            fr.setRejectionReason(declineReason);
            fundRequestRepository.save(fr);

            if (fundRequestAuditLogRepository != null) {
                FundRequestAuditLog frAudit = FundRequestAuditLog.builder()
                        .fundRequest(fr)
                        .previousStatus("PENDING")
                        .newStatus("REJECTED")
                        .admin(admin)
                        .actionType("REJECTED")
                        .actionReason(declineReason)
                        .ipAddress(ipAddress)
                        .createdAt(Instant.now())
                        .build();
                fundRequestAuditLogRepository.save(frAudit);
            }

            Wallet w = getOrCreateWallet(fr.getUser().getId());

            WalletEntry entry = new WalletEntry();
            entry.setWallet(w);
            entry.setAmount(fr.getAmount());
            entry.setEntryType("FUND_REQUEST");
            entry.setReferenceId(refNum);
            entry.setNarration("Fund request rejected, UTR: " + fr.getUtrNumber() + (remark != null && !remark.isBlank() ? (" - Reason: " + remark) : ""));
            entry.setOpeningBalance(w.getBalance());
            entry.setClosingBalance(w.getBalance());
            entry.setOperator(admin);
            entry.setIpAddress(ipAddress);
            entry.setTransactionContext(WalletTransactionContext.FUND_REQUEST_REJECTED);
            entry.setStatus(WalletTransactionStatus.CANCELLED);
            walletEntryRepository.save(entry);

            adminWalletActionPinService.recordOperationSuccess(
                    admin.getId(),
                    admin.getUsername(),
                    AdminWalletOperationType.REJECT_FUND_REQUEST,
                    targetUser.getId(),
                    targetUser.getUsername(),
                    fr.getAmount(),
                    fr.getId().toString(),
                    refNum,
                    ipAddress,
                    requestId.toString(),
                    "Fund request rejected"
            );

            return toFundRequestResponse(fr);
        } catch (Exception ex) {
            adminWalletActionPinService.recordOperationFailure(
                    admin.getId(),
                    admin.getUsername(),
                    AdminWalletOperationType.REJECT_FUND_REQUEST,
                    targetUser.getId(),
                    targetUser.getUsername(),
                    fr.getAmount(),
                    fr.getId().toString(),
                    ex.getMessage(),
                    ipAddress,
                    requestId.toString()
            );
            throw ex;
        }
    }


    @Override
    @Transactional(readOnly = true)
    public Page<WalletDtos.WalletHistoryEntryResponse> getLedgerHistory(
            UUID currentUserId,
            String type,
            String context,
            String status,
            String search,
            String startDate,
            String endDate,
            Pageable pageable) {

        User currentUser = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean isAdmin = currentUser.getRoles().stream()
                .anyMatch(r -> r.getName().name().equalsIgnoreCase("ADMIN"));

        Wallet wallet = null;
        if (!isAdmin) {
            wallet = getOrCreateWallet(currentUserId);
        }

        UUID walletId = wallet != null ? wallet.getId() : null;
        WalletTransactionStatus statusEnum = (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) ? WalletTransactionStatus.valueOf(status.toUpperCase()) : null;
        WalletTransactionContext contextEnum = (context != null && !context.isBlank() && !context.equalsIgnoreCase("ALL")) ? WalletTransactionContext.valueOf(context.toUpperCase()) : null;
        String typeFilter = (type != null && !type.isBlank() && !type.equalsIgnoreCase("ALL")) ? type.toUpperCase() : null;
        String searchVal = (search != null && !search.isBlank()) ? "%" + search.trim().toLowerCase() + "%" : "%";

        Instant startInstant = null;
        Instant endInstant = null;
        try {
            if (startDate != null && !startDate.isBlank()) {
                startInstant = Instant.parse(startDate);
            }
            if (endDate != null && !endDate.isBlank()) {
                endInstant = Instant.parse(endDate);
            }
        } catch (Exception e) {
            log.error("Failed to parse date range filters: {}", e.getMessage());
        }

        Page<WalletEntry> entries = walletEntryRepository.findWithFilters(
                walletId,
                statusEnum,
                contextEnum,
                typeFilter,
                startInstant,
                endInstant,
                searchVal,
                pageable);

        List<WalletDtos.WalletHistoryEntryResponse> mappedList = entries.getContent().stream()
                .map(e -> new WalletDtos.WalletHistoryEntryResponse(
                        e.getReferenceId(),
                        e.getStatus().name(),
                        e.getTransactionContext() != null ? e.getTransactionContext().name() : "N/A",
                        e.getEntryType(),
                        e.getAmount(),
                        e.getOpeningBalance() != null ? e.getOpeningBalance() : BigDecimal.ZERO,
                        e.getClosingBalance() != null ? e.getClosingBalance() : BigDecimal.ZERO,
                        e.getOperator() != null ? e.getOperator().getUsername() : "SYSTEM",
                        e.getWallet().getUser().getUsername(),
                        e.getTransactionContext() != null ? e.getTransactionContext().name().split("_")[0] : "N/A",
                        e.getCreatedAt(),
                        e.getNarration()
                ))
                .collect(Collectors.toList());

        return new PageImpl<>(mappedList, pageable, entries.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] exportLedgerHistory(
            UUID currentUserId,
            String type,
            String context,
            String status,
            String search,
            String startDate,
            String endDate) {

        Page<WalletDtos.WalletHistoryEntryResponse> history = getLedgerHistory(
                currentUserId, type, context, status, search, startDate, endDate, Pageable.unpaged());

        StringBuilder csv = new StringBuilder();
        csv.append("Reference Number,Status,Transaction Context,Ledger Type,Amount,Opening Balance,Closing Balance,Operator,Target User,Service,Date,Narration\n");

        for (WalletDtos.WalletHistoryEntryResponse row : history.getContent()) {
            csv.append(row.referenceNumber()).append(",")
                    .append(row.status()).append(",")
                    .append(row.transactionContext()).append(",")
                    .append(row.ledgerType()).append(",")
                    .append(row.amount()).append(",")
                    .append(row.openingBalance()).append(",")
                    .append(row.closingBalance()).append(",")
                    .append(row.operatorUsername()).append(",")
                    .append(row.targetUsername()).append(",")
                    .append(row.serviceName()).append(",")
                    .append(row.createdAt()).append(",")
                    .append("\"").append(row.narration().replace("\"", "\"\"")).append("\"\n");
        }

        return csv.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    // SERVICE-REUSABLE TRANSACTION ENTRYPOINTS (AEPS, BBPS, Recharge, DMT, Payout)

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse debitForService(
            UUID userId,
            BigDecimal amount,
            String narration,
            WalletTransactionContext context,
            String serviceName,
            String ipAddress,
            String idempotencyKey) {

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<WalletEntry> existing = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return mapBalanceResponse(existing.get().getWallet());
            }
        }

        Wallet wallet = getOrCreateWalletWithLock(userId);
        validateWalletStatus(wallet, "DEBIT");

        BigDecimal available = wallet.getBalance().subtract(wallet.getLockedBalance());
        if (available.compareTo(amount) < 0) {
            throw new IllegalArgumentException("Insufficient wallet balance for " + serviceName);
        }

        BigDecimal oldBal = wallet.getBalance();
        BigDecimal newBal = oldBal.subtract(amount);
        wallet.setBalance(newBal);
        walletRepository.save(wallet);

        String refNum = generateReferenceNumber();

        WalletEntry entry = new WalletEntry();
        entry.setWallet(wallet);
        entry.setAmount(amount);
        entry.setEntryType("SERVICE_DEBIT");
        entry.setReferenceId(refNum);
        entry.setNarration(sanitizeNarration(serviceName + " usage: " + narration));
        entry.setOpeningBalance(oldBal);
        entry.setClosingBalance(newBal);
        entry.setIpAddress(ipAddress);
        entry.setIdempotencyKey(idempotencyKey);
        entry.setTransactionContext(context);
        entry.setStatus(WalletTransactionStatus.SUCCESS);
        walletEntryRepository.save(entry);

        AuditLog audit = AuditLog.builder()
                .targetUser(wallet.getUser())
                .oldBalance(oldBal)
                .newBalance(newBal)
                .amount(amount)
                .walletType("MAIN")
                .ledgerType("SERVICE_DEBIT")
                .referenceNumber(refNum)
                .ipAddress(ipAddress)
                .remark(sanitizeRemark("Service debit: " + serviceName + " Context: " + context))
                .build();
        auditLogRepository.save(audit);

        return mapBalanceResponse(wallet);
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse creditForService(
            UUID userId,
            BigDecimal amount,
            String narration,
            WalletTransactionContext context,
            String serviceName,
            String ipAddress,
            String idempotencyKey) {

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<WalletEntry> existing = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return mapBalanceResponse(existing.get().getWallet());
            }
        }

        Wallet wallet = getOrCreateWalletWithLock(userId);
        validateWalletStatus(wallet, "CREDIT");

        String refNum = generateReferenceNumber();
        if (aeps2faSettlementService != null) {
            aeps2faSettlementService.settleOutstandingCharges(userId, amount, refNum);
        }

        BigDecimal oldBal = wallet.getBalance();
        BigDecimal newBal = oldBal.add(amount);
        wallet.setBalance(newBal);
        walletRepository.save(wallet);

        WalletEntry entry = new WalletEntry();
        entry.setWallet(wallet);
        entry.setAmount(amount);
        entry.setEntryType("SERVICE_CREDIT");
        entry.setReferenceId(refNum);
        entry.setNarration(sanitizeNarration(serviceName + " credit: " + narration));
        entry.setOpeningBalance(oldBal);
        entry.setClosingBalance(newBal);
        entry.setIpAddress(ipAddress);
        entry.setIdempotencyKey(idempotencyKey);
        entry.setTransactionContext(context);
        entry.setStatus(WalletTransactionStatus.SUCCESS);
        walletEntryRepository.save(entry);

        AuditLog audit = AuditLog.builder()
                .targetUser(wallet.getUser())
                .oldBalance(oldBal)
                .newBalance(newBal)
                .amount(amount)
                .walletType("MAIN")
                .ledgerType("SERVICE_CREDIT")
                .referenceNumber(refNum)
                .ipAddress(ipAddress)
                .remark(sanitizeRemark("Service credit: " + serviceName + " Context: " + context))
                .build();
        auditLogRepository.save(audit);

        return mapBalanceResponse(wallet);
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse refundForService(
            UUID userId,
            BigDecimal amount,
            String narration,
            String parentReferenceNumber,
            WalletTransactionContext context,
            String serviceName,
            String ipAddress,
            String idempotencyKey) {

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<WalletEntry> existing = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return mapBalanceResponse(existing.get().getWallet());
            }
        }

        Wallet wallet = getOrCreateWalletWithLock(userId);
        validateWalletStatus(wallet, "CREDIT");

        String refNum = generateReferenceNumber();
        if (aeps2faSettlementService != null) {
            aeps2faSettlementService.settleOutstandingCharges(userId, amount, refNum);
        }

        BigDecimal oldBal = wallet.getBalance();
        BigDecimal newBal = oldBal.add(amount);
        wallet.setBalance(newBal);
        walletRepository.save(wallet);

        WalletEntry entry = new WalletEntry();
        entry.setWallet(wallet);
        entry.setAmount(amount);
        entry.setEntryType("SERVICE_REFUND");
        entry.setReferenceId(refNum);
        entry.setNarration(sanitizeNarration("Refund for parent txn " + parentReferenceNumber + ": " + narration));
        entry.setOpeningBalance(oldBal);
        entry.setClosingBalance(newBal);
        entry.setIpAddress(ipAddress);
        entry.setIdempotencyKey(idempotencyKey);
        entry.setTransactionContext(context);
        entry.setStatus(WalletTransactionStatus.SUCCESS);
        walletEntryRepository.save(entry);

        AuditLog audit = AuditLog.builder()
                .targetUser(wallet.getUser())
                .oldBalance(oldBal)
                .newBalance(newBal)
                .amount(amount)
                .walletType("MAIN")
                .ledgerType("SERVICE_REFUND")
                .referenceNumber(refNum)
                .ipAddress(ipAddress)
                .remark(sanitizeRemark("Service refund: " + serviceName + " parentRef: " + parentReferenceNumber + " Context: " + context))
                .build();
        auditLogRepository.save(audit);

        return mapBalanceResponse(wallet);
    }

    @Override
    @Transactional
    public WalletDtos.WalletBalanceResponse debitFor2faCharge(
            UUID userId,
            BigDecimal amount,
            String narration,
            String serviceName,
            String ipAddress,
            String idempotencyKey) {

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<WalletEntry> existing = walletEntryRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return mapBalanceResponse(existing.get().getWallet());
            }
        }

        Wallet wallet = getOrCreateWalletWithLock(userId);
        validateWalletStatus(wallet, "DEBIT");

        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("2FA charge amount must be positive");
        }

        BigDecimal oldBal = wallet.getBalance();
        BigDecimal newBal = oldBal.subtract(amount);
        wallet.setBalance(newBal);
        walletRepository.save(wallet);

        String refNum = generateReferenceNumber();

        WalletEntry entry = new WalletEntry();
        entry.setWallet(wallet);
        entry.setAmount(amount);
        entry.setEntryType("SERVICE_DEBIT");
        entry.setReferenceId(refNum);
        entry.setNarration(sanitizeNarration(serviceName + " usage: " + narration));
        entry.setOpeningBalance(oldBal);
        entry.setClosingBalance(newBal);
        entry.setIpAddress(ipAddress);
        entry.setIdempotencyKey(idempotencyKey);
        entry.setTransactionContext(WalletTransactionContext.AEPS_2FA_CHARGE);
        entry.setStatus(WalletTransactionStatus.SUCCESS);
        walletEntryRepository.save(entry);

        AuditLog audit = AuditLog.builder()
                .targetUser(wallet.getUser())
                .oldBalance(oldBal)
                .newBalance(newBal)
                .amount(amount)
                .walletType("MAIN")
                .ledgerType("SERVICE_DEBIT")
                .referenceNumber(refNum)
                .ipAddress(ipAddress)
                .remark(sanitizeRemark("2FA Charge debit: " + serviceName + " Context: AEPS_2FA_CHARGE"))
                .build();
        auditLogRepository.save(audit);

        return mapBalanceResponse(wallet);
    }

    private String sanitizeNarration(String narration) {
        if (narration == null) return "";
        if (narration.length() <= 128) return narration;
        return narration.substring(0, 125) + "...";
    }

    private String sanitizeRemark(String remark) {
        if (remark == null) return "";
        if (remark.length() <= 255) return remark;
        return remark.substring(0, 252) + "...";
    }
}
