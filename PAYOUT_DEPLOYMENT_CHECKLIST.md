# Payout API Deployment Checklist

## 🚀 Deployment Status

Your payout integration code has been pushed to GitHub and will automatically deploy to:
- **Frontend**: Vercel (auto-deploys from main branch)
- **Backend**: Render (auto-deploys from main branch)
- **Database**: Supabase (PostgreSQL)

## ✅ Pre-Deployment Checklist

### 1. Supabase Database Configuration

The database migration will run automatically when Render deploys the backend. However, verify your Supabase connection:

**Check Environment Variables on Render:**
```
DB_HOST=<your-supabase-host>.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USERNAME=postgres
DB_PASSWORD=<your-supabase-password>
```

### 2. Render Backend Environment Variables

Add these to your Render service environment variables:

```env
# QuickZaps Payout Configuration
QUICKZAPS_BASE_URL=http://login.quickzaps.io
QUICKZAPS_API_KEY=f43a15b7-1048-4ce8-b1d1-5fcb70c80230
QUICKZAPS_PAYOUT_URL=https://login.quickzaps.io/api/PayoutApi/Payoutinitiate

# Service Toggle
SERVICE_PAYOUT_ENABLED=true
```

**Steps to add on Render:**
1. Go to your Render dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Add the above variables
5. Click "Save Changes"
6. Render will automatically redeploy

### 3. Vercel Frontend Configuration

Vercel will automatically deploy from the main branch. No additional configuration needed for the payout feature.

**Verify CORS settings** in your backend `application.yml`:
```yaml
app:
  cors:
    allowed-origins: https://your-vercel-domain.vercel.app,https://rupiksha.in
```

## 📋 Post-Deployment Verification

### 1. Check Backend Deployment

Once Render finishes deploying, verify:

**Health Check:**
```bash
curl https://your-backend.onrender.com/api/v1/payout/health
```

Expected response:
```json
{
  "status": "UP",
  "service": "Payout Service"
}
```

### 2. Check Database Migration

Connect to Supabase and verify the table was created:

1. Go to Supabase Dashboard
2. Select your project
3. Go to "Table Editor"
4. Look for `payout_transactions` table
5. Or run SQL query:
```sql
SELECT * FROM flyway_schema_history WHERE version = '16';
```

### 3. Check Frontend Deployment

1. Go to your Vercel dashboard
2. Verify the deployment succeeded
3. Visit: `https://your-domain.vercel.app/payout`
4. You should see the payout form

### 4. Test API Integration

**Generate Order ID (requires authentication):**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://your-backend.onrender.com/api/v1/payout/generate-order-id
```

## 🔧 Troubleshooting

### Backend Not Deploying

1. Check Render logs:
   - Go to Render dashboard
   - Select your service
   - Click "Logs" tab
   - Look for errors

2. Common issues:
   - Database connection failed → Check Supabase credentials
   - Migration failed → Check Flyway logs
   - Build failed → Check Java version (should be 17+)

### Database Migration Failed

If migration doesn't run automatically:

1. Connect to Supabase SQL Editor
2. Run the migration manually:
```sql
-- Copy content from backend-java/src/main/resources/db/migration/V16__payout_transactions.sql
-- and execute it
```

### Frontend Not Showing Payout Page

1. Check Vercel deployment logs
2. Verify the route is accessible: `/payout`
3. Check browser console for errors
4. Verify you're logged in as a RETAILER

## 🔐 Security Checklist

- [ ] QuickZaps API key is set in Render environment variables
- [ ] Database credentials are secure (not in code)
- [ ] CORS is configured for your production domain
- [ ] HTTPS is enabled on all services
- [ ] JWT authentication is working

## 📊 Monitoring

### Check These After Deployment:

1. **Backend Logs** (Render):
   - Look for "Payout Service" startup messages
   - Check for any errors in logs

2. **Database** (Supabase):
   - Verify `payout_transactions` table exists
   - Check table has proper indexes

3. **Frontend** (Vercel):
   - Test the `/payout` route
   - Verify form validation works
   - Test transaction history

## 🎯 Testing in Production

### Test Flow:

1. **Login** to your production site
2. **Navigate** to `/payout`
3. **Fill form** with test data:
   - Amount: ₹10 (minimum for testing)
   - Use valid bank details
   - Select IMPS for instant transfer

4. **Submit** and verify:
   - Transaction appears in history
   - Status is tracked correctly
   - Response from QuickZaps is logged

### Important Notes:

⚠️ **Test with small amounts first** (₹10-₹100)
⚠️ **Verify QuickZaps API is in test/sandbox mode** if available
⚠️ **Monitor transactions** in both your database and QuickZaps dashboard

## 📝 Environment Variables Summary

### Render (Backend)
```env
# Database (Supabase)
DB_HOST=<supabase-host>.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USERNAME=postgres
DB_PASSWORD=<supabase-password>

# QuickZaps Payout
QUICKZAPS_BASE_URL=http://login.quickzaps.io
QUICKZAPS_API_KEY=f43a15b7-1048-4ce8-b1d1-5fcb70c80230
QUICKZAPS_PAYOUT_URL=https://login.quickzaps.io/api/PayoutApi/Payoutinitiate

# Service Toggle
SERVICE_PAYOUT_ENABLED=true

# CORS
CORS_ALLOWED_ORIGINS=https://your-domain.vercel.app,https://rupiksha.in
```

### Vercel (Frontend)
```env
VITE_API_URL=https://your-backend.onrender.com/api/v1
```

## 🎉 Deployment Complete!

Once all checks pass:

✅ Backend deployed on Render
✅ Frontend deployed on Vercel  
✅ Database migration applied on Supabase
✅ Payout API is live and functional

## 📞 Support

If you encounter issues:

1. Check deployment logs (Render/Vercel)
2. Verify environment variables
3. Test API endpoints manually
4. Review [`PAYOUT_INTEGRATION_README.md`](PAYOUT_INTEGRATION_README.md) for technical details
5. Check [`SETUP_INSTRUCTIONS.md`](SETUP_INSTRUCTIONS.md) for setup guidance

## 🔄 Rollback Plan

If something goes wrong:

1. **Revert Git commit:**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Or rollback on platforms:**
   - Render: Go to "Deploys" → Select previous deploy → "Redeploy"
   - Vercel: Go to "Deployments" → Select previous deploy → "Promote to Production"

---

**Last Updated**: 2026-06-12
**Version**: 1.0.0
**Status**: Ready for Production Deployment