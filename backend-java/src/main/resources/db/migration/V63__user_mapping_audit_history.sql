-- Migration V63: User Mapping Hierarchy and Audit History Infrastructure
CREATE TABLE IF NOT EXISTS user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    user_role VARCHAR(40) NOT NULL DEFAULT 'RETAILER',
    previous_parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    previous_parent_role VARCHAR(40),
    previous_parent_name VARCHAR(120),
    previous_parent_party_code VARCHAR(80),
    new_parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    new_parent_role VARCHAR(40) NOT NULL,
    new_parent_name VARCHAR(120),
    new_parent_party_code VARCHAR(80),
    action_type VARCHAR(50) NOT NULL DEFAULT 'MAP_USER',
    mapped_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    mapped_by_admin_username VARCHAR(80),
    reason TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_mappings_user_id ON user_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mappings_new_parent_id ON user_mappings(new_parent_id);
CREATE INDEX IF NOT EXISTS idx_user_mappings_status ON user_mappings(status);
CREATE INDEX IF NOT EXISTS idx_user_mappings_user_status ON user_mappings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_mappings_created_at ON user_mappings(created_at);
