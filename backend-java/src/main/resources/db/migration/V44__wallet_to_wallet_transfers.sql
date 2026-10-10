-- V44: Wallet to Wallet Transfers Table and Indexes
CREATE TABLE IF NOT EXISTS wallet_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_reference VARCHAR(64) NOT NULL UNIQUE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    sender_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    recipient_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    amount NUMERIC(18,2) NOT NULL,
    fee NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    total_debit NUMERIC(18,2) NOT NULL,
    recipient_credit NUMERIC(18,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    idempotency_key VARCHAR(120) UNIQUE,
    remarks VARCHAR(255),
    sender_wallet_entry_id UUID REFERENCES wallet_entries(id) ON DELETE SET NULL,
    recipient_wallet_entry_id UUID REFERENCES wallet_entries(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_sender ON wallet_transfers(sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_recipient ON wallet_transfers(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_ref ON wallet_transfers(transfer_reference);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_idemp ON wallet_transfers(idempotency_key);
