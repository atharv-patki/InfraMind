# Security Hardening Checklist

## Secrets and Credentials
- [ ] Move all secrets to managed secret store.
- [ ] Remove plaintext secrets from local files.
- [ ] Rotate keys every 90 days.

## Access Control
- [ ] Enforce least-privilege IAM for runtime and CI/CD.
- [ ] Enable MFA for privileged roles.
- [ ] Review stale IAM users/roles monthly.

## Application Security
- [ ] Add API rate limiting for auth and mutating endpoints.
- [ ] Add WAF and bot protection at edge.
- [ ] Enable secure headers and cookie hardening.

## Supply Chain
- [ ] CI vulnerability scanning enabled.
- [ ] High/critical vulnerabilities triaged before release.
- [ ] Lock dependency versions and review updates.

## Audit and Compliance
- [ ] Sensitive operations produce audit logs.
- [ ] Log retention policy defined.
- [ ] Security review and penetration test completed pre-launch.
