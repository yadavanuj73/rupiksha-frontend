-- Migration V56: BBPS FASTag Bill Payment Extensions
-- Adds FASTag-specific vehicle and tag identification columns to the shared bbps_transactions table.
-- Per BillAvenue API doc (Bharat Connect FASTag NETC specification):
--   - Vehicle Registration Number (VRN) is the primary customer parameter.
--   - Payment modes supported via AGT channel: Cash (with Cash Payment account info).
--   - Fastag transactions have cooling period of 0 hours for CMS complaints.
-- Reuses all existing shared columns: amount, status, biller_id, customer_name, mobile_number,
--   bill_number, bill_date, due_date, bill_period, convenience_fee, fetch_request_id,
--   consumer_number, customer_params, additional_info, payment_mode, payment_channel, etc.

ALTER TABLE bbps_transactions
    ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(30),
    ADD COLUMN IF NOT EXISTS fastag_tag_id  VARCHAR(50),
    ADD COLUMN IF NOT EXISTS chassis_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS vehicle_type   VARCHAR(50);

-- Partial index: search FASTag transactions by vehicle registration number
CREATE INDEX IF NOT EXISTS idx_bbps_vehicle_number
    ON bbps_transactions(vehicle_number)
    WHERE vehicle_number IS NOT NULL;

-- Partial index: search FASTag transactions by FASTag tag id
CREATE INDEX IF NOT EXISTS idx_bbps_fastag_tag_id
    ON bbps_transactions(fastag_tag_id)
    WHERE fastag_tag_id IS NOT NULL;

-- Index for FASTag category filtering in history
CREATE INDEX IF NOT EXISTS idx_bbps_fastag_category
    ON bbps_transactions(category)
    WHERE category = 'FASTag';

-- Index for biller lookups if not exists
CREATE INDEX IF NOT EXISTS idx_bbps_biller_id
    ON bbps_transactions(biller_id);

