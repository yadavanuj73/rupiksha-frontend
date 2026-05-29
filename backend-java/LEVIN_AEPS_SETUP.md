# Levin AEPS Configuration Guide

## Problem
Getting "I/O error on POST request" when submitting AEPS onboarding form.

## Root Cause
The backend cannot connect to the Levin Fintech API. This is usually due to:
1. **Wrong Base URL** - The base URL format is incorrect
2. **Missing Environment Variables** - API credentials not set in Render
3. **Network/SSL Issues** - Render cannot reach Levin API or SSL certificate problems

## Solution

### Step 1: Get Correct Levin API Details

Login to your **Levin Fintech Merchant Dashboard** and find:
- Base URL (API Endpoint)
- API Token
- User ID
- Encryption Key

### Step 2: Verify Base URL Format

The base URL should be in one of these formats:
- `https://api.levinfintech.com/api/levin`
- `https://www.levinfintech.com/api/levin`
- `https://levinfintech.com/api/v1`

**Important**: The code appends `/aeps-onboarding` to the base URL, so:
- If base URL is `https://api.levinfintech.com/api/levin`
- Final URL becomes `https://api.levinfintech.com/api/levin/aeps-onboarding`

### Step 3: Set Environment Variables in Render

Go to your Render Dashboard → Backend Service → Environment

Add these variables:

```
LEVIN_AEPS_BASE_URL=https://api.levinfintech.com/api/levin
LEVIN_AEPS_API_TOKEN=your_actual_api_token_here
LEVIN_AEPS_USER_ID=your_actual_user_id_here
LEVIN_AEPS_ENCRYPTION_KEY=your_actual_encryption_key_here
```

**Replace the values** with your actual credentials from Levin dashboard.

### Step 4: Test the Connection

After setting environment variables, redeploy your backend and check the logs:

```
========== AEPS ONBOARDING START ==========
Base URL: https://api.levinfintech.com/api/levin
Full URL: https://api.levinfintech.com/api/levin/aeps-onboarding
API Token: abc123...
User ID: your_user_id
```

### Step 5: Common Issues

#### Issue 1: "Connection refused" or "Unknown host"
**Solution**: Wrong base URL. Double-check the exact URL from Levin documentation.

#### Issue 2: "SSL handshake failed"
**Solution**: The new RestTemplate configuration should handle this. If it persists, contact Levin support.

#### Issue 3: "401 Unauthorized"
**Solution**: Wrong API token or User ID. Verify credentials in Levin dashboard.

#### Issue 4: "Timeout"
**Solution**: 
- Levin API might be slow or down
- Check Levin API status
- Increase timeout in RestTemplateConfig (currently 30 seconds)

### Step 6: Test with Postman

Before testing in your app, test the Levin API directly:

**Request:**
```
POST https://api.levinfintech.com/api/levin/aeps-onboarding
Content-Type: application/json

{
  "apiToken": "your_token",
  "userId": "your_user_id",
  "aeps_agent_id": "TEST123",
  "fname": "Test",
  "lname": "User",
  "aeps_mobile": "9876543210",
  "email": "test@example.com",
  "pan_card": "ABCDE1234F",
  "aadhar_number": "123456789012",
  "pinCode": "123456",
  "address": "Test Address",
  "state": "Test State",
  "city": "Test City",
  "shop_name": "Test Shop",
  "latitude": "0.0",
  "longitude": "0.0"
}
```

If this works in Postman but not in your app, the issue is in the backend code.
If this fails in Postman too, the issue is with Levin API credentials or URL.

## Changes Made

### 1. RestTemplateConfig.java
- Added proper SSL/TLS handling
- Configured connection pooling
- Increased timeouts to 30 seconds
- Added trust manager for SSL certificates

### 2. AepsService.java
- Added detailed logging for debugging
- Separate error handling for network issues
- Logs base URL, full URL, and credentials (masked)

## Next Steps

1. Set correct environment variables in Render
2. Redeploy backend
3. Check logs for the "AEPS ONBOARDING START" section
4. Verify the "Full URL" matches Levin's expected endpoint
5. If still failing, share the logs with Levin support

## Contact Levin Support

If the issue persists after following all steps:
- Email: support@levinfintech.com
- Provide: Your User ID, error logs, and the URL you're trying to hit
- Ask: "What is the correct base URL for AEPS onboarding API?"
