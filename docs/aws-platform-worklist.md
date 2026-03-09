# AWS Platform Worklist (Required for True Production Completion)

Last updated: 2026-03-08

This file lists the AWS-side work that must be executed to complete remaining platform items.

## When to Connect AWS
- Connect AWS at the start of Point `6` (Real AWS Integration).
- Do not wait for Point `18`; platform integration must begin before telemetry/auto-healing/notifications.
- Recommended sequence:
  1. Finish local app/API contracts and schema scaffolding (Points 1-5, 11-12 baseline).
  2. Connect first AWS `dev` account.
  3. Implement and validate real integration (Points 6, 7, 8, 9, 10, 13, 14, 16).
  4. Promote to staging and production with release controls.

## A) Account and Environment Setup
- Create separate AWS accounts/environments: `dev`, `staging`, `prod`.
- Configure IAM admin/bootstrap roles for CI/CD only.
- Define tagging policy (`app`, `env`, `owner`, `cost-center`) and apply globally.

## B) Identity and Cross-Account Access
- Create cross-account role for InfraMind control plane (AssumeRole target).
- Add least-privilege IAM policies for:
  - CloudWatch metrics/log reads
  - EventBridge reads/rules
  - ECS/EC2/Lambda/RDS/ALB read + required recovery actions
- Store role ARN per workspace/account in backend DB.
- Implement and verify IAM permission check endpoint from live AWS APIs.

## C) Event and Telemetry Pipeline
- Create CloudWatch alarms and anomaly signals for key services.
- Configure EventBridge rules to forward relevant alarms/incidents.
- Deploy Lambda (Python) handlers for:
  - ingest event
  - classify severity
  - dispatch incident lifecycle updates
- Add SQS queue and DLQ between event source and processors.
- Add retries + idempotency keys in handlers.

## D) Auto-Healing Runtime
- Define action executors per service type:
  - EC2: reboot/replace
  - ECS: restart task/scale service
  - Lambda: publish alias rollback/redeploy
  - RDS: failover/restart (safe controls)
  - ALB: target group health remediation
- Add cooldown windows and verification checks.
- Add escalation path on repeated failure.

## E) Notification Providers
- Email: configure SES domain identity + DKIM/SPF.
- SMS: configure SNS topic/permissions/spend controls.
- Slack/Teams: webhook secrets per workspace.
- Implement channel test endpoint and delivery log storage.

## F) Data, Storage, and Security
- Decide final production DB (PostgreSQL recommended).
- Configure backups, PITR, and retention policies.
- Move secrets to AWS Secrets Manager (or equivalent managed secret store).
- Enable encryption at rest and in transit everywhere.
- Add WAF/rate-limiting controls at the API edge.

## G) Observability for InfraMind Itself
- Set platform dashboards for API latency/error rate.
- Set alerting on pipeline lag, DLQ growth, failed recoveries.
- Track SLOs:
  - alert latency
  - recovery success rate
  - mean recovery time

## H) CI/CD and Release
- Provision IaC stack (Terraform/CDK/CloudFormation).
- Setup CI checks: lint, typecheck, tests, build, security scan.
- Setup CD pipelines to dev/staging/prod with manual prod approval.
- Use canary or blue/green rollout and rollback automation.

## I) Security and Compliance
- Run IAM least-privilege review.
- Run dependency/vulnerability scans in CI.
- Complete external/internal security review and penetration test.
- Finalize incident response and access audit runbooks.

## J) Go-Live Exit Criteria
- Staging soak test passed.
- Backup/restore drill passed.
- On-call and escalation matrix active.
- Runbooks reviewed by engineering + operations.
- Final production sign-off recorded.
