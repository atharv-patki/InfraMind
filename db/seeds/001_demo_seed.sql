PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO users (
  id, first_name, last_name, email, plan, password_hash, password_salt, created_at, updated_at
)
VALUES (
  'usr_demo_owner',
  'Demo',
  'Owner',
  'owner@inframind.local',
  'pro',
  'seeded-password-hash',
  'seeded-password-salt',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO workspaces (
  id, name, slug, created_by, created_at, updated_at
)
VALUES (
  'ws_demo_main',
  'InfraMind Demo Workspace',
  'inframind-demo',
  'usr_demo_owner',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO memberships (
  id, workspace_id, user_id, role, status, created_at, updated_at
)
VALUES (
  'mbr_demo_owner',
  'ws_demo_main',
  'usr_demo_owner',
  'owner',
  'active',
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO aws_connections (
  user_id, account_id, region, environment, role_arn, connection_status,
  auto_recovery_enabled, channel_email, channel_sms, channel_slack, channel_teams, updated_at
)
VALUES (
  'usr_demo_owner',
  '123456789012',
  'us-east-1',
  'prod',
  'arn:aws:iam::123456789012:role/InfraMindReadOnlyRole',
  'connected',
  1, 1, 0, 1, 0,
  datetime('now')
);

INSERT OR IGNORE INTO notification_channels (
  id, workspace_id, type, target, enabled, created_at, updated_at
)
VALUES
  ('chn_email_demo', 'ws_demo_main', 'email', 'alerts@inframind.local', 1, datetime('now'), datetime('now')),
  ('chn_slack_demo', 'ws_demo_main', 'slack', 'https://hooks.slack.com/services/demo/demo/demo', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO audit_logs (
  id, workspace_id, user_id, action, entity_type, entity_id, metadata, created_at
)
VALUES (
  'audit_seed_001',
  'ws_demo_main',
  'usr_demo_owner',
  'workspace.seeded',
  'workspace',
  'ws_demo_main',
  '{"source":"seed"}',
  datetime('now')
);
