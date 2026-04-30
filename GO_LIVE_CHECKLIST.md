# Go-Live Checklist (Vercel + Render + Postgres + Redis)

## Environments
- [ ] Vercel project created for frontend
- [ ] Render web service created for `backend-java`
- [ ] Render managed PostgreSQL attached
- [ ] Render managed Redis attached
- [ ] DNS configured:
  - [ ] `app.<domain>` -> Vercel
  - [ ] `api.<domain>` -> Render
- [ ] SSL certificates active on both domains

## Secrets / Env Vars
- [ ] `JWT_SECRET`
- [ ] `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`
- [ ] `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- [ ] `OTP_*` provider credentials
- [ ] `PAYMENT_*` provider credentials
- [ ] `SENTRY_DSN`
- [ ] Frontend `VITE_BACKEND_URL=https://api.<domain>/api/v1`

## Functional UAT
- [ ] Register user
- [ ] Admin approval workflow
- [ ] Login + refresh token + logout
- [ ] OTP send + verify (real provider)
- [ ] Wallet credit/debit with ledger rows
- [ ] Payment order creation
- [ ] Payment webhook signature verification
- [ ] Role-based access restrictions
- [ ] Metrics visible on `/actuator/prometheus`
- [ ] Sentry receives exceptions

## Hardening
- [ ] CORS allowlist set to production frontend domain
- [ ] Rate limit on auth/otp/payment endpoints
- [ ] Idempotency on payment and transfer APIs
- [ ] DB backup/restore tested
- [ ] Alerting configured for 5xx and latency

## Launch Gate
- [ ] Smoke test from production URL
- [ ] Monitoring green for 24h
- [ ] Rollback plan documented

