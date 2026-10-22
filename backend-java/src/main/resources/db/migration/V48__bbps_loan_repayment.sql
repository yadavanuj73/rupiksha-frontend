-- Migration V48: BBPS Loan Repayment Extensions and Indexes
ALTER TABLE bbps_transactions
    ADD COLUMN IF NOT EXISTS loan_account_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS borrower_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS compliance_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS compliance_reason VARCHAR(255),
    ADD COLUMN IF NOT EXISTS validation_ref_no VARCHAR(64),
    ADD COLUMN IF NOT EXISTS late_payment_fee NUMERIC(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS fixed_charges NUMERIC(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS additional_charges NUMERIC(18,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) DEFAULT 'Cash',
    ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(20) DEFAULT 'AGT';

CREATE INDEX IF NOT EXISTS idx_bbps_loan_account_number ON bbps_transactions(loan_account_number);
CREATE INDEX IF NOT EXISTS idx_bbps_validation_ref_no ON bbps_transactions(validation_ref_no);
