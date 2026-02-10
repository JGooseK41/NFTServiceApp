-- Add missing composite indexes for common multi-column query patterns
-- These improve performance for the most frequent WHERE clause combinations

-- served_notices: case + server lookups (cases.js, audit queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_served_notices_case_server
    ON served_notices(case_number, server_address);

-- served_notices: notice + server lookups (notice updates, verification)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_served_notices_notice_server
    ON served_notices(notice_id, server_address);

-- admin_users: active admin lookups (every admin auth check)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_users_wallet_active
    ON admin_users(wallet_address, is_active);

-- notice_views: viewer + notice lookups (first-view checks, audit)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notice_views_viewer_notice
    ON notice_views(viewer_address, notice_id);

-- audit_logs: action + actor + target lookups (TOCTOU first-view check)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action_actor_target
    ON audit_logs(action_type, actor_address, target_id);

-- case_service_records: case + server lookups (email notification queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_case_service_records_case_server
    ON case_service_records(case_number, server_address);

-- process_servers: lower wallet + email lookups (email notification fallback)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_process_servers_lower_wallet_email
    ON process_servers(LOWER(wallet_address)) WHERE contact_email IS NOT NULL;
