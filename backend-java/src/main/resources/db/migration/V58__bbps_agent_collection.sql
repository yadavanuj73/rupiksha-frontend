-- Migration V58: BBPS Agent Collection Extensions
-- Adds Agent Collection specific identifier columns to the shared bbps_transactions table.
-- Per BillAvenue API doc Version 2.8.7 (Bharat Connect Agent Collection specification):
--   - Agent Code / Collector ID / Employee ID / Cashier ID is the primary customer parameter.
--   - Collection Reference / Center ID / Group Code / Branch Code is the secondary parameter.
--   - Agent Name captures field collection executive name.
--   - Agent Collection has a CMS cooling period of 24 hours (Page 56).
-- Reuses all existing shared columns: amount, status, biller_id, biller_name, customer_name,
--   mobile_number, bill_number, bill_date, due_date, bill_period, convenience_fee, fetch_request_id,
--   consumer_number, customer_params, additional_info, payment_mode, payment_channel, etc.

ALTER TABLE bbps_transactions
    ADD COLUMN IF NOT EXISTS agent_code      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS collection_ref  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS agent_name      VARCHAR(150);

-- Partial index: search Agent Collection transactions by agent code / collector ID
CREATE INDEX IF NOT EXISTS idx_bbps_agent_code
    ON bbps_transactions(agent_code)
    WHERE agent_code IS NOT NULL;

-- Partial index: search Agent Collection transactions by collection reference
CREATE INDEX IF NOT EXISTS idx_bbps_collection_ref
    ON bbps_transactions(collection_ref)
    WHERE collection_ref IS NOT NULL;

-- Index for Agent Collection category filtering in history
CREATE INDEX IF NOT EXISTS idx_bbps_agent_collection_category
    ON bbps_transactions(category)
    WHERE category = 'Agent Collection';

