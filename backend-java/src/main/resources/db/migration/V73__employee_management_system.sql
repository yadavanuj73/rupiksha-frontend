-- V73: Complete Employee Management, Hierarchy, Scope, Permissions, Auth Sessions & Performance Audit Schema

CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY,
    employee_code VARCHAR(40) NOT NULL UNIQUE,
    username VARCHAR(80) NOT NULL UNIQUE,
    full_name VARCHAR(120) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(120) NOT NULL,
    address VARCHAR(300),
    employee_role VARCHAR(30) NOT NULL CHECK (employee_role IN ('NATIONAL_HEADER', 'STATE_HEADER', 'REGIONAL_HEADER')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    password_hash VARCHAR(255) NOT NULL,
    reporting_manager_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
    territory_label VARCHAR(255),
    session_version INTEGER NOT NULL DEFAULT 1,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    last_login_ip VARCHAR(64),
    password_last_changed TIMESTAMPTZ,
    created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(employee_role);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_reporting_manager ON employees(reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at DESC);

CREATE TABLE IF NOT EXISTS employee_scopes (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('NATIONAL', 'STATE', 'ZONE')),
    state_name VARCHAR(100),
    zone_name VARCHAR(100),
    city_or_district VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_scopes_employee_id ON employee_scopes(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_scopes_state_name ON employee_scopes(state_name);
CREATE INDEX IF NOT EXISTS idx_employee_scopes_zone_name ON employee_scopes(zone_name);

CREATE TABLE IF NOT EXISTS employee_permissions (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    category VARCHAR(60) NOT NULL,
    permission_code VARCHAR(80) NOT NULL,
    granted_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_employee_permission UNIQUE (employee_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_employee_permissions_employee_id ON employee_permissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_permissions_code ON employee_permissions(permission_code);

CREATE TABLE IF NOT EXISTS employee_refresh_tokens (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_refresh_tokens_employee ON employee_refresh_tokens(employee_id);

CREATE TABLE IF NOT EXISTS employee_audit_logs (
    id UUID PRIMARY KEY,
    employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    employee_username VARCHAR(80),
    actor_type VARCHAR(20) NOT NULL,
    actor_id VARCHAR(64),
    actor_username VARCHAR(80),
    event_type VARCHAR(60) NOT NULL,
    target_user_id UUID,
    target_employee_id UUID,
    details TEXT,
    ip_address VARCHAR(64),
    user_agent VARCHAR(500),
    outcome VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_audit_employee ON employee_audit_logs(employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_audit_event_type ON employee_audit_logs(event_type, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_by_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_by_employee_code VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS zone_name VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_users_onboarded_by_employee ON users(onboarded_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_users_state_name ON users(state_name);
CREATE INDEX IF NOT EXISTS idx_users_zone_name ON users(zone_name);
