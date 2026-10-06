-- V42: ID Charges, Login Payment Gate, and Admin Coupon System

-- 1. Add ID payment tracking columns to users (defaults to SUCCESS for all existing users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_payment_status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS';
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_payment_paid_at TIMESTAMPTZ;

-- 2. Create id_coupons table
CREATE TABLE IF NOT EXISTS id_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_percent NUMERIC(5, 2) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_id_coupons_user_id ON id_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_id_coupons_code ON id_coupons(code);
CREATE INDEX IF NOT EXISTS idx_id_coupons_is_used ON id_coupons(is_used);

-- 3. Create id_payment_transactions table
CREATE TABLE IF NOT EXISTS id_payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    razorpay_order_id VARCHAR(100) UNIQUE,
    razorpay_payment_id VARCHAR(100),
    razorpay_signature VARCHAR(255),
    amount NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    final_amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    failure_reason TEXT,
    coupon_id UUID REFERENCES id_coupons(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_id_payment_txns_user_id ON id_payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_id_payment_txns_order_id ON id_payment_transactions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_id_payment_txns_status ON id_payment_transactions(status);
