-- User Services Management Table
CREATE TABLE user_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type VARCHAR(40) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    enabled_by VARCHAR(80),
    enabled_at TIMESTAMP WITH TIME ZONE,
    disabled_by VARCHAR(80),
    disabled_at TIMESTAMP WITH TIME ZONE,
    remarks VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_service UNIQUE (user_id, service_type)
);

-- Index for faster lookups
CREATE INDEX idx_user_services_user_id ON user_services(user_id);
CREATE INDEX idx_user_services_type ON user_services(service_type);
