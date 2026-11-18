package com.rupiksha.backend.api;

import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.backend.domain.BbpsTransaction;
import com.rupiksha.backend.domain.KycStatus;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.UserStatus;
import com.rupiksha.backend.repository.BbpsTransactionRepository;
import com.rupiksha.backend.repository.CommissionTransactionRepository;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping({"/api/v1/dashboard", "/dashboard", "/api/v1/admin/dashboard", "/admin/dashboard"})
@RequiredArgsConstructor
@org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
public class DashboardController {

    private final PayoutTransactionRepository payoutTransactionRepository;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final BbpsTransactionRepository bbpsTransactionRepository;
    private final CommissionTransactionRepository commissionTransactionRepository;
    private final TxnRepository txnRepository;
    private final com.rupiksha.backend.service.HierarchyService hierarchyService;

    @GetMapping("/live")
    public ResponseEntity<Map<String, Object>> getLiveDashboard(
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.rupiksha.backend.security.JwtPrincipal principal) {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime todayEnd = LocalDate.now().atTime(LocalTime.MAX);
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime monthEnd = LocalDate.now().atTime(LocalTime.MAX);

        boolean isAdmin = hierarchyService.isAdmin(principal);
        java.util.Set<UUID> inScopeUserIds = null;
        if (!isAdmin && principal != null && principal.userId() != null) {
            UUID callerId = UUID.fromString(principal.userId());
            boolean isDistributorOrSuper = principal.roles() != null && principal.roles().stream()
                    .anyMatch(r -> "DISTRIBUTOR".equalsIgnoreCase(r) || "SUPER_DISTRIBUTOR".equalsIgnoreCase(r));
            if (isDistributorOrSuper) {
                inScopeUserIds = hierarchyService.getDownlineUserIds(callerId);
            } else {
                inScopeUserIds = java.util.Set.of(callerId);
            }
        }

        ZoneId istZone = ZoneId.of("Asia/Kolkata");
        ZonedDateTime nowIst = ZonedDateTime.now(istZone);
        Instant todayStartInstant = nowIst.toLocalDate().atStartOfDay(istZone).toInstant();
        Instant todayEndInstant = nowIst.toLocalDate().atTime(LocalTime.MAX).atZone(istZone).toInstant();
        Instant monthStartInstant = nowIst.toLocalDate().withDayOfMonth(1).atStartOfDay(istZone).toInstant();
        Instant monthEndInstant = todayEndInstant;

        // 1. Payout Live Aggregates
        long todayPayoutTxn = 0;
        BigDecimal todayPayoutAmt = BigDecimal.ZERO;
        long monthlyPayoutTxn = 0;
        BigDecimal monthlyPayoutAmt = BigDecimal.ZERO;

        try {
            List<Object[]> todayStats = payoutTransactionRepository.getAggregatedStats(todayStart, todayEnd);
            if (todayStats != null && !todayStats.isEmpty() && todayStats.get(0) != null) {
                Object[] row = todayStats.get(0);
                todayPayoutTxn = row[0] != null ? ((Number) row[0]).longValue() : 0;
                todayPayoutAmt = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            }

            List<Object[]> monthStats = payoutTransactionRepository.getAggregatedStats(monthStart, monthEnd);
            if (monthStats != null && !monthStats.isEmpty() && monthStats.get(0) != null) {
                Object[] row = monthStats.get(0);
                monthlyPayoutTxn = row[0] != null ? ((Number) row[0]).longValue() : 0;
                monthlyPayoutAmt = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            }
        } catch (Exception e) {
            log.warn("Failed to aggregate payout stats: {}", e.getMessage());
        }

        Map<String, Object> payoutMap = new HashMap<>();
        payoutMap.put("todayTxn", todayPayoutTxn);
        payoutMap.put("todayAmt", todayPayoutAmt.doubleValue());
        payoutMap.put("todayComm", 0.0);
        payoutMap.put("monthlyTxn", monthlyPayoutTxn);
        payoutMap.put("monthlyAmt", monthlyPayoutAmt.doubleValue());
        payoutMap.put("monthlyComm", 0.0);

        // 2. Bharat Connect (BBPS) Live Aggregates
        long todayBbpsTxn = 0;
        BigDecimal todayBbpsAmt = BigDecimal.ZERO;
        BigDecimal todayBbpsComm = BigDecimal.ZERO;
        long monthlyBbpsTxn = 0;
        BigDecimal monthlyBbpsAmt = BigDecimal.ZERO;
        BigDecimal monthlyBbpsComm = BigDecimal.ZERO;

        try {
            List<Object[]> todayBbpsStats = bbpsTransactionRepository.getAggregatedStats(todayStartInstant, todayEndInstant);
            if (todayBbpsStats != null && !todayBbpsStats.isEmpty() && todayBbpsStats.get(0) != null) {
                Object[] row = todayBbpsStats.get(0);
                todayBbpsTxn = row[0] != null ? ((Number) row[0]).longValue() : 0;
                todayBbpsAmt = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            }

            List<Object[]> monthBbpsStats = bbpsTransactionRepository.getAggregatedStats(monthStartInstant, monthEndInstant);
            if (monthBbpsStats != null && !monthBbpsStats.isEmpty() && monthBbpsStats.get(0) != null) {
                Object[] row = monthBbpsStats.get(0);
                monthlyBbpsTxn = row[0] != null ? ((Number) row[0]).longValue() : 0;
                monthlyBbpsAmt = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
            }

            // Complement from Txn table if any BBPS transactions were recorded there
            List<Object[]> todayTxnStats = txnRepository.getBbpsStats(todayStartInstant, todayEndInstant);
            if (todayTxnStats != null && !todayTxnStats.isEmpty() && todayTxnStats.get(0) != null) {
                Object[] row = todayTxnStats.get(0);
                long tCount = row[0] != null ? ((Number) row[0]).longValue() : 0;
                BigDecimal tAmt = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
                if (tCount > todayBbpsTxn) {
                    todayBbpsTxn = tCount;
                    todayBbpsAmt = tAmt;
                }
            }

            List<Object[]> monthTxnStats = txnRepository.getBbpsStats(monthStartInstant, monthEndInstant);
            if (monthTxnStats != null && !monthTxnStats.isEmpty() && monthTxnStats.get(0) != null) {
                Object[] row = monthTxnStats.get(0);
                long mCount = row[0] != null ? ((Number) row[0]).longValue() : 0;
                BigDecimal mAmt = row[1] != null ? (BigDecimal) row[1] : BigDecimal.ZERO;
                if (mCount > monthlyBbpsTxn) {
                    monthlyBbpsTxn = mCount;
                    monthlyBbpsAmt = mAmt;
                }
            }

            BigDecimal tComm = commissionTransactionRepository.sumBbpsCommissionByDateRange(todayStartInstant, todayEndInstant);
            if (tComm != null) todayBbpsComm = tComm;

            BigDecimal mComm = commissionTransactionRepository.sumBbpsCommissionByDateRange(monthStartInstant, monthEndInstant);
            if (mComm != null) monthlyBbpsComm = mComm;
        } catch (Exception e) {
            log.warn("Failed to aggregate BBPS / Bharat Connect stats: {}", e.getMessage());
        }

        Map<String, Object> bharatConnectMap = new HashMap<>();
        bharatConnectMap.put("todayTxn", todayBbpsTxn);
        bharatConnectMap.put("todayAmt", todayBbpsAmt.doubleValue());
        bharatConnectMap.put("todayComm", todayBbpsComm.doubleValue());
        bharatConnectMap.put("monthlyTxn", monthlyBbpsTxn);
        bharatConnectMap.put("monthlyAmt", monthlyBbpsAmt.doubleValue());
        bharatConnectMap.put("monthlyComm", monthlyBbpsComm.doubleValue());

        // 3. User Stats & Real Profile KYC Stats
        List<User> scopedUsers;
        if (inScopeUserIds != null) {
            final java.util.Set<UUID> filterIds = inScopeUserIds;
            scopedUsers = filterIds.isEmpty() ? Collections.emptyList() : userRepository.findAllById(filterIds);
        } else {
            scopedUsers = userRepository.findAll();
        }
        long totalUsers = scopedUsers.size();
        long activeUsers = scopedUsers.stream()
                .filter(u -> u.getStatus() == UserStatus.APPROVED || u.getStatus() == UserStatus.ACTIVE)
                .count();
        long pendingUsers = scopedUsers.stream()
                .filter(u -> u.getStatus() == UserStatus.PENDING)
                .count();
        long inactiveUsers = Math.max(0, totalUsers - activeUsers - pendingUsers);

        Map<String, Object> usersMap = Map.of(
                "total", totalUsers,
                "active", activeUsers,
                "pending", pendingUsers,
                "inactive", inactiveUsers
        );

        long kycDone = scopedUsers.stream()
                .filter(u -> u.getKycStatus() == KycStatus.APPROVED)
                .count();
        long kycPending = scopedUsers.stream()
                .filter(u -> u.getKycStatus() == KycStatus.PENDING)
                .count();
        long kycNotDone = Math.max(0, totalUsers - kycDone - kycPending);

        Map<String, Object> kycMap = Map.of(
                "done", kycDone,
                "notDone", kycNotDone,
                "pending", kycPending
        );

        // 4. Wallet Total Float
        BigDecimal totalFloat;
        if (inScopeUserIds != null) {
            totalFloat = walletRepository.findByUserIdIn(new ArrayList<>(inScopeUserIds)).stream()
                    .map(w -> w.getBalance() != null ? w.getBalance() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        } else {
            totalFloat = walletRepository.findAll().stream()
                    .map(w -> w.getBalance() != null ? w.getBalance() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        // 5. Recent Activity Feed (Include real BBPS transactions)
        List<Map<String, Object>> recentTransactions = new ArrayList<>();
        try {
            List<BbpsTransaction> recentBbps = bbpsTransactionRepository.findAll(
                    PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt"))
            ).getContent();
            for (BbpsTransaction b : recentBbps) {
                if (inScopeUserIds != null && (b.getUser() == null || !inScopeUserIds.contains(b.getUser().getId()))) {
                    continue;
                }
                Map<String, Object> m = new HashMap<>();
                m.put("id", b.getId() != null ? b.getId().toString() : UUID.randomUUID().toString());
                m.put("type", "BBPS " + (b.getCategory() != null ? b.getCategory() : "Bill Payment"));
                m.put("status", b.getStatus() != null ? b.getStatus() : "SUCCESS");
                m.put("amount", b.getAmount() != null ? b.getAmount().doubleValue() : 0.0);
                m.put("userName", b.getUser() != null ? (b.getUser().getFullName() != null ? b.getUser().getFullName() : b.getUser().getUsername()) : "Retailer");
                m.put("user_id", b.getUser() != null ? b.getUser().getId().toString() : "");
                m.put("operator", b.getBillerName() != null ? b.getBillerName() : b.getCategory());
                m.put("number", b.getConsumerNumber() != null ? b.getConsumerNumber() : (b.getMobileNumber() != null ? b.getMobileNumber() : ""));
                m.put("created_at", b.getCreatedAt() != null ? b.getCreatedAt().toString() : null);
                recentTransactions.add(m);
            }
        } catch (Exception e) {
            log.warn("Failed to load recent BBPS transactions for feed: {}", e.getMessage());
        }

        Map<String, Object> response = new HashMap<>();
        response.put("serverTime", LocalDateTime.now().toString());
        response.put("charges", 0.0);
        response.put("commission", todayBbpsComm.doubleValue());
        response.put("wallet", totalFloat.doubleValue());
        response.put("users", usersMap);
        response.put("kyc", kycMap);
        response.put("walletStats", Map.of("total", totalFloat.doubleValue(), "fundRequest", 0, "locked", 0));
        response.put("payout", payoutMap);
        response.put("aeps", Map.of("todayTxn", 0, "todayAmt", 0.0, "monthlyTxn", 0, "monthlyAmt", 0.0, "todayComm", 0.0, "monthlyComm", 0.0));
        response.put("cms", Map.of("todayTxn", 0, "todayAmt", 0.0, "monthlyTxn", 0, "monthlyAmt", 0.0, "todayComm", 0.0, "monthlyComm", 0.0));
        response.put("dmt", Map.of("todayTxn", 0, "todayAmt", 0.0, "monthlyTxn", 0, "monthlyAmt", 0.0, "todayComm", 0.0, "monthlyComm", 0.0));
        response.put("bharatConnect", bharatConnectMap);
        response.put("otherService", Map.of("todayTxn", 0, "todayAmt", 0.0, "monthlyTxn", 0, "monthlyAmt", 0.0, "todayComm", 0.0, "monthlyComm", 0.0));
        response.put("recentTransactions", recentTransactions);

        return ResponseEntity.ok(response);
    }
}