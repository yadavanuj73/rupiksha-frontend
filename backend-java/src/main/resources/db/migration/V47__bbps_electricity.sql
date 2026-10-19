-- Migration V47: BBPS Electricity Bill Payment Extensions
ALTER TABLE bbps_transactions
    ADD COLUMN IF NOT EXISTS consumer_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS bill_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS bill_date VARCHAR(30),
    ADD COLUMN IF NOT EXISTS due_date VARCHAR(30),
    ADD COLUMN IF NOT EXISTS bill_period VARCHAR(50),
    ADD COLUMN IF NOT EXISTS fetch_request_id VARCHAR(40),
    ADD COLUMN IF NOT EXISTS convenience_fee NUMERIC(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS customer_params TEXT,
    ADD COLUMN IF NOT EXISTS additional_info TEXT;

CREATE INDEX IF NOT EXISTS idx_bbps_consumer_number ON bbps_transactions(consumer_number);
CREATE INDEX IF NOT EXISTS idx_bbps_category ON bbps_transactions(category);
