-- Track who added a member via distributor / super-distributor network flows.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS added_by_user_ref VARCHAR(64),
    ADD COLUMN IF NOT EXISTS added_by_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS added_by_role VARCHAR(40),
    ADD COLUMN IF NOT EXISTS added_by_party_code VARCHAR(80);
