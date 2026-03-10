PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'engineer', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aws_connections (
  user_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT '123456789012',
  region TEXT NOT NULL DEFAULT 'us-east-1',
  environment TEXT NOT NULL DEFAULT 'prod' CHECK (environment IN ('dev', 'staging', 'prod')),
  role_arn TEXT NOT NULL DEFAULT '',
  connection_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (
    connection_status IN ('disconnected', 'connected', 'permission_denied', 'partial_outage', 'recovery_running')
  ),
  auto_recovery_enabled INTEGER NOT NULL DEFAULT 1,
  channel_email INTEGER NOT NULL DEFAULT 1,
  channel_sms INTEGER NOT NULL DEFAULT 0,
  channel_slack INTEGER NOT NULL DEFAULT 1,
  channel_teams INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ip TEXT NOT NULL,
  region TEXT NOT NULL,
  uptime TEXT NOT NULL,
  cpu REAL NOT NULL DEFAULT 0,
  memory REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('Healthy', 'Warning', 'Critical')),
  last_heartbeat TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics_samples (
  id TEXT PRIMARY KEY,
  resource_id TEXT,
  region TEXT NOT NULL,
  service TEXT NOT NULL,
  cpu REAL NOT NULL,
  memory REAL NOT NULL,
  disk REAL NOT NULL,
  network REAL NOT NULL,
  error_rate REAL NOT NULL,
  response_time REAL NOT NULL,
  at TEXT NOT NULL,
  FOREIGN KEY (resource_id) REFERENCES servers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('Critical', 'Warning', 'Info')),
  status TEXT NOT NULL CHECK (status IN ('Active', 'Resolved')),
  lifecycle_status TEXT DEFAULT 'Detected' CHECK (
    lifecycle_status IN ('Detected', 'Analyzing', 'Recovering', 'Resolved', 'Escalated')
  ),
  owner TEXT NOT NULL DEFAULT 'Platform SRE',
  team TEXT NOT NULL DEFAULT 'Reliability',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incident_detection_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('error_rate', 'response_time', 'cpu', 'memory', 'disk', 'network', 'active_alerts')),
  operator TEXT NOT NULL CHECK (operator IN ('gt', 'gte', 'lt', 'lte')),
  threshold REAL NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('Critical', 'Warning', 'Info')),
  cooldown_minutes INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incident_events (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('Detected', 'Analyzing', 'Recovering', 'Resolved', 'Escalated')),
  actor_type TEXT NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system', 'user')),
  actor_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (incident_id) REFERENCES alerts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_condition TEXT NOT NULL,
  action_text TEXT NOT NULL,
  cooldown_minutes INTEGER NOT NULL,
  verification_window_seconds INTEGER NOT NULL DEFAULT 90,
  escalation_target TEXT NOT NULL DEFAULT 'Platform SRE',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run TEXT NOT NULL,
  success_rate INTEGER NOT NULL DEFAULT 90,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playbook_executions (
  id TEXT PRIMARY KEY,
  playbook_id TEXT NOT NULL,
  incident_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'escalated')),
  verification_result TEXT NOT NULL CHECK (verification_result IN ('pending', 'passed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (playbook_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
  FOREIGN KEY (incident_id) REFERENCES alerts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS playbook_execution_locks (
  lock_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  incident_id TEXT,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('email', 'sms', 'slack', 'teams')),
  target TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'dropped')),
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (incident_id) REFERENCES alerts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notification_dead_letters (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  incident_id TEXT,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('email', 'sms', 'slack', 'teams')),
  target TEXT NOT NULL,
  payload TEXT NOT NULL,
  reason TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (incident_id) REFERENCES alerts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  timezone TEXT NOT NULL,
  theme TEXT NOT NULL CHECK (theme IN ('system', 'light', 'dark')),
  email_alerts INTEGER NOT NULL,
  slack_alerts INTEGER NOT NULL,
  weekly_report INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_value TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  impact TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
  done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS incident_audit_notes (
  incident_id TEXT PRIMARY KEY,
  note TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (incident_id) REFERENCES alerts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS usage_counters (
  user_id TEXT NOT NULL,
  period TEXT NOT NULL,
  metric TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, period, metric),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quota_alert_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  period TEXT NOT NULL,
  metric TEXT NOT NULL,
  threshold_percent INTEGER NOT NULL,
  current_value INTEGER NOT NULL,
  limit_value INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  renews_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS abuse_events (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('signup', 'invite', 'mail')),
  actor_key TEXT NOT NULL,
  email TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_workspace ON memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_servers_region ON servers(region);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_incident_detection_rules_enabled ON incident_detection_rules(enabled, updated_at);
CREATE INDEX IF NOT EXISTS idx_incident_events_incident ON incident_events(incident_id, created_at);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_playbook ON playbook_executions(playbook_id, started_at);
CREATE INDEX IF NOT EXISTS idx_playbook_execution_locks_expires_at ON playbook_execution_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_workspace ON notification_deliveries(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_dead_letters_workspace ON notification_dead_letters(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_counters_user_period ON usage_counters(user_id, period);
CREATE INDEX IF NOT EXISTS idx_quota_alert_events_user_period ON quota_alert_events(user_id, period, updated_at);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON billing_subscriptions(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_abuse_events_scope_created ON abuse_events(scope, created_at);
