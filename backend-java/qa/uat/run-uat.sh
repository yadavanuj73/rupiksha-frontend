#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:8080/api/v1}"

echo "1) Health check..."
curl -fsS "$BASE_URL/health" >/dev/null

echo "2) Login..."
LOGIN_JSON=$(curl -fsS -X POST "$BASE_URL/auth/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"Admin@123"}')
TOKEN=$(echo "$LOGIN_JSON" | jq -r '.accessToken // empty')
if [[ -z "$TOKEN" ]]; then
  echo "Login failed: accessToken missing"
  exit 1
fi

echo "3) OTP send/verify..."
curl -fsS -X POST "$BASE_URL/otp/send" -H 'Content-Type: application/json' -d '{"mobile":"9999999000"}' >/dev/null
curl -fsS -X POST "$BASE_URL/otp/verify" -H 'Content-Type: application/json' -d '{"mobile":"9999999000","otp":"123456"}' >/dev/null

echo "4) Create order..."
ORDER_JSON=$(curl -fsS -X POST "$BASE_URL/create-order" -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"amount":100,"customer_id":"admin","purpose":"WALLET_TOPUP"}')
ORDER_ID=$(echo "$ORDER_JSON" | jq -r '.order_id // empty')
if [[ -z "$ORDER_ID" ]]; then
  echo "Order creation failed: order_id missing"
  exit 1
fi

echo "5) Recharge mock/live call..."
curl -sS -X POST "$BASE_URL/recharge" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"00000000-0000-0000-0000-000000000000","mobile":"9999999000","operator":"JIO","amount":10}' >/dev/null || true

echo "6) Transfer mock/live call..."
curl -sS -X POST "$BASE_URL/transfer" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"00000000-0000-0000-0000-000000000000","beneficiaryName":"Test Beneficiary","accountNumber":"1234567890","ifsc":"HDFC0001234","amount":50}' >/dev/null || true

echo "UAT script completed."

