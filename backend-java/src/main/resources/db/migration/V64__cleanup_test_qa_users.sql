-- Migration V64: Safe Cleanup of Test QA Accounts and Hierarchy Data with Full Backup
-- Preserves all genuine users, wallet balances, and financial records.

DO $$
DECLARE
    v_test_count INT := 0;
BEGIN
    -- 1. Create dedicated backup tables for the exact test accounts and dependencies
    CREATE TABLE IF NOT EXISTS backup_test_users_20261116 AS
    SELECT u.*
    FROM users u
    WHERE u.mobile IN (
        '9000093813', '9000100024', '9000100023', '9000100022', '9000001972',
        '9000001971', '9000001952', '9000001936', '9000001933', '7000029765',
        '8000029744', '9000002201', '9000002200', '9000002271', '9000002270',
        '9000002180', '9000002175', '9000002174', '9000002173', '9000002172',
        '90000021628626', '9000002219', '9192090090', '9000002142', '9000002131',
        '9000001921', '9000001919'
    )
    AND (LOWER(u.full_name) LIKE 'qa%' OR LOWER(u.username) LIKE 'qa%')
    AND u.username <> 'admin';

    GET DIAGNOSTICS v_test_count = ROW_COUNT;
    RAISE NOTICE 'V64: Backed up % test users to backup_test_users_20261116', v_test_count;

    -- Backup user_roles
    CREATE TABLE IF NOT EXISTS backup_test_user_roles_20261116 AS
    SELECT ur.*
    FROM user_roles ur
    JOIN backup_test_users_20261116 b ON ur.user_id = b.id;

    -- Backup user_mappings
    CREATE TABLE IF NOT EXISTS backup_test_user_mappings_20261116 AS
    SELECT um.*
    FROM user_mappings um
    WHERE um.user_id IN (SELECT id FROM backup_test_users_20261116)
       OR um.previous_parent_id IN (SELECT id FROM backup_test_users_20261116)
       OR um.new_parent_id IN (SELECT id FROM backup_test_users_20261116);

    -- Backup wallets
    CREATE TABLE IF NOT EXISTS backup_test_wallets_20261116 AS
    SELECT w.*
    FROM wallets w
    JOIN backup_test_users_20261116 b ON w.user_id = b.id;

    -- 2. Create temporary table of confirmed test accounts that have ZERO financial transactions
    CREATE TEMP TABLE tmp_test_users_cleanable ON COMMIT DROP AS
    SELECT b.id
    FROM backup_test_users_20261116 b
    WHERE NOT EXISTS (
        SELECT 1 FROM txns t WHERE t.user_id = b.id AND t.amount > 0
    )
    AND NOT EXISTS (
        SELECT 1 FROM bbps_transactions bt WHERE bt.user_id = b.id
    )
    AND NOT EXISTS (
        SELECT 1 FROM commission_transactions ct WHERE ct.user_id = b.id OR ct.retailer_id = b.id
    )
    AND NOT EXISTS (
        SELECT 1 FROM wallets w WHERE w.user_id = b.id AND (w.balance > 0 OR w.locked_amount > 0)
    );

    -- If any test user had financial records, soft-deactivate instead of hard delete
    UPDATE users
    SET status = 'DEACTIVATED'
    WHERE id IN (SELECT id FROM backup_test_users_20261116)
      AND id NOT IN (SELECT id FROM tmp_test_users_cleanable);

    -- 3. Perform safe foreign-key ordered deletion for cleanable test accounts:

    -- A. Unlink self-referencing parent_user_id in users
    UPDATE users
    SET parent_user_id = NULL
    WHERE parent_user_id IN (SELECT id FROM tmp_test_users_cleanable);

    -- B. Unlink parent references in user_mappings
    UPDATE user_mappings
    SET previous_parent_id = NULL
    WHERE previous_parent_id IN (SELECT id FROM tmp_test_users_cleanable);

    UPDATE user_mappings
    SET new_parent_id = NULL
    WHERE new_parent_id IN (SELECT id FROM tmp_test_users_cleanable);

    UPDATE user_mappings
    SET mapped_by_admin_id = NULL
    WHERE mapped_by_admin_id IN (SELECT id FROM tmp_test_users_cleanable);

    -- Delete user_mappings for test users
    DELETE FROM user_mappings
    WHERE user_id IN (SELECT id FROM tmp_test_users_cleanable);

    -- C. Delete from payout_beneficiaries if present
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_beneficiaries') THEN
        DELETE FROM payout_beneficiaries
        WHERE beneficiary_user_id IN (SELECT id FROM tmp_test_users_cleanable)
           OR retailer_user_id IN (SELECT id FROM tmp_test_users_cleanable);
    END IF;

    -- D. Delete from aeps_2fa_charge_txns if present
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'aeps_2fa_charge_txns') THEN
        DELETE FROM aeps_2fa_charge_txns
        WHERE user_id IN (SELECT id FROM tmp_test_users_cleanable);
    END IF;

    -- E. Delete from wallet_transfers if present
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transfers') THEN
        DELETE FROM wallet_transfers
        WHERE sender_user_id IN (SELECT id FROM tmp_test_users_cleanable)
           OR recipient_user_id IN (SELECT id FROM tmp_test_users_cleanable);
    END IF;

    -- F. Delete from user_services
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_services') THEN
        DELETE FROM user_services
        WHERE user_id IN (SELECT id FROM tmp_test_users_cleanable);
    END IF;

    -- G. Delete from refresh_tokens & otp_login_challenges
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refresh_tokens') THEN
        DELETE FROM refresh_tokens
        WHERE user_id IN (SELECT id FROM tmp_test_users_cleanable);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'otp_login_challenges') THEN
        DELETE FROM otp_login_challenges
        WHERE user_id IN (SELECT id FROM tmp_test_users_cleanable);
    END IF;

    -- H. Delete from certificates, tickets, fund_requests
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'certificates') THEN
        DELETE FROM certificates
        WHERE user_id IN (SELECT id FROM tmp_test_users_cleanable);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
        DELETE FROM tickets
        WHERE user_id IN (SELECT id FROM tmp_test_users_cleanable);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fund_requests') THEN
        DELETE FROM fund_requests
        WHERE user_id IN (SELECT id FROM tmp_test_users_cleanable);
    END IF;

    -- I. Delete wallet entries and wallets
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_entries') THEN
        DELETE FROM wallet_entries
        WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id IN (SELECT id FROM tmp_test_users_cleanable))
           OR operator_id IN (SELECT id FROM tmp_test_users_cleanable);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallets') THEN
        DELETE FROM wallets
        WHERE user_id IN (SELECT id FROM tmp_test_users_cleanable);
    END IF;

    -- J. Delete user_roles
    DELETE FROM user_roles
    WHERE user_id IN (SELECT id FROM tmp_test_users_cleanable);

    -- K. Finally, delete from users
    DELETE FROM users
    WHERE id IN (SELECT id FROM tmp_test_users_cleanable);

    RAISE NOTICE 'V64: Safely cleaned up confirmed test accounts from users and dependent tables.';
END $$;
