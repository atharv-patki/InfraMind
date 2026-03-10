# Secrets Management Policy

## Scope
- Applies to worker runtime, CI/CD, local developer environments, and third-party providers.

## Required Controls
- Secrets must be stored in managed secret stores for staging/production.
- Plaintext secrets in repository files are prohibited.
- Rotation interval: 90 days (or sooner on suspected compromise).
- Access must be least-privilege and role-scoped.

## Local Development Rule
- `.dev.vars` may be used locally only and must never be committed.
- `.dev.vars.example` must contain placeholders only.

## Incident Response
- Revoke exposed credential immediately.
- Rotate dependent credentials and invalidate active sessions/tokens.
- Record incident in security audit log with owner and remediation timeline.
