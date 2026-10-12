package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.WalletTransferDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.WalletEntryRepository;
import com.rupiksha.backend.repository.WalletRepository;
import com.rupiksha.backend.repository.WalletTransferRepository;
import com.rupiksha.backend.service.WalletTransferService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WalletTransferServiceImpl implements WalletTransferService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final WalletEntryRepository walletEntryRepository;
    private final WalletTransferRepository walletTransferRepository;

    private String cleanMobile(String mobile) {
        if (mobile == null) return "";
        String cleaned = mobile.replaceAll("[^0-9]", "");
        if (cleaned.length() > 10 && cleaned.startsWith("91")) {
            cleaned = cleaned.substring(2);
        } else if (cleaned.length() > 10 && cleaned.startsWith("0")) {
            cleaned = cleaned.substring(1);
        }
        return cleaned;
    }

    private String generateTransferReference() {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randStr = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        return "W2W-" + dateStr + "-" + randStr;
    }

    private String getPrimaryRole(User user) {
        if (user.getRoles() != null && !user.getRoles().isEmpty()) {
            for (Role role : user.getRoles()) {
                if (role.getName() == RoleName.SUPER_DISTRIBUTOR) return "SUPER_DISTRIBUTOR";
            }
            for (Role role : user.getRoles()) {
                if (role.getName() == RoleName.DISTRIBUTOR) return "DISTRIBUTOR";
            }
            for (Role role : user.getRoles()) {
                if (role.getName() == RoleName.RETAILER) return "RETAILER";
            }
            for (Role role : user.getRoles()) {
                if (role.getName() == RoleName.ADMIN) return "ADMIN";
            }
            return user.getRoles().iterator().next().getName().name();
        }
        return "RETAILER";
    }

    private WalletTransferDtos.RecipientLookupResponse mapToRecipientResponse(User recipient) {
        boolean isEligible = recipient.getStatus() != UserStatus.INACTIVE && recipient.getStatus() != UserStatus.REJECTED;
        String message = isEligible ? "User verified and eligible for fund transfer" : "Recipient account is currently inactive or rejected";

        return new WalletTransferDtos.RecipientLookupResponse(
                recipient.getId().toString(),
                recipient.getFullName(),
                recipient.getBusinessName() != null && !recipient.getBusinessName().isBlank() ? recipient.getBusinessName() : recipient.getFullName(),
                recipient.getMobile(),
                recipient.getPartyCode() != null ? recipient.getPartyCode() : "N/A",
                getPrimaryRole(recipient),
                recipient.getCity() != null ? recipient.getCity() : "",
                recipient.getStateName() != null ? recipient.getStateName() : "",
                recipient.getAddressLine1() != null ? recipient.getAddressLine1() : "",
                recipient.getStatus() != null ? recipient.getStatus().name() : "ACTIVE",
                isEligible,
                message
        );
    }

    private Wallet getOrCreateWalletWithLock(UUID userId, User fallbackUser) {
        return walletRepository.findByUserIdWithLock(userId).orElseGet(() -> {
            Wallet newWallet = new Wallet();
            newWallet.setUser(fallbackUser != null ? fallbackUser : userRepository.findById(userId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found for wallet creation: " + userId)));
            newWallet.setBalance(BigDecimal.ZERO);
            newWallet.setLockedBalance(BigDecimal.ZERO);
            newWallet.setStatus(WalletStatus.ACTIVE);
            return walletRepository.save(newWallet);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public List<WalletTransferDtos.RecipientLookupResponse> searchRecipients(String mobile, UUID currentUserId) {
        String cleanedMobile = cleanMobile(mobile);
        if (cleanedMobile.length() < 3) {
            return Collections.emptyList();
        }

        List<User> users;
        if (cleanedMobile.length() == 10) {
            users = userRepository.findAllByMobile(cleanedMobile);
            if (users == null || users.isEmpty()) {
                users = userRepository.findByMobile(cleanedMobile).map(List::of).orElse(Collections.emptyList());
            }
        } else {
            users = userRepository.findByMobilePrefix(cleanedMobile);
            if (users == null) {
                users = Collections.emptyList();
            }
        }

        return users.stream()
                .filter(u -> !u.getId().equals(currentUserId))
                .map(this::mapToRecipientResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public WalletTransferDtos.RecipientLookupResponse searchRecipient(String mobile, UUID currentUserId) {
        String cleanedMobile = cleanMobile(mobile);
        if (cleanedMobile.length() != 10) {
            throw new IllegalArgumentException("Please enter a valid 10-digit mobile number");
        }

        User sender = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user not found"));

        List<WalletTransferDtos.RecipientLookupResponse> recipients = searchRecipients(mobile, currentUserId);
        if (recipients.isEmpty()) {
            if (cleanedMobile.equalsIgnoreCase(cleanMobile(sender.getMobile()))) {
                throw new IllegalArgumentException("Cannot transfer funds to your own wallet");
            }
            throw new IllegalArgumentException("No Rupiksha user found with mobile number " + cleanedMobile);
        }

        return recipients.get(0);
    }

    @Override
    @Transactional
    public WalletTransferDtos.WalletTransferResponse transferFunds(
            WalletTransferDtos.WalletTransferRequest request,
            UUID currentUserId,
            String clientIp,
            String idempotencyKey
    ) {
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ONE) < 0) {
            throw new IllegalArgumentException("Transfer amount must be at least ₹1.00");
        }

        BigDecimal amount = request.amount().setScale(2, java.math.RoundingMode.HALF_UP);

        // 1. Check Idempotency Key
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<WalletTransfer> existing = walletTransferRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                WalletTransfer wt = existing.get();
                if (!wt.getSender().getId().equals(currentUserId)) {
                    throw new AccessDeniedException("Idempotency key already used by another user");
                }
                if (wt.getAmount().compareTo(amount) != 0) {
                    throw new IllegalArgumentException("Idempotency key reused with different amount");
                }
                log.info("Returning cached response for idempotency key: {}", idempotencyKey);
                Wallet senderWallet = walletRepository.findByUserId(currentUserId).orElse(null);
                BigDecimal senderBal = senderWallet != null ? senderWallet.getBalance() : BigDecimal.ZERO;
                return toResponse(wt, senderBal);
            }
        }

        // 2. Resolve Sender & Recipient
        User sender = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Sender user not found"));

        User recipient;
        if (request.recipientId() != null && !request.recipientId().isBlank()) {
            recipient = userRepository.findById(UUID.fromString(request.recipientId()))
                    .orElseThrow(() -> new IllegalArgumentException("Recipient not found"));
        } else if (request.recipientMobile() != null && !request.recipientMobile().isBlank()) {
            String cleaned = cleanMobile(request.recipientMobile());
            recipient = userRepository.findByMobile(cleaned)
                    .orElseThrow(() -> new IllegalArgumentException("No Rupiksha user found with mobile " + cleaned));
        } else {
            throw new IllegalArgumentException("Recipient mobile or ID is required");
        }

        if (sender.getId().equals(recipient.getId())) {
            throw new IllegalArgumentException("Cannot transfer funds to your own wallet");
        }

        if (recipient.getStatus() == UserStatus.INACTIVE || recipient.getStatus() == UserStatus.REJECTED) {
            throw new IllegalStateException("Recipient account is inactive or rejected and cannot receive funds");
        }

        // 3. Concurrency Lock: Lock both wallets in deterministic UUID order to prevent deadlocks
        UUID idA = sender.getId();
        UUID idB = recipient.getId();
        UUID firstId = idA.compareTo(idB) < 0 ? idA : idB;
        UUID secondId = idA.compareTo(idB) < 0 ? idB : idA;

        User firstUser = idA.equals(firstId) ? sender : recipient;
        User secondUser = idA.equals(firstId) ? recipient : sender;

        Wallet w1 = getOrCreateWalletWithLock(firstId, firstUser);
        Wallet w2 = getOrCreateWalletWithLock(secondId, secondUser);

        Wallet senderWallet = idA.equals(firstId) ? w1 : w2;
        Wallet recipientWallet = idA.equals(firstId) ? w2 : w1;

        if (senderWallet.getStatus() == WalletStatus.BLOCKED) {
            throw new IllegalStateException("Transaction blocked: Your wallet is BLOCKED");
        }
        if (recipientWallet.getStatus() == WalletStatus.BLOCKED) {
            throw new IllegalStateException("Transaction blocked: Recipient wallet is BLOCKED");
        }

        BigDecimal availableBalance = senderWallet.getBalance().subtract(senderWallet.getLockedBalance());
        if (availableBalance.compareTo(amount) < 0) {
            throw new IllegalArgumentException("Insufficient wallet balance. Available: ₹" + availableBalance + ", Required: ₹" + amount);
        }

        // 4. Perform Atomic Mutations
        String reference = generateTransferReference();

        BigDecimal senderOpening = senderWallet.getBalance();
        BigDecimal senderClosing = senderOpening.subtract(amount);
        senderWallet.setBalance(senderClosing);
        walletRepository.save(senderWallet);

        BigDecimal recipientOpening = recipientWallet.getBalance();
        BigDecimal recipientClosing = recipientOpening.add(amount);
        recipientWallet.setBalance(recipientClosing);
        walletRepository.save(recipientWallet);

        // 5. Create Sender & Recipient Wallet Entries
        String senderRemark = "Wallet transfer to " + recipient.getFullName() + 
                (request.remarks() != null && !request.remarks().isBlank() ? " (" + request.remarks() + ")" : "");
        WalletEntry senderEntry = new WalletEntry();
        senderEntry.setWallet(senderWallet);
        senderEntry.setAmount(amount);
        senderEntry.setEntryType("DEBIT");
        senderEntry.setReferenceId(reference);
        senderEntry.setNarration(senderRemark);
        senderEntry.setOpeningBalance(senderOpening);
        senderEntry.setClosingBalance(senderClosing);
        senderEntry.setOperator(sender);
        senderEntry.setIpAddress(clientIp != null ? clientIp : "127.0.0.1");
        senderEntry.setStatus(WalletTransactionStatus.SUCCESS);
        senderEntry.setTransactionContext(WalletTransactionContext.WALLET_TRANSFER);
        senderEntry.setIdempotencyKey(idempotencyKey != null ? idempotencyKey + "_SENDER" : UUID.randomUUID().toString());
        walletEntryRepository.save(senderEntry);

        String recipientRemark = "Wallet transfer from " + sender.getFullName() + 
                (request.remarks() != null && !request.remarks().isBlank() ? " (" + request.remarks() + ")" : "");
        WalletEntry recipientEntry = new WalletEntry();
        recipientEntry.setWallet(recipientWallet);
        recipientEntry.setAmount(amount);
        recipientEntry.setEntryType("CREDIT");
        recipientEntry.setReferenceId(reference);
        recipientEntry.setNarration(recipientRemark);
        recipientEntry.setOpeningBalance(recipientOpening);
        recipientEntry.setClosingBalance(recipientClosing);
        recipientEntry.setOperator(sender);
        recipientEntry.setIpAddress(clientIp != null ? clientIp : "127.0.0.1");
        recipientEntry.setStatus(WalletTransactionStatus.SUCCESS);
        recipientEntry.setTransactionContext(WalletTransactionContext.WALLET_TRANSFER);
        recipientEntry.setIdempotencyKey(idempotencyKey != null ? idempotencyKey + "_RECIPIENT" : UUID.randomUUID().toString());
        walletEntryRepository.save(recipientEntry);

        // 6. Record WalletTransfer Record
        WalletTransfer transfer = new WalletTransfer();
        transfer.setTransferReference(reference);
        transfer.setSender(sender);
        transfer.setRecipient(recipient);
        transfer.setSenderWallet(senderWallet);
        transfer.setRecipientWallet(recipientWallet);
        transfer.setAmount(amount);
        transfer.setFee(BigDecimal.ZERO);
        transfer.setTotalDebit(amount);
        transfer.setRecipientCredit(amount);
        transfer.setStatus("SUCCESS");
        transfer.setIdempotencyKey(idempotencyKey);
        transfer.setRemarks(request.remarks());
        transfer.setSenderWalletEntry(senderEntry);
        transfer.setRecipientWalletEntry(recipientEntry);
        transfer.setCompletedAt(Instant.now());
        walletTransferRepository.save(transfer);

        log.info("Wallet transfer committed successfully. Ref: {}, Sender: {}, Recipient: {}, Amount: ₹{}",
                reference, sender.getUsername(), recipient.getUsername(), amount);

        return toResponse(transfer, senderClosing);
    }

    @Override
    @Transactional(readOnly = true)
    public WalletTransferDtos.WalletTransferResponse getTransferDetails(String transferReference, UUID currentUserId) {
        WalletTransfer wt = walletTransferRepository.findByTransferReference(transferReference)
                .orElseThrow(() -> new IllegalArgumentException("Wallet transfer not found with reference " + transferReference));

        if (!wt.getSender().getId().equals(currentUserId) && !wt.getRecipient().getId().equals(currentUserId)) {
            User user = userRepository.findById(currentUserId).orElse(null);
            boolean isAdmin = user != null && user.getRoles().stream().anyMatch(r -> r.getName().name().equalsIgnoreCase("ADMIN"));
            if (!isAdmin) {
                throw new AccessDeniedException("You are not authorized to view this transaction");
            }
        }

        Wallet senderWallet = walletRepository.findByUserId(currentUserId).orElse(null);
        BigDecimal currentBal = senderWallet != null ? senderWallet.getBalance() : BigDecimal.ZERO;
        return toResponse(wt, currentBal);
    }

    @Override
    @Transactional(readOnly = true)
    public WalletTransferDtos.WalletTransferHistoryPageResponse getTransferHistory(
            UUID currentUserId,
            String direction,
            String status,
            String search,
            String startDate,
            String endDate,
            Pageable pageable
    ) {
        String dir = (direction != null && !direction.isBlank() && !direction.equalsIgnoreCase("ALL")) ? direction.toUpperCase() : null;
        String stat = (status != null && !status.isBlank() && !status.equalsIgnoreCase("ALL")) ? status.toUpperCase() : null;
        String searchPattern = (search != null && !search.isBlank()) ? "%" + search.toLowerCase().trim() + "%" : null;

        Instant start = null;
        Instant end = null;
        if (startDate != null && !startDate.isBlank()) {
            try {
                start = LocalDate.parse(startDate).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant();
            } catch (Exception e) {
                log.warn("Invalid start date: {}", startDate);
            }
        }
        if (endDate != null && !endDate.isBlank()) {
            try {
                end = LocalDate.parse(endDate).atTime(23, 59, 59).atZone(java.time.ZoneId.systemDefault()).toInstant();
            } catch (Exception e) {
                log.warn("Invalid end date: {}", endDate);
            }
        }

        final Instant filterStart = start;
        final Instant filterEnd = end;
        final String filterDir = dir;
        final String filterStat = stat;
        final String filterSearch = searchPattern;

        org.springframework.data.jpa.domain.Specification<WalletTransfer> spec = (root, query, cb) -> {
            java.util.List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();

            if (filterDir == null) {
                predicates.add(cb.or(
                        cb.equal(root.get("sender").get("id"), currentUserId),
                        cb.equal(root.get("recipient").get("id"), currentUserId)
                ));
            } else if ("SENT".equalsIgnoreCase(filterDir)) {
                predicates.add(cb.equal(root.get("sender").get("id"), currentUserId));
            } else if ("RECEIVED".equalsIgnoreCase(filterDir)) {
                predicates.add(cb.equal(root.get("recipient").get("id"), currentUserId));
            }

            if (filterStat != null) {
                predicates.add(cb.equal(cb.upper(root.get("status")), filterStat));
            }

            if (filterStart != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), filterStart));
            }
            if (filterEnd != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), filterEnd));
            }

            if (filterSearch != null) {
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("transferReference")), filterSearch),
                        cb.like(cb.lower(root.get("sender").get("fullName")), filterSearch),
                        cb.like(cb.lower(root.get("recipient").get("fullName")), filterSearch),
                        cb.like(cb.lower(root.get("sender").get("partyCode")), filterSearch),
                        cb.like(cb.lower(root.get("recipient").get("partyCode")), filterSearch),
                        cb.like(cb.lower(root.get("sender").get("mobile")), filterSearch),
                        cb.like(cb.lower(root.get("recipient").get("mobile")), filterSearch),
                        cb.like(cb.lower(cb.coalesce(root.get("remarks"), "")), filterSearch)
                ));
            }

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        Page<WalletTransfer> pageResult = walletTransferRepository.findAll(spec, pageable);

        List<WalletTransferDtos.WalletTransferHistoryItemDto> items = pageResult.getContent().stream()
                .map(wt -> {
                    boolean isSender = wt.getSender().getId().equals(currentUserId);
                    String transferDirection = isSender ? "SENT" : "RECEIVED";
                    return new WalletTransferDtos.WalletTransferHistoryItemDto(
                            wt.getId().toString(),
                            wt.getTransferReference(),
                            transferDirection,
                            wt.getSender().getId().toString(),
                            wt.getSender().getFullName(),
                            wt.getSender().getPartyCode() != null ? wt.getSender().getPartyCode() : "N/A",
                            wt.getSender().getMobile(),
                            wt.getRecipient().getId().toString(),
                            wt.getRecipient().getFullName(),
                            wt.getRecipient().getPartyCode() != null ? wt.getRecipient().getPartyCode() : "N/A",
                            wt.getRecipient().getMobile(),
                            getPrimaryRole(wt.getRecipient()),
                            wt.getAmount(),
                            wt.getFee(),
                            wt.getTotalDebit(),
                            wt.getRecipientCredit(),
                            wt.getStatus(),
                            wt.getRemarks(),
                            wt.getCreatedAt()
                    );
                })
                .toList();

        return new WalletTransferDtos.WalletTransferHistoryPageResponse(
                true,
                "Transfer history retrieved successfully",
                items,
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages()
        );
    }

    private WalletTransferDtos.WalletTransferResponse toResponse(WalletTransfer wt, BigDecimal currentSenderBalance) {
        return new WalletTransferDtos.WalletTransferResponse(
                wt.getTransferReference(),
                wt.getSender().getId().toString(),
                wt.getSender().getFullName(),
                wt.getSender().getPartyCode() != null ? wt.getSender().getPartyCode() : "N/A",
                wt.getRecipient().getId().toString(),
                wt.getRecipient().getFullName(),
                wt.getRecipient().getBusinessName() != null ? wt.getRecipient().getBusinessName() : wt.getRecipient().getFullName(),
                wt.getRecipient().getPartyCode() != null ? wt.getRecipient().getPartyCode() : "N/A",
                wt.getRecipient().getMobile(),
                getPrimaryRole(wt.getRecipient()),
                wt.getAmount(),
                wt.getFee(),
                wt.getTotalDebit(),
                wt.getRecipientCredit(),
                wt.getStatus(),
                wt.getRemarks(),
                wt.getCreatedAt(),
                currentSenderBalance
        );
    }
}
