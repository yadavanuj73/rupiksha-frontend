param(
  [string]$BaseUrl = "http://localhost:8080/api/v1"
)

$ErrorActionPreference = "Stop"

function Invoke-JsonPost {
  param([string]$Url, [object]$Body, [hashtable]$Headers = @{})
  $json = $Body | ConvertTo-Json -Depth 10
  return Invoke-RestMethod -Method Post -Uri $Url -Headers $Headers -ContentType "application/json" -Body $json
}

Write-Host "1) Health check..."
Invoke-RestMethod -Method Get -Uri "$BaseUrl/health" | Out-Null

Write-Host "2) Login..."
$login = Invoke-JsonPost -Url "$BaseUrl/auth/login" -Body @{
  username = "admin"
  password = "Admin@123"
}
$token = $login.accessToken
if (-not $token) { throw "Login failed: accessToken missing" }
$authHeaders = @{ Authorization = "Bearer $token" }

Write-Host "3) OTP send/verify..."
Invoke-JsonPost -Url "$BaseUrl/otp/send" -Body @{ mobile = "9999999000" } | Out-Null
Invoke-JsonPost -Url "$BaseUrl/otp/verify" -Body @{ mobile = "9999999000"; otp = "123456" } | Out-Null

Write-Host "4) Create order..."
$order = Invoke-JsonPost -Url "$BaseUrl/create-order" -Body @{
  amount = 100
  customer_id = "admin"
  purpose = "WALLET_TOPUP"
} -Headers $authHeaders
if (-not $order.order_id) { throw "Order creation failed: order_id missing" }

Write-Host "5) Recharge mock/live call..."
$userId = "00000000-0000-0000-0000-000000000000"
try {
  Invoke-JsonPost -Url "$BaseUrl/recharge" -Body @{
    userId = $userId
    mobile = "9999999000"
    operator = "JIO"
    amount = 10
  } -Headers $authHeaders | Out-Null
} catch {
  Write-Host "Recharge call returned error (expected if placeholder user/provider): $($_.Exception.Message)"
}

Write-Host "6) Transfer mock/live call..."
try {
  Invoke-JsonPost -Url "$BaseUrl/transfer" -Body @{
    userId = $userId
    beneficiaryName = "Test Beneficiary"
    accountNumber = "1234567890"
    ifsc = "HDFC0001234"
    amount = 50
  } -Headers $authHeaders | Out-Null
} catch {
  Write-Host "Transfer call returned error (expected if placeholder user/provider): $($_.Exception.Message)"
}

Write-Host "UAT script completed."

