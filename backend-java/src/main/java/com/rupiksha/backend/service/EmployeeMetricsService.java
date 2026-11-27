package com.rupiksha.backend.service;

import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.repository.AepsTransactionEngineRepository;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class EmployeeMetricsService {

    public static final String CAT_AEPS = "AEPS";
    public static final String CAT_RECHARGE = "RECHARGE";
    public static final String CAT_BBPS = "BBPS";
    public static final String CAT_PAYOUT = "PAYOUT";
    public static final String CAT_WALLET = "WALLET";
    public static final String CAT_OTHER = "OTHER";

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ISO_LOCAL_DATE;

    private final AepsTransactionEngineRepository aepsRepository;
    private final PayoutTransactionRepository payoutRepository;
    private final RechargeRepository rechargeRepository;
    private final BbpsTransactionRepository bbpsRepository;
    private final WalletTransferRepository walletTransferRepository;
    private final TxnRepository txnRepository;

    public record MetricsResult(
            long totalTransactions,
            long successTransactions,
            long failedTransactions,
            long pendingTransactions,
            BigDecimal totalVolume,
            List<EmployeeDtos.ServiceBreakdownItem> serviceBreakdown,
            List<EmployeeDtos.DateTrendPoint> dailyTrend,
            List<EmployeeDtos.ScopedTransactionItem> transactions
    ) {}

    @Transactional(readOnly = true)
    public MetricsResult computeMetrics(
            Map<UUID, User> scopedUsers,
            Set<String> allowedCategories,
            Instant startInstant,
            Instant endInstant,
            String categoryFilter,
            String statusFilter,
            String searchFilter
    ) {
        if (scopedUsers == null || scopedUsers.isEmpty()) {
            return emptyResult();
        }

        boolean allowAll = allowedCategories == null;
        String reqCat = categoryFilter == null || categoryFilter.isBlank()
                ? "ALL" : categoryFilter.trim().toUpperCase(Locale.ROOT);
        String reqStatus = statusFilter == null || statusFilter.isBlank()
                ? null : statusFilter.trim().toUpperCase(Locale.ROOT);
        String cleanSearch = searchFilter == null || searchFilter.isBlank()
                ? null : searchFilter.trim().toLowerCase(Locale.ROOT);

        List<EmployeeDtos.ScopedTransactionItem> collected = new ArrayList<>();
        Set<UUID> bbpsLinkedTxnIds = new HashSet<>();

        // 1. AEPS
        if (("ALL".equals(reqCat) || CAT_AEPS.equals(reqCat)) && (allowAll || allowedCategories.contains(CAT_AEPS))) {
            for (AepsTransactionEngine t : aepsRepository.findAll()) {
                if (t.getUserId() == null || !scopedUsers.containsKey(t.getUserId())) continue;
                Instant created = toInstant(t.getInitiatedAt());
                if (!withinDateRange(created, startInstant, endInstant)) continue;
                User u = scopedUsers.get(t.getUserId());
                EmployeeDtos.ScopedTransactionItem item = buildItem(
                        t.getTransactionId(),
                        t.getReferenceNumber(),
                        t.getServiceType() != null ? t.getServiceType() : "AEPS",
                        CAT_AEPS,
                        t.getAmount(),
                        normalizeStatus(t.getStatus()),
                        u,
                        t.getProvider(),
                        t.getProviderMessage(),
                        created
                );
                collected.add(item);
            }
        }

        // 2. PAYOUT
        if (("ALL".equals(reqCat) || CAT_PAYOUT.equals(reqCat)) && (allowAll || allowedCategories.contains(CAT_PAYOUT))) {
            for (PayoutTransaction p : payoutRepository.findAll()) {
                UUID uId = tryParseUuid(p.getUserId());
                if (uId == null || !scopedUsers.containsKey(uId)) continue;
                Instant created = toInstant(p.getCreatedAt());
                if (!withinDateRange(created, startInstant, endInstant)) continue;
                User u = scopedUsers.get(uId);
                collected.add(buildItem(
                        p.getOrderId(),
                        p.getUtr() != null ? p.getUtr() : p.getOrderId(),
                        "PAYOUT (" + (p.getTransferMode() != null ? p.getTransferMode() : "IMPS") + ")",
                        CAT_PAYOUT,
                        p.getAmount(),
                        normalizeStatus(p.getStatus()),
                        u,
                        maskTail(p.getAccountNumber()),
                        p.getResponseMessage() != null ? p.getResponseMessage() : p.getBeneficiaryName(),
                        created
                ));
            }
        }

        // 3. RECHARGE
        if (("ALL".equals(reqCat) || CAT_RECHARGE.equals(reqCat)) && (allowAll || allowedCategories.contains(CAT_RECHARGE))) {
            for (Recharge r : rechargeRepository.findAll()) {
                User u = r.getUser();
                if (u == null || !scopedUsers.containsKey(u.getId())) continue;
                Instant created = r.getCreatedAt();
                if (!withinDateRange(created, startInstant, endInstant)) continue;
                collected.add(buildItem(
                        r.getMerchantRefNo(),
                        r.getOperatorTxnId() != null ? r.getOperatorTxnId() : r.getMerchantRefNo(),
                        "DH".equalsIgnoreCase(r.getServiceType()) ? "DTH RECHARGE" : "MOBILE RECHARGE",
                        CAT_RECHARGE,
                        r.getAmount(),
                        normalizeStatus(r.getStatus() != null ? r.getStatus().name() : null),
                        scopedUsers.get(u.getId()),
                        r.getMobileNo(),
                        r.getDescription() != null ? r.getDescription() : r.getOperatorCode(),
                        created
                ));
            }
        }

        // 4. BBPS
        List<BbpsTransaction> allBbps = bbpsRepository.findAll();
        for (BbpsTransaction b : allBbps) {
            if (b.getTxn() != null && b.getTxn().getId() != null) {
                bbpsLinkedTxnIds.add(b.getTxn().getId());
            }
            if (!("ALL".equals(reqCat) || CAT_BBPS.equals(reqCat))) continue;
            if (!(allowAll || allowedCategories.contains(CAT_BBPS))) continue;
            User u = b.getUser();
            if (u == null || !scopedUsers.containsKey(u.getId())) continue;
            Instant created = b.getCreatedAt();
            if (!withinDateRange(created, startInstant, endInstant)) continue;
            collected.add(buildItem(
                    b.getMerchantRefNo(),
                    b.getProviderTxnId() != null ? b.getProviderTxnId() : b.getRequestId(),
                    b.getCategory() != null ? b.getCategory() : "BBPS",
                    CAT_BBPS,
                    b.getAmount(),
                    normalizeStatus(b.getStatus()),
                    scopedUsers.get(u.getId()),
                    b.getMobileNumber(),
                    b.getBillerName(),
                    created
            ));
        }

        // 5. WALLET
        if (("ALL".equals(reqCat) || CAT_WALLET.equals(reqCat)) && (allowAll || allowedCategories.contains(CAT_WALLET))) {
            for (WalletTransfer wt : walletTransferRepository.findAll()) {
                UUID senderId = wt.getSender() != null ? wt.getSender().getId() : null;
                UUID recipientId = wt.getRecipient() != null ? wt.getRecipient().getId() : null;
                User actingUser = null;
                if (senderId != null && scopedUsers.containsKey(senderId)) {
                    actingUser = scopedUsers.get(senderId);
                } else if (recipientId != null && scopedUsers.containsKey(recipientId)) {
                    actingUser = scopedUsers.get(recipientId);
                }
                if (actingUser == null) continue;
                Instant created = wt.getCreatedAt();
                if (!withinDateRange(created, startInstant, endInstant)) continue;
                String recipientLabel = null;
                if (recipientId != null) {
                    User knownRecipient = scopedUsers.get(recipientId);
                    recipientLabel = knownRecipient != null
                            ? knownRecipient.getUsername()
                            : wt.getRecipient().getUsername();
                }
                collected.add(buildItem(
                        wt.getTransferReference(),
                        wt.getTransferReference(),
                        "WALLET_TRANSFER",
                        CAT_WALLET,
                        wt.getAmount(),
                        normalizeStatus(wt.getStatus()),
                        actingUser,
                        recipientLabel,
                        wt.getRemarks(),
                        created
                ));
            }
        }

        // 6. GENERIC TXN TABLE (avoid double counting BBPS rows linked via txn_id)
        for (Txn t : txnRepository.findAll()) {
            if (t.getId() != null && bbpsLinkedTxnIds.contains(t.getId())) continue;
            User u = t.getUser();
            if (u == null || !scopedUsers.containsKey(u.getId())) continue;
            Instant created = t.getCreatedAt();
            if (!withinDateRange(created, startInstant, endInstant)) continue;
            String cat = mapTxnCategory(t.getServiceType());
            if (!("ALL".equals(reqCat) || cat.equals(reqCat))) continue;
            if (!(allowAll || allowedCategories.contains(cat))) continue;
            collected.add(buildItem(
                    t.getId().toString(),
                    t.getProviderRef() != null ? t.getProviderRef() : t.getId().toString(),
                    t.getServiceType(),
                    cat,
                    t.getAmount(),
                    normalizeStatus(t.getStatus() != null ? t.getStatus().name() : null),
                    scopedUsers.get(u.getId()),
                    t.getProviderRef(),
                    t.getServiceType(),
                    created
            ));
        }

        // Apply status and search filters uniformly
        List<EmployeeDtos.ScopedTransactionItem> filtered = collected.stream()
                .filter(item -> reqStatus == null || "ALL".equals(reqStatus) || item.status().equalsIgnoreCase(reqStatus))
                .filter(item -> matchesSearch(item, cleanSearch))
                .sorted(Comparator.comparing(EmployeeDtos.ScopedTransactionItem::createdAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        return aggregateItems(filtered, scopedUsers.values(), startInstant, endInstant);
    }

    @Transactional(readOnly = true)
    public Optional<EmployeeDtos.ScopedTransactionItem> findSingleTransactionInScope(
            String transactionId,
            Map<UUID, User> scopedUsers,
            Set<String> allowedCategories
    ) {
        if (transactionId == null || transactionId.isBlank() || scopedUsers == null || scopedUsers.isEmpty()) {
            return Optional.empty();
        }
        MetricsResult all = computeMetrics(scopedUsers, allowedCategories, null, null, "ALL", null, null);
        String target = transactionId.trim();
        return all.transactions().stream()
                .filter(item -> target.equalsIgnoreCase(item.id()) || target.equalsIgnoreCase(item.referenceNo()))
                .findFirst();
    }

    private MetricsResult aggregateItems(
            List<EmployeeDtos.ScopedTransactionItem> items,
            Collection<User> scopedUsers,
            Instant startInstant,
            Instant endInstant
    ) {
        long success = 0;
        long failed = 0;
        long pending = 0;
        BigDecimal volume = BigDecimal.ZERO;

        Map<String, long[]> catCounts = new LinkedHashMap<>();
        Map<String, BigDecimal> catVolume = new LinkedHashMap<>();
        Map<String, long[]> dailyCounts = new TreeMap<>();
        Map<String, BigDecimal> dailyVolume = new TreeMap<>();
        Map<String, Long> dailyOnboarded = new TreeMap<>();

        for (User u : scopedUsers) {
            if (u.getCreatedAt() != null && withinDateRange(u.getCreatedAt(), startInstant, endInstant)) {
                String d = DATE_FMT.format(u.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDate());
                dailyOnboarded.merge(d, 1L, Long::sum);
                dailyCounts.putIfAbsent(d, new long[4]);
                dailyVolume.putIfAbsent(d, BigDecimal.ZERO);
            }
        }

        for (EmployeeDtos.ScopedTransactionItem item : items) {
            BigDecimal amt = item.amount() != null ? item.amount() : BigDecimal.ZERO;
            String st = item.status();
            boolean isSuccess = "SUCCESS".equals(st);
            boolean isPending = "PENDING".equals(st);

            if (isSuccess) {
                success++;
                volume = volume.add(amt);
            } else if (isPending) {
                pending++;
            } else {
                failed++;
            }

            long[] cArr = catCounts.computeIfAbsent(item.category(), k -> new long[4]);
            cArr[0]++;
            if (isSuccess) {
                cArr[1]++;
                catVolume.merge(item.category(), amt, BigDecimal::add);
            } else if (isPending) {
                cArr[3]++;
            } else {
                cArr[2]++;
            }

            if (item.createdAt() != null) {
                String day = DATE_FMT.format(item.createdAt().atZone(ZoneId.systemDefault()).toLocalDate());
                long[] dArr = dailyCounts.computeIfAbsent(day, k -> new long[4]);
                dArr[0]++;
                if (isSuccess) {
                    dArr[1]++;
                    dailyVolume.merge(day, amt, BigDecimal::add);
                } else if (isPending) {
                    dArr[3]++;
                } else {
                    dArr[2]++;
                }
            }
        }

        List<EmployeeDtos.ServiceBreakdownItem> breakdown = catCounts.entrySet().stream()
                .map(e -> {
                    long[] arr = e.getValue();
                    return new EmployeeDtos.ServiceBreakdownItem(
                            e.getKey(), arr[0], arr[1], arr[2], arr[3],
                            catVolume.getOrDefault(e.getKey(), BigDecimal.ZERO)
                    );
                })
                .toList();

        List<EmployeeDtos.DateTrendPoint> trend = dailyCounts.entrySet().stream()
                .map(e -> {
                    long[] arr = e.getValue();
                    return new EmployeeDtos.DateTrendPoint(
                            e.getKey(), arr[0], arr[1], arr[2], arr[3],
                            dailyVolume.getOrDefault(e.getKey(), BigDecimal.ZERO),
                            dailyOnboarded.getOrDefault(e.getKey(), 0L)
                    );
                })
                .toList();

        return new MetricsResult(items.size(), success, failed, pending, volume, breakdown, trend, items);
    }

    private MetricsResult emptyResult() {
        return new MetricsResult(0, 0, 0, 0, BigDecimal.ZERO, List.of(), List.of(), List.of());
    }

    private EmployeeDtos.ScopedTransactionItem buildItem(
            String id,
            String ref,
            String serviceType,
            String category,
            BigDecimal amount,
            String status,
            User user,
            String target,
            String remarks,
            Instant createdAt
    ) {
        String role = user != null && user.getRoles() != null && !user.getRoles().isEmpty()
                ? user.getRoles().iterator().next().getName().name() : "RETAILER";
        String state = user != null ? firstNonBlank(user.getStateName(), user.getShopState(), user.getPermState()) : null;
        String city = user != null ? firstNonBlank(user.getCity(), user.getShopCity(), user.getShopDistrict()) : null;
        return new EmployeeDtos.ScopedTransactionItem(
                id,
                ref,
                serviceType,
                category,
                amount != null ? amount : BigDecimal.ZERO,
                status,
                user != null ? user.getId().toString() : null,
                user != null ? (user.getFullName() != null ? user.getFullName() : user.getUsername()) : "N/A",
                user != null ? user.getPartyCode() : null,
                role,
                state,
                city,
                user != null ? user.getZoneName() : null,
                target,
                remarks,
                createdAt
        );
    }

    private String mapTxnCategory(String serviceType) {
        if (serviceType == null) return CAT_OTHER;
        String upper = serviceType.trim().toUpperCase(Locale.ROOT);
        if (upper.contains("AEPS") || upper.contains("MATM")) return CAT_AEPS;
        if (upper.contains("RECHARGE") || "MR".equals(upper) || "DH".equals(upper)) return CAT_RECHARGE;
        if (upper.contains("BBPS") || upper.contains("CREDIT_CARD") || upper.contains("BILL")) return CAT_BBPS;
        if (upper.contains("PAYOUT") || upper.contains("DMT") || upper.contains("MOVE_TO_BANK")) return CAT_PAYOUT;
        if (upper.contains("WALLET")) return CAT_WALLET;
        return CAT_OTHER;
    }

    private String normalizeStatus(String raw) {
        if (raw == null || raw.isBlank()) return "PENDING";
        String u = raw.trim().toUpperCase(Locale.ROOT);
        if ("SUCCESS".equals(u) || "COMPLETED".equals(u) || "APPROVED".equals(u) || "SETTLED".equals(u)) {
            return "SUCCESS";
        }
        if ("PENDING".equals(u) || "INITIATED".equals(u) || "PROCESSING".equals(u) || "IN_PROGRESS".equals(u)) {
            return "PENDING";
        }
        return "FAILED";
    }

    private boolean withinDateRange(Instant created, Instant start, Instant end) {
        if (created == null) return false;
        if (start != null && created.isBefore(start)) return false;
        if (end != null && created.isAfter(end)) return false;
        return true;
    }

    private boolean matchesSearch(EmployeeDtos.ScopedTransactionItem item, String cleanSearch) {
        if (cleanSearch == null) return true;
        return contains(item.id(), cleanSearch)
                || contains(item.referenceNo(), cleanSearch)
                || contains(item.userName(), cleanSearch)
                || contains(item.userPartyCode(), cleanSearch)
                || contains(item.serviceType(), cleanSearch)
                || contains(item.targetAccountOrMobile(), cleanSearch);
    }

    private boolean contains(String val, String search) {
        return val != null && val.toLowerCase(Locale.ROOT).contains(search);
    }

    private Instant toInstant(LocalDateTime ldt) {
        return ldt == null ? null : ldt.atZone(ZoneId.systemDefault()).toInstant();
    }

    private UUID tryParseUuid(String s) {
        try {
            return s == null ? null : UUID.fromString(s.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private String firstNonBlank(String... vals) {
        for (String v : vals) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private String maskTail(String value) {
        if (value == null || value.length() <= 4) return value;
        return "XXXX" + value.substring(value.length() - 4);
    }

    public static Instant parseFromInstant(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            LocalDate d = LocalDate.parse(raw.trim().substring(0, 10));
            return d.atStartOfDay(ZoneId.systemDefault()).toInstant();
        } catch (Exception e) {
            return null;
        }
    }

    public static Instant parseToInstant(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            LocalDate d = LocalDate.parse(raw.trim().substring(0, 10));
            return d.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().minusMillis(1);
        } catch (Exception e) {
            return null;
        }
    }
}
