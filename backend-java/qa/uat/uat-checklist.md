# UAT Scripts and Acceptance Criteria

## Prerequisites
- Java backend running and accessible at `BASE_URL` (`/api/v1`)
- At least one approved user in DB with wallet
- Valid provider credentials set in env:
  - 2Factor OTP
  - Razorpay/Cashfree/PhonePe
  - Recharge/transfer provider

## 1) Auth
- Register user -> `201` and `status=PENDING`
- Admin approval -> user status changes to `APPROVED/ACTIVE`
- Login -> access + refresh token returned
- Refresh -> new access token returned

## 2) OTP
- Send OTP -> success
- Verify wrong OTP -> failed
- Verify correct OTP -> success

## 3) KYC Mandatory Gate
- Login after registration approval but before KYC approval -> allowed
- Any service call before KYC approval (`/create-order`, `/recharge`, `/transfer`) -> blocked with KYC required error
- Submit KYC with mandatory docs (aadhaar, PAN, selfie, aadhaar photo, PAN photo, address) -> status moves to `PENDING`
- Admin approves KYC -> status moves to `APPROVED`
- Service calls now succeed for approved KYC users

## 4) Wallet
- Get balance -> returns numeric balance
- Credit wallet -> balance increases and ledger row added
- Debit wallet -> balance decreases and ledger row added
- Insufficient debit -> proper error

## 5) Payments
- Create order (provider = razorpay/cashfree/phonepe) -> order id created
- Verify payment signature -> success only with valid signature
- Webhook with invalid signature -> rejected
- Webhook with valid signature + success event -> transaction marked SUCCESS + wallet credited exactly once
- Duplicate webhook replay -> idempotent (no double credit)

## 6) Recharge / Transfer
- Recharge success -> wallet debited + txn SUCCESS
- Recharge failure -> wallet refunded + txn FAILED
- Transfer success -> wallet debited + txn SUCCESS
- Transfer failure -> wallet refunded + txn FAILED

## 7) AEPS
- `/api/v1/aeps/transaction` works only for authenticated userId match
- `/api/v1/aeps/history` returns only current user's AEPS transactions
- `/api/v1/aeps/status-check`, `/api/v1/aeps/recon`, `/api/v1/aeps/2fa` return structured success/error payloads
- When `SERVICE_AEPS_ENABLED=false`, AEPS APIs return disabled response

## 8) BBPS
- `/api/v1/bbps/fetch` validates user context and returns bill details
- `/api/v1/bbps/pay` debits wallet, writes txn, and returns txn id
- BBPS failure path refunds wallet and marks txn failed
- When `SERVICE_BBPS_ENABLED=false`, BBPS APIs return disabled response

## 9) Tickets
- `/api/v1/tickets` allows authenticated retailer to raise ticket
- `/api/v1/tickets/mine` returns only current user tickets
- When `SERVICE_TICKETS_ENABLED=false`, ticket APIs are blocked

## 10) Production Go-live Gates
- Active profile `prod` must not allow mock providers unless explicitly approved:
  - `ALLOW_MOCK_PROVIDERS_IN_PRODUCTION=false`
- All required env values are present for enabled live providers:
  - `AEPS_PROVIDER`, `BBPS_PROVIDER`, `RECHARGE_PROVIDER`, `PAYMENT_PROVIDER`
- Smoke test script passes for auth, wallet, recharge, transfer, aeps, bbps, tickets

## 11) Monitoring / Ops
- `/actuator/health` -> UP
- `/actuator/prometheus` -> metrics scrapeable
- Sentry captures test exception

