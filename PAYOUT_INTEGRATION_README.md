# Payout API Integration Guide

## Overview
This document describes the complete integration of the QuickZaps Payout API into the Rupiksha platform. The payout service enables instant money transfers to bank accounts via IMPS, NEFT, and RTGS.

## Architecture

### Backend (Java Spring Boot)
- **Location**: `backend-java/src/main/java/com/rupiksha/aeps/`
- **Framework**: Spring Boot 3.3.5
- **Database**: PostgreSQL with Flyway migrations

### Frontend (React)
- **Location**: `src/retailer/pages/Payout.jsx`
- **Framework**: React with Tailwind CSS
- **API Service**: `src/services/apiService.js`

## Backend Components

### 1. Entity Layer
**File**: [`backend-java/src/main/java/com/rupiksha/aeps/entity/PayoutTransaction.java`](backend-java/src/main/java/com/rupiksha/aeps/entity/PayoutTransaction.java)

Stores all payout transaction records with fields:
- Order ID (unique)
- User ID
- Beneficiary details (name, account, IFSC)
- Amount and transfer mode
- Transaction status (PENDING, SUCCESS, FAILED)
- Response data and UTR

### 2. Repository Layer
**File**: [`backend-java/src/main/java/com/rupiksha/aeps/repository/PayoutTransactionRepository.java`](backend-java/src/main/java/com/rupiksha/aeps/repository/PayoutTransactionRepository.java)

Provides database operations:
- Find by order ID
- Find by user ID
- Filter by status
- Date range queries

### 3. DTO Layer
**Files**:
- [`PayoutRequest.java`](backend-java/src/main/java/com/rupiksha/aeps/dto/PayoutRequest.java) - Request payload with validation
- [`PayoutResponse.java`](backend-java/src/main/java/com/rupiksha/aeps/dto/PayoutResponse.java) - API response structure

### 4. Service Layer
**File**: [`backend-java/src/main/java/com/rupiksha/aeps/service/PayoutService.java`](backend-java/src/main/java/com/rupiksha/aeps/service/PayoutService.java)

Core business logic:
- Initiates payout transactions
- Generates SHA-256 signatures for API authentication
- Handles API communication with QuickZaps
- Manages transaction status updates
- Provides transaction history

### 5. Controller Layer
**File**: [`backend-java/src/main/java/com/rupiksha/aeps/controller/PayoutController.java`](backend-java/src/main/java/com/rupiksha/aeps/controller/PayoutController.java)

REST API endpoints:
- `POST /api/v1/payout/initiate` - Initiate payout
- `GET /api/v1/payout/transaction/{orderId}` - Get transaction details
- `GET /api/v1/payout/transactions` - Get user transactions
- `GET /api/v1/payout/transactions/status/{status}` - Filter by status
- `GET /api/v1/payout/generate-order-id` - Generate unique order ID
- `GET /api/v1/payout/health` - Health check

### 6. Configuration
**File**: [`backend-java/src/main/java/com/rupiksha/aeps/config/PayoutProperties.java`](backend-java/src/main/java/com/rupiksha/aeps/config/PayoutProperties.java)

Configuration properties for QuickZaps API integration.

### 7. Utilities
**File**: [`backend-java/src/main/java/com/rupiksha/aeps/util/SignatureUtil.java`](backend-java/src/main/java/com/rupiksha/aeps/util/SignatureUtil.java)

Utility for:
- SHA-256 signature generation
- Timestamp formatting

### 8. Database Migration
**File**: [`backend-java/src/main/resources/db/migration/V16__payout_transactions.sql`](backend-java/src/main/resources/db/migration/V16__payout_transactions.sql)

Creates `payout_transactions` table with indexes for optimal query performance.

## Frontend Components

### 1. Payout UI Component
**File**: [`src/retailer/pages/Payout.jsx`](src/retailer/pages/Payout.jsx)

Features:
- Form for payout initiation
- Real-time validation
- Transaction history viewer
- Status indicators
- Responsive design

### 2. API Service
**File**: [`src/services/apiService.js`](src/services/apiService.js:276-308)

Provides `payoutService` with methods:
- `initiatePayout(payoutData)`
- `getTransaction(orderId)`
- `getTransactions()`
- `getTransactionsByStatus(status)`
- `generateOrderId()`

### 3. Routing
**File**: [`src/App.jsx`](src/App.jsx:37,219)

Route: `/payout` (Protected, requires RETAILER role)

## Configuration

### Environment Variables

Add to [`backend-java/.env`](backend-java/.env.example:58-61):

```env
# QuickZaps Payout Configuration
QUICKZAPS_BASE_URL=http://login.quickzaps.io
QUICKZAPS_API_KEY=your_api_key_here
QUICKZAPS_PAYOUT_URL=https://login.quickzaps.io/api/PayoutApi/Payoutinitiate
```

### Application Configuration

Added to [`backend-java/src/main/resources/application.yml`](backend-java/src/main/resources/application.yml:113-119):

```yaml
quickzaps:
  payout:
    base-url: ${QUICKZAPS_BASE_URL:http://login.quickzaps.io}
    api-key: ${QUICKZAPS_API_KEY:f43a15b7-1048-4ce8-b1d1-5fcb70c80230}
    payout-url: ${QUICKZAPS_PAYOUT_URL:https://login.quickzaps.io/api/PayoutApi/Payoutinitiate}
```

## API Authentication

The QuickZaps API uses signature-based authentication:

1. **Timestamp**: Current time in format `yyyy-MM-dd HH:mm:ss`
2. **Raw Data**: `apiKey|timestamp|requestJson`
3. **Signature**: SHA-256 hash of raw data (hex format)

Headers sent with each request:
- `x-api-key`: API key
- `x-signature`: Generated signature
- `x-timestamp`: Current timestamp
- `Content-Type`: application/json

## Request/Response Format

### Payout Request
```json
{
  "PayoutPipe": "QUICKZAPS",
  "OrderId": "PO1234567890_user",
  "Amount": 1000.00,
  "BeneficiaryName": "John Doe",
  "AccountNumber": "1234567890",
  "Ifsc": "SBIN0001234",
  "BankName": "State Bank of India",
  "TransferMode": "IMPS",
  "Remarks": "Payment for services",
  "MobileNumber": "9876543210",
  "AccountType": "Savings"
}
```

### Payout Response
```json
{
  "statusCode": "200",
  "message": "Transaction successful",
  "data": {...},
  "orderId": "PO1234567890_user",
  "utr": "UTR123456789",
  "status": "SUCCESS"
}
```

## Validation Rules

### Amount
- Minimum: ₹1
- Maximum: ₹2,00,000
- Must be positive decimal

### Account Number
- Pattern: 9-18 digits
- Only numeric characters

### IFSC Code
- Pattern: `[A-Z]{4}0[A-Z0-9]{6}`
- Example: `SBIN0001234`
- Must be uppercase

### Mobile Number (Optional)
- Pattern: Starts with 6-9, followed by 9 digits
- Example: `9876543210`

### Transfer Modes
- `IMPS` - Instant (24x7)
- `NEFT` - National Electronic Funds Transfer
- `RTGS` - Real Time Gross Settlement

### Account Types
- `Savings`
- `Current`

## Database Schema

```sql
CREATE TABLE payout_transactions (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    beneficiary_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    ifsc VARCHAR(11) NOT NULL,
    bank_name VARCHAR(100),
    transfer_mode VARCHAR(10) NOT NULL,
    remarks VARCHAR(200),
    mobile_number VARCHAR(10),
    account_type VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    status_code VARCHAR(10),
    response_message VARCHAR(1000),
    response_data VARCHAR(2000),
    utr VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);
```

## Testing

### 1. Start Backend
```bash
cd backend-java
./mvnw spring-boot:run
```

### 2. Start Frontend
```bash
npm run dev
```

### 3. Access Payout Page
Navigate to: `http://localhost:5173/payout`

### 4. Test Endpoints

**Health Check**:
```bash
curl http://localhost:8080/api/v1/payout/health
```

**Generate Order ID**:
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8080/api/v1/payout/generate-order-id
```

**Initiate Payout**:
```bash
curl -X POST http://localhost:8080/api/v1/payout/initiate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "PayoutPipe": "QUICKZAPS",
    "OrderId": "PO1234567890_test",
    "Amount": 100.00,
    "BeneficiaryName": "Test User",
    "AccountNumber": "1234567890",
    "Ifsc": "SBIN0001234",
    "TransferMode": "IMPS",
    "AccountType": "Savings"
  }'
```

## Security Considerations

1. **Authentication**: All endpoints require JWT authentication
2. **Authorization**: Users can only access their own transactions
3. **Validation**: Comprehensive input validation on both frontend and backend
4. **Signature**: SHA-256 signature prevents request tampering
5. **HTTPS**: Use HTTPS in production for encrypted communication
6. **API Keys**: Store API keys securely in environment variables

## Error Handling

The service handles various error scenarios:
- Invalid input validation
- Duplicate order IDs
- API communication failures
- Network timeouts
- Authentication errors

All errors are logged and returned with appropriate HTTP status codes and messages.

## Monitoring

Transaction status can be tracked:
- **PENDING**: Transaction initiated, awaiting response
- **SUCCESS**: Transaction completed successfully
- **FAILED**: Transaction failed (check response message)

## Production Deployment

1. Update environment variables with production API credentials
2. Ensure database migrations are applied
3. Configure CORS for production domain
4. Enable HTTPS
5. Set up monitoring and alerting
6. Test with small amounts first

## Support

For issues or questions:
- Check logs in `backend-java/logs/`
- Review transaction history in database
- Contact QuickZaps support for API-related issues

## Files Created/Modified

### Backend Files Created:
1. `backend-java/src/main/java/com/rupiksha/aeps/entity/PayoutTransaction.java`
2. `backend-java/src/main/java/com/rupiksha/aeps/repository/PayoutTransactionRepository.java`
3. `backend-java/src/main/java/com/rupiksha/aeps/dto/PayoutRequest.java`
4. `backend-java/src/main/java/com/rupiksha/aeps/dto/PayoutResponse.java`
5. `backend-java/src/main/java/com/rupiksha/aeps/config/PayoutProperties.java`
6. `backend-java/src/main/java/com/rupiksha/aeps/service/PayoutService.java`
7. `backend-java/src/main/java/com/rupiksha/aeps/controller/PayoutController.java`
8. `backend-java/src/main/java/com/rupiksha/aeps/util/SignatureUtil.java`
9. `backend-java/src/main/resources/db/migration/V16__payout_transactions.sql`

### Frontend Files Created:
1. `src/retailer/pages/Payout.jsx`

### Files Modified:
1. `backend-java/src/main/resources/application.yml` - Added QuickZaps configuration
2. `backend-java/.env.example` - Added payout environment variables
3. `src/services/apiService.js` - Added payoutService
4. `src/App.jsx` - Added payout route

## License
This integration is part of the Rupiksha platform.