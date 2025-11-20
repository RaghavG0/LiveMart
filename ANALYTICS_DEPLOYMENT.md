# Analytics and Reporting System - Deployment Guide

## Overview
Complete analytics and reporting system for retailers/wholesalers providing:
- **Nightly Jobs**: Daily snapshots, SKU trends, complaint analysis, CSV generation
- **Scheduled Emails**: Weekly performance summaries with charts and insights
- **Ad-hoc Exports**: CSV downloads for any date range via API

## Prerequisites

1. **Database Access**: PostgreSQL connection via Supabase
2. **Node.js**: v18+ with npm (for workers)
3. **Environment Variables**: See `.env.example`

## Step 1: Install Dependencies

```bash
npm install csv-writer
```

## Step 2: Deploy Database Migrations

### Option A: Supabase Dashboard (Recommended)

1. Open https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new
2. Copy contents of `supabase/migrations/20251120110000_analytics_reporting_system.sql`
3. Paste into SQL Editor
4. Click **Run**
5. Verify success: Should see "Success. No rows returned"

### Option B: psql Command Line

```bash
psql "$DATABASE_URL" -f supabase/migrations/20251120110000_analytics_reporting_system.sql
```

### Verify Migration

```sql
-- Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'analytics_%' OR table_name LIKE '%_reports' OR table_name LIKE 'sku_trends' OR table_name LIKE 'retailer_complaints';

-- Expected: 5 tables
-- analytics_snapshots, sku_trends, retailer_complaints, scheduled_reports, report_subscriptions

-- Check functions created
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%analytics%' OR routine_name LIKE '%sku%' OR routine_name LIKE '%complaint%';

-- Expected: 7 functions
-- calculate_nps_score, generate_daily_analytics_snapshot, generate_sku_trends, 
-- analyze_retailer_complaints, get_retailer_performance_summary, get_top_skus, schedule_next_report
```

## Step 3: Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click **New bucket**
3. Name: `reports`
4. Public: ✓ (Enable public access)
5. Click **Create bucket**

### Set Bucket Policies

```sql
-- Allow authenticated users to upload their own reports
CREATE POLICY "Retailers can upload own reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access (reports can be downloaded via link)
CREATE POLICY "Public read access to reports"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'reports');
```

## Step 4: Configure Environment Variables

Create `.env` file in project root:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Analytics Worker
REPORTS_STORAGE_BUCKET=reports
OUTPUT_DIR=./reports_output
ANALYTICS_INTERVAL_MS=86400000  # 24 hours (production)
# ANALYTICS_RUN_ONCE=true  # Uncomment for testing

# Email Worker
EMAIL_SERVICE_URL=https://api.sendgrid.com/v3/mail/send  # Or your email service
EMAIL_FROM=reports@livemart.com
EMAIL_API_KEY=your_sendgrid_api_key  # If using SendGrid
EMAIL_INTERVAL_MS=604800000  # 7 days (production)
# EMAIL_RUN_ONCE=true  # Uncomment for testing
```

## Step 5: Test Workers Locally

### Test Analytics Nightly Job (Run Once)

```bash
npm run worker:analytics
```

**Expected Output:**
```
=== Starting Nightly Analytics Job ===
Processing retailer: retailer@example.com
✓ Completed: retailer@example.com (5 SKUs)
Daily snapshots generated: 1
Analyzing complaints for 1 retailers...
Processing scheduled reports...
Found 0 pending reports
=== Nightly Job Completed in 2.3s ===
```

### Test Weekly Email Worker (Run Once)

```bash
npm run worker:weekly-emails
```

**Expected Output:**
```
=== Starting Weekly Email Job ===
Found 2 subscriptions to process
Processing weekly email for retailer@example.com
✓ Email sent successfully to retailer@example.com
Success: 2/2
=== Weekly Email Job Completed in 3.1s ===
```

## Step 6: Deploy Edge Function (CSV Export API)

```bash
npx supabase functions deploy export-analytics-csv
```

### Test CSV Export Endpoint

```bash
curl -X GET "https://your-project.supabase.co/functions/v1/export-analytics-csv?start_date=2025-01-01&end_date=2025-01-31&type=summary" \
  -H "Authorization: Bearer YOUR_USER_JWT"
```

**Response:** CSV file download with headers:
```
Date,Total Orders,Total Revenue,Total Reviews,Avg Rating,NPS Score,...
2025-01-01,45,4532.50,12,4.6,45.5,...
```

## Step 7: Run Analytics Tests

```bash
npm run test:analytics
```

**Expected Output:**
```
        name         |  result   |           details            
---------------------+-----------+-----------------------------
 complaint_analysis  | ✓ PASSED  | Complaints analyzed successfully
 complaint_categories| ✓ PASSED  | Complaints categorized correctly
 nps_calculation     | ✓ PASSED  | NPS formula correct: 40%
 performance_summary | ✓ PASSED  | Summary generated with all sections
 report_scheduling   | ✓ PASSED  | Next report scheduled correctly
 ...

 total_tests | passed | failed 
-------------+--------+--------
          12 |     12 |      0
```

## Step 8: Production Deployment

### Option A: PM2 (Simple)

```bash
# Install PM2 globally
npm install -g pm2

# Start analytics worker
pm2 start npm --name "analytics-worker" -- run worker:analytics:continuous

# Start email worker
pm2 start npm --name "email-worker" -- run worker:weekly-emails:continuous

# Save configuration
pm2 save

# Setup auto-restart on boot
pm2 startup
```

### Option B: Docker (Recommended)

Create `Dockerfile.workers`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY workers/ ./workers/
COPY .env ./

CMD ["npm", "run", "worker:analytics:continuous"]
```

Build and run:

```bash
# Analytics worker
docker build -f Dockerfile.workers -t analytics-worker .
docker run -d --name analytics --env-file .env analytics-worker

# Email worker (override CMD)
docker run -d --name email-worker --env-file .env analytics-worker npm run worker:weekly-emails:continuous
```

### Option C: Cron Jobs (Alternative)

```bash
# Edit crontab
crontab -e

# Add jobs
# Analytics: Daily at 2:00 AM
0 2 * * * cd /path/to/project && npm run worker:analytics >> /var/log/analytics.log 2>&1

# Emails: Every Monday at 9:00 AM
0 9 * * 1 cd /path/to/project && npm run worker:weekly-emails >> /var/log/emails.log 2>&1
```

## Step 9: Configure Email Service

### SendGrid Setup

1. Create SendGrid account: https://sendgrid.com/
2. Generate API key: Settings → API Keys → Create API Key
3. Verify sender email: Settings → Sender Authentication
4. Update `.env`:
   ```bash
   EMAIL_SERVICE_URL=https://api.sendgrid.com/v3/mail/send
   EMAIL_API_KEY=SG.your_api_key_here
   EMAIL_FROM=verified@yourdomain.com
   ```

5. Update `workers/weekly_email_reports.node.ts` sendEmail function:
   ```typescript
   async function sendEmail(to: string, subject: string, html: string, text: string) {
     const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${Deno.env.get('EMAIL_API_KEY')}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         personalizations: [{ to: [{ email: to }] }],
         from: { email: Deno.env.get('EMAIL_FROM') },
         subject,
         content: [
           { type: 'text/plain', value: text },
           { type: 'text/html', value: html }
         ]
       })
     });
     return { success: response.ok, error: response.ok ? null : await response.text() };
   }
   ```

### AWS SES Alternative

```bash
EMAIL_SERVICE_URL=https://email.us-east-1.amazonaws.com
EMAIL_FROM=verified@yourdomain.com
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

## Step 10: Create Initial Report Subscriptions

```sql
-- Subscribe retailers to weekly reports
INSERT INTO report_subscriptions(
  retailer_id, 
  subscriber_email, 
  subscriber_name,
  weekly_reports,
  send_via_email,
  active
)
SELECT 
  id,
  email,
  COALESCE(full_name, email),
  true,
  true,
  true
FROM profiles
WHERE role IN ('retailer', 'wholesaler');
```

## Step 11: Schedule First Reports

```sql
-- Create weekly report schedules for all retailers
INSERT INTO scheduled_reports(
  retailer_id,
  report_type,
  report_frequency,
  include_sku_trends,
  include_complaints,
  next_generation_at,
  status
)
SELECT 
  id,
  'weekly_summary',
  'weekly',
  true,
  true,
  (CURRENT_DATE + INTERVAL '7 days')::timestamptz + TIME '02:00:00',
  'pending'
FROM profiles
WHERE role IN ('retailer', 'wholesaler');
```

## Monitoring and Maintenance

### Check Worker Health

```bash
# PM2
pm2 status
pm2 logs analytics-worker --lines 50

# Docker
docker ps
docker logs analytics --tail 50
docker logs email-worker --tail 50
```

### Monitor Report Generation

```sql
-- Recent report generations
SELECT 
  r.retailer_id,
  p.email,
  r.report_type,
  r.status,
  r.last_generated_at,
  r.next_generation_at,
  r.error_message
FROM scheduled_reports r
JOIN profiles p ON p.id = r.retailer_id
ORDER BY r.last_generated_at DESC NULLS LAST
LIMIT 20;

-- Failed reports
SELECT * FROM scheduled_reports 
WHERE status = 'failed' 
ORDER BY updated_at DESC;
```

### Monitor Email Deliveries

```sql
-- Email subscriptions
SELECT 
  rs.subscriber_email,
  rs.weekly_reports,
  rs.monthly_reports,
  rs.active,
  p.role
FROM report_subscriptions rs
JOIN profiles p ON p.id = rs.retailer_id
WHERE rs.active = true;

-- Check last snapshots
SELECT 
  retailer_id,
  snapshot_date,
  total_orders,
  total_revenue,
  avg_rating,
  nps_score
FROM analytics_snapshots
ORDER BY snapshot_date DESC, retailer_id
LIMIT 10;
```

## Troubleshooting

### Issue: No snapshots generated

```sql
-- Check if retailers exist
SELECT COUNT(*) FROM profiles WHERE role IN ('retailer', 'wholesaler');

-- Manually trigger snapshot
SELECT generate_daily_analytics_snapshot(
  'retailer-uuid-here'::uuid,
  CURRENT_DATE
);
```

### Issue: CSV upload fails

```bash
# Check storage bucket exists
curl "https://your-project.supabase.co/storage/v1/bucket/reports"

# Check permissions
SELECT * FROM storage.objects WHERE bucket_id = 'reports' LIMIT 5;
```

### Issue: Emails not sending

```typescript
// Test email service directly
const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: 'test@example.com' }] }],
    from: { email: process.env.EMAIL_FROM },
    subject: 'Test Email',
    content: [{ type: 'text/plain', value: 'Test content' }]
  })
});
console.log(response.status, await response.text());
```

## Performance Tuning

### Database Indexes

Already created in migration:
- `idx_analytics_snapshots_retailer_date` - Fast snapshot lookups
- `idx_sku_trends_retailer_date` - Trend queries
- `idx_retailer_complaints_period` - Complaint analysis
- `idx_scheduled_reports_next_attempt` - Report processing
- `idx_report_subscriptions_active` - Email job queries

### Worker Intervals

Adjust based on data volume:
```bash
# High volume: Run analytics every 6 hours
ANALYTICS_INTERVAL_MS=21600000

# Low volume: Run weekly instead of daily
ANALYTICS_INTERVAL_MS=604800000

# Send emails twice per week
EMAIL_INTERVAL_MS=302400000  # 3.5 days
```

## API Usage Examples

### Export Summary CSV

```bash
curl -X GET \
  "https://your-project.supabase.co/functions/v1/export-analytics-csv?start_date=2025-01-01&end_date=2025-01-31&type=summary" \
  -H "Authorization: Bearer USER_JWT" \
  -o analytics_summary.csv
```

### Export SKU Trends

```bash
curl -X GET \
  "https://your-project.supabase.co/functions/v1/export-analytics-csv?type=sku_trends&start_date=2025-01-01&end_date=2025-01-31" \
  -H "Authorization: Bearer USER_JWT" \
  -o sku_trends.csv
```

### Export All Reports (Combined)

```bash
curl -X GET \
  "https://your-project.supabase.co/functions/v1/export-analytics-csv?type=all&start_date=2025-01-01&end_date=2025-01-31" \
  -H "Authorization: Bearer USER_JWT" \
  -o complete_report.csv
```

### Get Performance Summary (JSON)

Use the RPC function directly from your app:

```typescript
const { data } = await supabase.rpc('get_retailer_performance_summary', {
  p_retailer_id: user.id,
  p_start_date: '2025-01-01',
  p_end_date: '2025-01-31'
});

console.log(data);
// {
//   period: { start_date: "2025-01-01", end_date: "2025-01-31", days: 31 },
//   overview: { total_orders: 145, total_revenue: 15234.50, ... },
//   trends: { revenue_trend: "up", rating_trend: "stable" },
//   daily_data: [...]
// }
```

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Analytics Pipeline                    │
└─────────────────────────────────────────────────────────┘

1. DATA COLLECTION (Continuous)
   ┌──────────────┐
   │   Orders     │──┐
   │ Order Items  │  ├──> Stored in PostgreSQL
   │   Reviews    │──┘
   └──────────────┘

2. NIGHTLY AGGREGATION (2:00 AM Daily)
   ┌──────────────────────────────┐
   │ analytics_nightly_job.node.ts│
   └──────────────────────────────┘
          │
          ├──> generate_daily_analytics_snapshot()
          │    ├─> analytics_snapshots (Orders, Revenue, NPS)
          │
          ├──> generate_sku_trends()
          │    ├─> sku_trends (Product performance)
          │
          ├──> analyze_retailer_complaints()
          │    ├─> retailer_complaints (Categorized issues)
          │
          └──> Generate & Upload CSVs to Storage

3. WEEKLY EMAIL DELIVERY (Monday 9:00 AM)
   ┌────────────────────────────────┐
   │ weekly_email_reports.node.ts   │
   └────────────────────────────────┘
          │
          ├──> Query report_subscriptions
          ├──> get_retailer_performance_summary()
          ├──> Generate HTML email
          └──> Send via SendGrid/SES

4. AD-HOC EXPORTS (On Demand)
   ┌──────────────────────────────┐
   │ export-analytics-csv (API)   │
   └──────────────────────────────┘
          │
          ├──> Validate user access
          ├──> Query analytics tables
          └──> Return CSV download
```

## Next Steps

1. ✅ Deploy database migration
2. ✅ Test workers locally
3. ✅ Deploy to production (PM2/Docker)
4. ✅ Configure email service
5. ✅ Create report subscriptions
6. ✅ Monitor first report generation
7. Set up alerts for failed jobs
8. Build analytics dashboard UI (React components)
9. Add PDF export capability
10. Implement data retention policies

## Support

For issues or questions:
- Check logs: `pm2 logs` or `docker logs`
- Review tests: `npm run test:analytics`
- Consult troubleshooting section above
- Verify environment variables are set correctly
