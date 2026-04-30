# Rupiksha Backend (Java Spring Boot)

This service is the production-ready Java backend foundation for:
- Auth/RBAC/JWT/refresh
- PostgreSQL + Flyway
- Redis-backed OTP (with 2Factor adapter)
- Wallet ledger + transaction engine core
- Payment gateway order/webhook integration layer (Razorpay/Cashfree/PhonePe adapters)
- Recharge/Transfer provider adapter (Paysprint scaffold)
- Admin approvals/reports APIs
- Actuator + Prometheus metrics + Sentry support

## 1) Run locally

```bash
cd backend-java
cp .env.example .env   # optional, or set env vars directly
docker compose up --build
```

Backend endpoints:
- `http://localhost:8080/api/v1/health`
- Swagger: `http://localhost:8080/swagger-ui/index.html`
- Prometheus metrics: `http://localhost:8080/actuator/prometheus`

## 2) Frontend compatibility (Vercel)

Set Vercel env:
- `VITE_BACKEND_URL=https://<your-render-host>/api/v1`

For local frontend dev:
- `VITE_DEV_PROXY_TARGET=http://localhost:8080`

## 3) API starter routes

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/user/submit-kyc`
- `GET /api/v1/user/kyc-status`
- `POST /api/v1/otp/send`
- `POST /api/v1/otp/verify`
- `GET /api/v1/wallet/{userId}/balance`
- `POST /api/v1/wallet/credit` (ADMIN/SUPER_DISTRIBUTOR)
- `POST /api/v1/wallet/debit` (ADMIN/SUPER_DISTRIBUTOR)
- `POST /api/v1/payment/orders`
- `POST /api/v1/payment/webhook`
- `POST /api/v1/payment/webhook/razorpay`
- `POST /api/v1/payment/webhook/cashfree`
- `POST /api/v1/payment/webhook/phonepe`
- `POST /api/v1/create-order` (frontend compatibility)
- `POST /api/v1/verify-payment` (frontend compatibility)
- `POST /api/v1/recharge`
- `POST /api/v1/transfer`
- `GET /api/v1/admin/approvals`
- `POST /api/v1/admin/approvals/{id}`
- `POST /api/v1/admin/approvals/{id}/issue-credentials`
- `GET /api/v1/admin/kyc/pending`
- `POST /api/v1/admin/kyc/{id}`
- `GET /api/v1/admin/reports/users`

## 4) Required provider accounts (your side)

- OTP: 2Factor / MSG91 / Twilio Verify
- Payment: Razorpay / Cashfree / PhonePe
- BBPS / DMT / Travel API contracts
- Cloud DNS/SSL ownership

## 5) UAT checklist before go-live

- [ ] Role login + refresh token flows pass
- [ ] Registration approval + credential issuance pass
- [ ] User cannot transact before KYC approval
- [ ] OTP send/verify rate-limit + expiry pass
- [ ] Wallet credit/debit ledger integrity pass
- [ ] Idempotency + duplicate payment handling pass
- [ ] Payment webhook signature verification pass
- [ ] Admin approval workflows pass
- [ ] Data persistence survives restarts
- [ ] Backups + restore test pass
- [ ] HTTPS + CORS lock-down pass
- [ ] Monitoring alerts pass (5xx, latency, db errors)

## 6) Next implementation phases

1. Migrate existing frontend API calls to `api/v1` contracts
2. Add BBPS/recharge/payout/travel provider adapters
3. Add reconciliation jobs + settlement reports
4. Add comprehensive integration tests and load tests

## 7) Postman + UAT automation

- Postman collection: `backend-java/qa/postman/Rupiksha-Live.postman_collection.json`
- Postman environment: `backend-java/qa/postman/Rupiksha-Live.postman_environment.json`
- UAT checklist: `backend-java/qa/uat/uat-checklist.md`
- PowerShell runner (Windows): `backend-java/qa/uat/run-uat.ps1`
- Shell runner (Linux/macOS): `backend-java/qa/uat/run-uat.sh`

Example:
```powershell
cd backend-java
powershell -ExecutionPolicy Bypass -File .\qa\uat\run-uat.ps1 -BaseUrl "https://your-render-domain/api/v1"
```

