PRAGMA foreign_keys = ON;

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

CREATE INDEX IF NOT EXISTS idx_quota_alert_events_user_period
  ON quota_alert_events(user_id, period, updated_at);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status
  ON billing_subscriptions(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_abuse_events_scope_created
  ON abuse_events(scope, created_at);
