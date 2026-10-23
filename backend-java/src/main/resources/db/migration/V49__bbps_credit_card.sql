-- Migration V49: BBPS Credit Card Bill Payment Extensions
-- Adds credit-card-specific columns to the shared bbps_transactions table.
-- Per BillAvenue API doc (Page 23 Remitter Info / Page 31 Bill Fetch MOB response):
--   - Last 4 digits of card + registered mobile are the typical customer identifiers.
--   - CVV, full PAN, ATM PIN must NEVER be stored.
--   - For Credit Card and Loan Repayment, disabled payment modes are: Credit Card, Wallet, Prepaid Card.
-- Reuses all existing shared columns: amount, status, biller_id, customer_name, mobile_number,
--   bill_number, bill_date, due_date, bill_period, convenience_fee, fetch_request_id,
--   consumer_number, customer_params, additional_info, payment_mode, payment_channel, etc.

ALTER TABLE bbps_transactions
    ADD COLUMN IF NOT EXISTS card_last_four    VARCHAR(4),
    ADD COLUMN IF NOT EXISTS card_issuer       VARCHAR(100),
    ADD COLUMN IF NOT EXISTS minimum_due       NUMERIC(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS total_due         NUMERIC(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS unbilled_amount   NUMERIC(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS statement_date    VARCHAR(30);

-- Partial index: search credit card transactions by masked card identifier
CREATE INDEX IF NOT EXISTS idx_bbps_card_last_four
    ON bbps_transactions(card_last_four)
    WHERE card_last_four IS NOT NULL;

-- Index for Credit Card category filtering in history
CREATE INDEX IF NOT EXISTS idx_bbps_credit_card_category
    ON bbps_transactions(category)
    WHERE category = 'Credit Card';
