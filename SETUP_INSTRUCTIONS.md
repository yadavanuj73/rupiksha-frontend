# Payout API Setup Instructions

## Prerequisites
- Java 17 or higher
- Maven 3.6+
- PostgreSQL database
- Node.js 16+ and npm
- Git

## Step-by-Step Setup

### 1. Database Setup

First, ensure PostgreSQL is running and create a database:

```sql
CREATE DATABASE rupiksha;
```

### 2. Backend Configuration

Navigate to the backend directory and create a `.env` file:

```bash
cd backend-java
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rupiksha
DB_USERNAME=postgres
DB_PASSWORD=your_password_here

# QuickZaps Payout Configuration
QUICKZAPS_API_KEY=f43a15b7-1048-4ce8-b1d1-5fcb70c80230
QUICKZAPS_PAYOUT_URL=https://login.quickzaps.io/api/PayoutApi/Payoutinitiate
```

### 3. Run Database Migrations

The migrations will run automatically when you start the Spring Boot application. Flyway is configured to handle this.

Alternatively, you can run migrations manually using Maven:

```bash
# On Windows PowerShell
cd backend-java
mvn flyway:migrate

# Or if Maven is not in PATH, use the Maven wrapper (if available)
# Note: Maven wrapper files (mvnw, mvnw.cmd) may need to be added to the project
```

### 4. Start the Backend

```bash
cd backend-java
mvn spring-boot:run
```

The backend will start on `http://localhost:8080`

**Note**: The database migration V16 (payout_transactions table) will be automatically applied on startup.

### 5. Install Frontend Dependencies

In a new terminal, navigate to the frontend directory:

```bash
cd f:/frontend
npm install
```

### 6. Start the Frontend

```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

### 7. Access the Payout Feature

1. Open your browser and go to `http://localhost:5173`
2. Login with your retailer credentials
3. Navigate to `/payout` or access it from the menu
4. You should see the payout form

## Verification Steps

### 1. Check Backend Health

```bash
curl http://localhost:8080/api/v1/payout/health
```

Expected response:
```json
{
  "status": "UP",
  "service": "Payout Service"
}
```

### 2. Check Database Migration

Connect to your PostgreSQL database and verify the table exists:

```sql
\c rupiksha
\dt payout_transactions
```

You should see the `payout_transactions` table listed.

### 3. Test API Endpoint (with authentication)

Generate an order ID:
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8080/api/v1/payout/generate-order-id
```

## Troubleshooting

### Database Connection Issues

If you see database connection errors:

1. Verify PostgreSQL is running:
   ```bash
   # Windows
   Get-Service postgresql*
   
   # Check if port 5432 is listening
   netstat -an | findstr 5432
   ```

2. Check your database credentials in `.env`

3. Ensure the database exists:
   ```sql
   psql -U postgres -l
   ```

### Migration Issues

If migrations fail:

1. Check Flyway migration history:
   ```sql
   SELECT * FROM flyway_schema_history;
   ```

2. If needed, you can manually run the migration SQL:
   ```bash
   psql -U postgres -d rupiksha -f backend-java/src/main/resources/db/migration/V16__payout_transactions.sql
   ```

### Backend Won't Start

1. Check Java version:
   ```bash
   java -version
   ```
   Should be Java 17 or higher.

2. Check if port 8080 is already in use:
   ```bash
   netstat -ano | findstr :8080
   ```

3. Review logs in `backend-java/logs/` directory

### Frontend Issues

1. Clear npm cache and reinstall:
   ```bash
   npm cache clean --force
   npm install
   ```

2. Check if port 5173 is available:
   ```bash
   netstat -ano | findstr :5173
   ```

## Alternative Setup (Without Maven Wrapper)

If you don't have Maven wrapper files, you can use system Maven:

### Install Maven (if not installed)

**Windows:**
1. Download Maven from https://maven.apache.org/download.cgi
2. Extract to `C:\Program Files\Apache\maven`
3. Add to PATH: `C:\Program Files\Apache\maven\bin`
4. Verify: `mvn -version`

### Run with System Maven

```bash
cd backend-java
mvn clean install
mvn spring-boot:run
```

## Production Deployment Notes

1. **Environment Variables**: Set all required environment variables in your production environment
2. **Database**: Use a production PostgreSQL instance with proper backups
3. **HTTPS**: Enable HTTPS for secure communication
4. **API Keys**: Use production API keys from QuickZaps
5. **CORS**: Update CORS settings in `application.yml` for your production domain
6. **Monitoring**: Set up logging and monitoring for the payout service

## Quick Start Script (Windows PowerShell)

Save this as `start-payout.ps1`:

```powershell
# Start Backend
Write-Host "Starting Backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend-java; mvn spring-boot:run"

# Wait for backend to start
Start-Sleep -Seconds 10

# Start Frontend
Write-Host "Starting Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"

Write-Host "Services starting..." -ForegroundColor Yellow
Write-Host "Backend: http://localhost:8080" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Payout Page: http://localhost:5173/payout" -ForegroundColor Cyan
```

Run with:
```bash
.\start-payout.ps1
```

## Support

For issues:
1. Check the comprehensive guide: `PAYOUT_INTEGRATION_README.md`
2. Review backend logs: `backend-java/logs/`
3. Check browser console for frontend errors
4. Verify database connectivity and migrations

## Summary

✅ Database migrations will run automatically on backend startup
✅ Backend runs on port 8080
✅ Frontend runs on port 5173
✅ Payout page accessible at `/payout`
✅ All API endpoints are secured with JWT authentication

The payout system is now ready to use!