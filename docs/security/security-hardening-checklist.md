# Security Hardening Checklist

## Secrets and Credentials
- [x] Secrets management policy documented (`docs/security/secrets-management-policy.md`).
- [ ] Move all secrets to managed secret store.
- [x] Remove plaintext secrets from tracked example files.
- [x] Key rotation policy documented (90-day baseline).

## Access Control
- [ ] Enforce least-privilege IAM for runtime and CI/CD.
- [ ] Enable MFA for privileged roles.
- [ ] Review stale IAM users/roles monthly.

## Application Security
- [x] Add API rate limiting for auth and mutating endpoints.
- [x] Add signup/invite anti-abuse controls with audit logging (`abuse_events`).
- [ ] Add WAF and bot protection at edge.
- [x] Enable secure headers and cookie hardening.

## Supply Chain
- [x] CI vulnerability scanning enabled.
- [x] Vulnerability waiver and ownership policy documented (`docs/security/vulnerability-waiver-policy.md`).
- [ ] High/critical vulnerabilities triaged before release.
- [ ] Lock dependency versions and review updates.

## Audit and Compliance
- [x] Sensitive operations produce audit logs.
- [x] Sensitive-operation audit policy documented (`docs/security/sensitive-operation-audit-policy.md`).
- [ ] Log retention policy defined.
- [ ] Security review and penetration test completed pre-launch.
