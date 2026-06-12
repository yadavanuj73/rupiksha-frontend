-- Create payout_transactions table
CREATE TABLE IF NOT EXISTS payout_transactions (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    beneficiary_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    ifsc VARCHAR(11) NOT NULL,
    bank_name VARCHAR(100),
    transfer_mode VARCHAR(10) NOT NULL,
    remarks VARCHAR(200),
    mobile_number VARCHAR(10),
    account_type VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    status_code VARCHAR(10),
    response_message VARCHAR(1000),
    response_data VARCHAR(2000),
    utr VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_payout_order_id ON payout_transactions(order_id);
CREATE INDEX idx_payout_user_id ON payout_transactions(user_id);
CREATE INDEX idx_payout_status ON payout_transactions(status);
CREATE INDEX idx_payout_created_at ON payout_transactions(created_at);
CREATE INDEX idx_payout_user_status ON payout_transactions(user_id, status);
CREATE INDEX idx_payout_user_created ON payout_transactions(user_id, created_at);

-- Add comments
COMMENT ON TABLE payout_transactions IS 'Stores all payout transaction records';
COMMENT ON COLUMN payout_transactions.order_id IS 'Unique order identifier for the payout';
COMMENT ON COLUMN payout_transactions.user_id IS 'User who initiated the payout';
COMMENT ON COLUMN payout_transactions.status IS 'Transaction status: PENDING, SUCCESS, FAILED';
COMMENT ON COLUMN payout_transactions.utr IS 'Unique Transaction Reference from bank';

-- Made with Bob
