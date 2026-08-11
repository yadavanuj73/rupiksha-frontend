-- Migration V30: Create recharges table for VenusRecharge
CREATE TABLE IF NOT EXISTS recharges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    merchant_ref_no VARCHAR(14) NOT NULL UNIQUE,
    mobile_no VARCHAR(20) NOT NULL,
    operator_code VARCHAR(10) NOT NULL,
    service_type VARCHAR(10) NOT NULL DEFAULT 'MR',
    amount NUMERIC(18,2) NOT NULL,
    status VARCHAR(16) NOT NULL,
    description VARCHAR(255),
    operator_txn_id VARCHAR(120),
    order_no VARCHAR(120),
    opening_balance NUMERIC(18,2),
    closing_balance NUMERIC(18,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recharges_user_id ON recharges(user_id);
CREATE INDEX IF NOT EXISTS idx_recharges_merchant_ref_no ON recharges(merchant_ref_no);
CREATE INDEX IF NOT EXISTS idx_recharges_status ON recharges(status);
