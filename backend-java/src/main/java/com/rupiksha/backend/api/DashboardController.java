package com.rupiksha.backend.api;

import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.backend.domain.UserStatus;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping({"/api/v1/dashboard", "/dashboard", "/api/v1/admin/dashboard", "/admin/dashboard"})
@RequiredArgsConstructor
public class DashboardController {

    private final PayoutTransactionRepository payoutTransactionRepository;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;

    @GetMapping("/live")
    public ResponseEntity<Map<String, Object>> getLiveDashboard() {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime todayEnd = LocalDate.now().atTime(LocalTime.MAX);
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime monthEnd = LocalDate.now().atTime(LocalTime.MAX);

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

        // 2. User Stats
        long totalUsers = userRepository.count();
        long activeUsers = userRepository.findAll().stream().filter(u -> u.getStatus() == UserStatus.APPROVED).count();
        long pendingUsers = userRepository.findAll().stream().filter(u -> u.getStatus() == UserStatus.PENDING).count();
        long inactiveUsers = totalUsers - activeUsers - pendingUsers;

        Map<String, Object> usersMap = Map.of(
                "total", totalUsers,
                "active", activeUsers,
                "pending", pendingUsers,
                "inactive", Math.max(0, inactiveUsers)
        );

        // 3. Wallet Total Float
        BigDecimal totalFloat = walletRepository.findAll().stream()
                .map(w -> w.getBalance() != null ? w.getBalance() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> response = new HashMap<>();
        response.put("serverTime", LocalDateTime.now().toString());
        response.put("charges", 0.0);
        response.put("commission", 0.0);
        response.put("wallet", totalFloat.doubleValue());
        response.put("users", usersMap);
        response.put("kyc", Map.of("done", activeUsers, "notDone", inactiveUsers, "pending", pendingUsers));
        response.put("walletStats", Map.of("total", totalFloat.doubleValue(), "fundRequest", 0, "locked", 0));
        response.put("payout", payoutMap);
        response.put("aeps", Map.of("todayTxn", 0, "todayAmt", 0.0, "monthlyTxn", 0, "monthlyAmt", 0.0, "todayComm", 0.0, "monthlyComm", 0.0));
        response.put("cms", Map.of("todayTxn", 0, "todayAmt", 0.0, "monthlyTxn", 0, "monthlyAmt", 0.0, "todayComm", 0.0, "monthlyComm", 0.0));
        response.put("dmt", Map.of("todayTxn", 0, "todayAmt", 0.0, "monthlyTxn", 0, "monthlyAmt", 0.0, "todayComm", 0.0, "monthlyComm", 0.0));
        response.put("bharatConnect", Map.of("todayTxn", 0, "todayAmt", 0.0, "monthlyTxn", 0, "monthlyAmt", 0.0, "todayComm", 0.0, "monthlyComm", 0.0));
        response.put("otherService", Map.of("todayTxn", 0, "todayAmt", 0.0, "monthlyTxn", 0, "monthlyAmt", 0.0, "todayComm", 0.0, "monthlyComm", 0.0));
        response.put("recentTransactions", List.of());

        return ResponseEntity.ok(response);
    }
}
