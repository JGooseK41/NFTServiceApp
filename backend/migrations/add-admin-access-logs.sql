-- Migration: Create admin_access_logs table
-- This table stores audit logs for admin actions

CREATE TABLE IF NOT EXISTS admin_access_logs (
    id SERIAL PRIMARY KEY,
    admin_wallet VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_wallet ON admin_access_logs(admin_wallet);
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_action ON admin_access_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_access_logs_created ON admin_access_logs(created_at DESC);
