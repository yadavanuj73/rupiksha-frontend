#!/bin/bash
# Rupiksha Database Migration Script: Supabase PostgreSQL -> AWS RDS PostgreSQL

set -e

# Supabase Credentials (Source)
SUPABASE_HOST="aws-1-ap-southeast-1.pooler.supabase.com"
SUPABASE_PORT="5432"
SUPABASE_USER="postgres.mijeckkkccbjlgbadini"
SUPABASE_DB="postgres"

# AWS RDS Credentials (Destination) - Update with your RDS Endpoint!
RDS_HOST="rupiksha-db.xxxxxx.ap-south-1.rds.amazonaws.com"
RDS_PORT="5432"
RDS_USER="postgres"
RDS_DB="rupiksha"

echo "📦 Step 1: Exporting database from Supabase..."
PGPASSWORD="${SUPABASE_PASSWORD}" pg_dump \
  --host="${SUPABASE_HOST}" \
  --port="${SUPABASE_PORT}" \
  --username="${SUPABASE_USER}" \
  --dbname="${SUPABASE_DB}" \
  --no-owner \
  --no-privileges \
  -F c \
  -f rupiksha_backup.dump

echo "✅ Database exported successfully to rupiksha_backup.dump"

echo "📥 Step 2: Restoring database into AWS RDS PostgreSQL..."
PGPASSWORD="${RDS_PASSWORD}" pg_restore \
  --host="${RDS_HOST}" \
  --port="${RDS_PORT}" \
  --username="${RDS_USER}" \
  --dbname="${RDS_DB}" \
  --no-owner \
  --role=postgres \
  rupiksha_backup.dump

echo "🎉 Database Migration Complete!"
