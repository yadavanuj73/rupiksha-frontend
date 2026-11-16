package com.rupiksha.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class TestUserCleanupService {

    private final JdbcTemplate jdbcTemplate;

    private static final List<String> QA_MOBILE_NUMBERS = List.of(
            "9000093813", "9000100024", "9000100023", "9000100022",
            "9000001972", "9000001971", "9000001952", "9000001936", "9000001933",
            "7000029765", "8000029744", "9000002201", "9000002200", "9000002271",
            "9000002270", "9000002180", "9000002175", "9000002174", "9000002173",
            "9000002172", "90000021628626", "9000002219", "9192090090", "9000002142",
            "9000002131", "9000001921", "9000001919"
    );

    @Transactional
    public Map<String, Object> cleanupTestUsers() {
        log.info("TestUserCleanupService: Starting scan for QA test accounts...");

        // 1. Identify Candidate QA Accounts
        String inSql = String.join("','", QA_MOBILE_NUMBERS);
        String candidateQuery = """
                SELECT id, username, mobile, full_name
                FROM users
                WHERE (
                    mobile IN ('%s')
                    OR (
                        (mobile LIKE '900000%%' OR mobile LIKE '900010%%')
                        AND (LOWER(full_name) LIKE 'qa%%' OR LOWER(username) LIKE 'qa%%')
                    )
                )
                AND username <> 'admin'
                AND (email IS NULL OR email NOT LIKE '%%@rupiksha.local')
                AND mobile <> '9999999999'
                """.formatted(inSql);

        List<Map<String, Object>> candidates;
        try {
            candidates = jdbcTemplate.queryForList(candidateQuery);
        } catch (Exception e) {
            log.error("Failed to query candidate QA accounts: {}", e.getMessage(), e);
            return Map.of("success", false, "error", e.getMessage(), "deletedCount", 0);
        }

        if (candidates.isEmpty()) {
            log.info("TestUserCleanupService: No QA test accounts found in database. 0 records to clean.");
            return Map.of("success", true, "foundCount", 0, "deletedCount", 0, "message", "No QA test accounts found.");
        }

        log.info("TestUserCleanupService: Found {} candidate QA test accounts.", candidates.size());

        // 2. Financial Safety Checks: Filter out any accounts with active balances or real transaction history
        List<UUID> safeToDeleteIds = new ArrayList<>();
        List<String> skippedReasons = new ArrayList<>();

        for (Map<String, Object> candidate : candidates) {
            UUID userId = (UUID) candidate.get("id");
            String username = (String) candidate.get("username");
            String mobile = (String) candidate.get("mobile");

            // Check wallet balance
            boolean hasNonZeroBalance = false;
            try {
                List<BigDecimal> balances = jdbcTemplate.query(
                        "SELECT balance FROM wallets WHERE user_id = ?",
                        (rs, rowNum) -> rs.getBigDecimal("balance"),
                        userId
                );
                for (BigDecimal bal : balances) {
                    if (bal != null && bal.compareTo(BigDecimal.ZERO) > 0) {
                        hasNonZeroBalance = true;
                        break;
                    }
                }
            } catch (Exception e) {
                log.warn("Could not check wallet balance for user {}: {}", userId, e.getMessage());
            }

            if (hasNonZeroBalance) {
                log.warn("SKIPPING deletion for test user {} ({}) - non-zero wallet balance detected!", username, mobile);
                skippedReasons.add(username + " (" + mobile + "): non-zero wallet balance");
                continue;
            }

            // Check successful real transactions
            boolean hasRealTxns = false;
            try {
                Integer count = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM transactions WHERE user_id = ? AND status = 'SUCCESS' AND amount > 0",
                        Integer.class,
                        userId
                );
                if (count != null && count > 0) {
                    hasRealTxns = true;
                }
            } catch (Exception e) {
                // Ignore if table doesn't exist
            }

            if (hasRealTxns) {
                log.warn("SKIPPING deletion for test user {} ({}) - successful financial transactions exist!", username, mobile);
                skippedReasons.add(username + " (" + mobile + "): active transactions exist");
                continue;
            }

            safeToDeleteIds.add(userId);
        }

        if (safeToDeleteIds.isEmpty()) {
            log.info("TestUserCleanupService: All {} candidates were skipped due to financial safeguards.", candidates.size());
            return Map.of("success", true, "foundCount", candidates.size(), "deletedCount", 0, "skippedCount", skippedReasons.size(), "reasons", skippedReasons);
        }

        log.info("TestUserCleanupService: Proceeding with safe deletion of {} QA test accounts.", safeToDeleteIds.size());

        // 3. Backup Before Deletion
        createBackups(safeToDeleteIds);

        // 4. Foreign Key and Related Data Cleanup
        cleanupForeignKeys(safeToDeleteIds);

        // 5. Final User Deletion
        int deletedCount = 0;
        try {
            // Delete users batch
            String idListSql = toUuidInClause(safeToDeleteIds);
            deletedCount = jdbcTemplate.update("DELETE FROM users WHERE id IN (" + idListSql + ")");
            log.info("TestUserCleanupService: Successfully DELETED {} QA test users from 'users' table.", deletedCount);
        } catch (Exception e) {
            log.error("TestUserCleanupService: Error deleting users: {}", e.getMessage(), e);
        }

        return Map.of(
                "success", true,
                "foundCount", candidates.size(),
                "deletedCount", deletedCount,
                "skippedCount", skippedReasons.size(),
                "skippedReasons", skippedReasons,
                "message", "Successfully cleaned up " + deletedCount + " QA test accounts."
        );
    }

    private void createBackups(List<UUID> userIds) {
        String idListSql = toUuidInClause(userIds);
        safeExecute("Create backup_test_users_20261116",
                "CREATE TABLE IF NOT EXISTS backup_test_users_20261116 AS SELECT * FROM users WHERE id IN (" + idListSql + ")");
        safeExecute("Insert any missing users to backup_test_users_20261116",
                "INSERT INTO backup_test_users_20261116 SELECT u.* FROM users u WHERE u.id IN (" + idListSql + ") AND u.id NOT IN (SELECT b.id FROM backup_test_users_20261116 b)");

        safeExecute("Create backup_test_wallets_20261116",
                "CREATE TABLE IF NOT EXISTS backup_test_wallets_20261116 AS SELECT * FROM wallets WHERE user_id IN (" + idListSql + ")");
        safeExecute("Insert missing wallets to backup_test_wallets_20261116",
                "INSERT INTO backup_test_wallets_20261116 SELECT w.* FROM wallets w WHERE w.user_id IN (" + idListSql + ") AND w.id NOT IN (SELECT b.id FROM backup_test_wallets_20261116 b)");

        safeExecute("Create backup_test_user_mappings_20261116",
                "CREATE TABLE IF NOT EXISTS backup_test_user_mappings_20261116 AS SELECT * FROM user_mappings WHERE user_id IN (" + idListSql + ")");
    }

    private void cleanupForeignKeys(List<UUID> userIds) {
        String idListSql = toUuidInClause(userIds);

        // 1. users parent reference
        safeExecute("Nullify parent_user_id on child users",
                "UPDATE users SET parent_user_id = NULL WHERE parent_user_id IN (" + idListSql + ")");

        // 2. user_mappings parent/admin references
        safeExecute("Nullify previous_parent_id in user_mappings",
                "UPDATE user_mappings SET previous_parent_id = NULL WHERE previous_parent_id IN (" + idListSql + ")");
        safeExecute("Nullify new_parent_id in user_mappings",
                "UPDATE user_mappings SET new_parent_id = NULL WHERE new_parent_id IN (" + idListSql + ")");
        safeExecute("Nullify mapped_by_admin_id in user_mappings",
                "UPDATE user_mappings SET mapped_by_admin_id = NULL WHERE mapped_by_admin_id IN (" + idListSql + ")");
        safeExecute("Delete test user records from user_mappings",
                "DELETE FROM user_mappings WHERE user_id IN (" + idListSql + ")");

        // 3. user_roles
        safeExecute("Delete user_roles",
                "DELETE FROM user_roles WHERE user_id IN (" + idListSql + ")");

        // 4. user_services
        safeExecute("Delete user_services",
                "DELETE FROM user_services WHERE user_id IN (" + idListSql + ")");

        // 5. Auth / Session records
        safeExecute("Delete refresh_tokens",
                "DELETE FROM refresh_tokens WHERE user_id IN (" + idListSql + ")");
        safeExecute("Delete otp_login_challenges",
                "DELETE FROM otp_login_challenges WHERE user_id IN (" + idListSql + ")");
        safeExecute("Delete certificates",
                "DELETE FROM certificates WHERE user_id IN (" + idListSql + ")");

        // 6. Support & Requests
        safeExecute("Delete tickets",
                "DELETE FROM tickets WHERE user_id IN (" + idListSql + ")");
        safeExecute("Nullify fund_requests approved_by",
                "UPDATE fund_requests SET approved_by = NULL WHERE approved_by IN (" + idListSql + ")");
        safeExecute("Delete fund_requests",
                "DELETE FROM fund_requests WHERE user_id IN (" + idListSql + ")");

        // 7. Wallets and Ledger
        safeExecute("Nullify wallet_entries operator_id",
                "UPDATE wallet_entries SET operator_id = NULL WHERE operator_id IN (" + idListSql + ")");
        safeExecute("Delete wallet_entries for test wallets",
                "DELETE FROM wallet_entries WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id IN (" + idListSql + "))");
        safeExecute("Delete wallets",
                "DELETE FROM wallets WHERE user_id IN (" + idListSql + ")");

        // 8. Transfers & Beneficiaries
        safeExecute("Delete payout_beneficiaries",
                "DELETE FROM payout_beneficiaries WHERE beneficiary_user_id IN (" + idListSql + ") OR retailer_user_id IN (" + idListSql + ")");
        safeExecute("Delete wallet_transfers",
                "DELETE FROM wallet_transfers WHERE sender_user_id IN (" + idListSql + ") OR recipient_user_id IN (" + idListSql + ")");

        // 9. Operational & Service Transactions
        safeExecute("Delete aeps_2fa_charge_txns",
                "DELETE FROM aeps_2fa_charge_txns WHERE user_id IN (" + idListSql + ")");
        safeExecute("Delete fingpay_transactions",
                "DELETE FROM fingpay_transactions WHERE user_id IN (" + idListSql + ")");
        safeExecute("Delete fingpay_2fa_transactions",
                "DELETE FROM fingpay_2fa_transactions WHERE user_id IN (" + idListSql + ")");
        safeExecute("Delete payout_transactions",
                "DELETE FROM payout_transactions WHERE user_id IN (" + idListSql + ")");
        safeExecute("Delete aeps_kyc_history",
                "DELETE FROM aeps_kyc_history WHERE user_id IN (" + idListSql + ")");
        safeExecute("Delete recharges",
                "DELETE FROM recharges WHERE user_id IN (" + idListSql + ")");
        safeExecute("Delete transactions",
                "DELETE FROM transactions WHERE user_id IN (" + idListSql + ")");

        // 10. Audit logs & Commission configs
        safeExecute("Nullify audit_logs operator_id",
                "UPDATE audit_logs SET operator_id = NULL WHERE operator_id IN (" + idListSql + ")");
        safeExecute("Delete audit_logs target_user_id",
                "DELETE FROM audit_logs WHERE target_user_id IN (" + idListSql + ")");
        safeExecute("Nullify bbps_commission_configs admin_user_id",
                "UPDATE bbps_commission_configs SET admin_user_id = NULL WHERE admin_user_id IN (" + idListSql + ")");
    }

    private void safeExecute(String stepDescription, String sql) {
        try {
            int rows = jdbcTemplate.update(sql);
            log.info("Cleanup step '{}': executed successfully ({} rows affected).", stepDescription, rows);
        } catch (Exception ex) {
            log.warn("Cleanup step '{}' skipped or completed with notice: {}", stepDescription, ex.getMessage());
        }
    }

    private String toUuidInClause(List<UUID> ids) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < ids.size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append("'").append(ids.get(i).toString()).append("'::uuid");
        }
        return sb.toString();
    }
}
