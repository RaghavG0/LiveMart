# 🚀 Quick Start Guide - All Features

## Deployment Commands (Copy-Paste Ready)

### 1. Database Migrations
```bash
# Navigate to project
cd /Users/raghavgulati/Desktop/oop/live-mart-connect

# Run all migrations via Supabase Dashboard SQL Editor
# Copy each file content and execute in order:
# 1. supabase/migrations/20251120120000_ab_experiment_system.sql
# 2. supabase/migrations/20251120130000_rate_limiting_spam_protection.sql
# 3. supabase/migrations/20251120140000_privacy_gdpr_retention.sql
# 4. supabase/migrations/20251120150000_webhooks_partner_sdk.sql
# 5. supabase/migrations/20251120160000_performance_optimization.sql
# 6. supabase/migrations/20251120170000_feature_flags_rollout.sql
```

### 2. Environment Variables
```bash
# Add to .env
cat >> .env << 'EOF'

# Rate Limiting & CAPTCHA
RECAPTCHA_V3_SECRET_KEY=your_recaptcha_secret_key
RECAPTCHA_V3_SITE_KEY=your_recaptcha_site_key
HCAPTCHA_SECRET_KEY=your_hcaptcha_secret_key
HCAPTCHA_SITE_KEY=your_hcaptcha_site_key

# Webhooks
WEBHOOK_POLL_INTERVAL_MS=5000
WEBHOOK_BATCH_SIZE=10

# Workers
ANALYTICS_RUN_ONCE=false
EMAIL_RUN_ONCE=false
WEBHOOK_RUN_ONCE=false

# Monitoring (Optional)
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
EOF
```

### 3. Install Dependencies
```bash
npm install
# Or if needed:
npm install csv-writer @supabase/supabase-js@2
```

### 4. Start Workers
```bash
# Terminal 1: Analytics Worker
npm run worker:analytics:continuous

# Terminal 2: Email Worker  
npm run worker:weekly-emails:continuous

# Terminal 3: Webhook Worker
npm run worker:webhooks:continuous

# Or use PM2 for production:
pm2 start npm --name "analytics-worker" -- run worker:analytics:continuous
pm2 start npm --name "email-worker" -- run worker:weekly-emails:continuous
pm2 start npm --name "webhook-worker" -- run worker:webhooks:continuous
pm2 save
```

### 5. Schedule View Refresh (Cron)
```bash
# Edit crontab
crontab -e

# Add this line (refresh materialized views hourly):
0 * * * * psql "$DATABASE_URL" -c "SELECT refresh_rating_summaries();"
```

---

## Testing Commands

```bash
# Run all tests
npm run test:all

# Individual test suites
npm run test:unit           # Unit tests
npm run test:integration    # Integration tests
npm run test:e2e           # E2E with Cypress
npm run test:e2e:open      # Cypress interactive mode
npm run test:load          # Load tests with k6
npm run test:security      # Security tests

# Database tests
npm run test:analytics     # Analytics SQL tests
```

---

## Feature Flag Management

```sql
-- View all flags
SELECT flag_key, status, rollout_percentage 
FROM feature_flags;

-- Enable a feature for all users
UPDATE feature_flags 
SET status = 'enabled', rollout_percentage = 100 
WHERE flag_key = 'webhooks';

-- Gradual rollout (canary)
UPDATE feature_flags 
SET status = 'canary', rollout_percentage = 10 
WHERE flag_key = 'realtime_updates';

-- Increase rollout by 10%
SELECT increase_rollout('realtime_updates', 10, 50);

-- Disable a feature
UPDATE feature_flags 
SET status = 'disabled' 
WHERE flag_key = 'problem_feature';

-- Check if enabled for user
SELECT is_feature_enabled('webhooks', 'user-uuid');
```

---

## Monitoring Quick Checks

```sql
-- Moderation queue length
SELECT COUNT(*) as pending_reviews
FROM reviews
WHERE moderation_status = 'pending';

-- Recent error rate
SELECT 
  COUNT(*) FILTER (WHERE status >= 500) as errors,
  COUNT(*) as total,
  ROUND(COUNT(*) FILTER (WHERE status >= 500)::decimal / COUNT(*) * 100, 2) as error_rate_percent
FROM http_request_logs
WHERE timestamp >= now() - interval '1 hour';

-- Webhook health
SELECT 
  name,
  status,
  consecutive_failures,
  last_triggered_at
FROM webhook_subscriptions
WHERE status = 'active'
ORDER BY consecutive_failures DESC;

-- Cache performance
SELECT 
  'hits' as metric, COUNT(*) as count 
FROM cache_entries 
WHERE last_accessed_at >= now() - interval '1 hour'
UNION ALL
SELECT 
  'total' as metric, COUNT(*) 
FROM cache_entries;

-- A/B experiment status
SELECT 
  e.name,
  v.name as variant,
  COUNT(DISTINCT ea.user_id) as users,
  COUNT(ee.id) FILTER (WHERE ee.event_type = 'review_submitted') as conversions
FROM experiments e
JOIN experiment_variants v ON v.experiment_id = e.id
LEFT JOIN experiment_assignments ea ON ea.variant_id = v.id
LEFT JOIN experiment_events ee ON ee.assignment_id = ea.id
WHERE e.status = 'active'
GROUP BY e.name, v.name;
```

---

## Webhook Setup (For Partners)

```sql
-- Create webhook subscription
INSERT INTO webhook_subscriptions(
  user_id,
  name,
  url,
  secret_key,
  events
) VALUES (
  'your-user-uuid',
  'Production Webhook',
  'https://your-domain.com/webhooks/livemart',
  'your-secret-key-min-32-chars',
  ARRAY['FEEDBACK_SUBMITTED', 'FEEDBACK_APPROVED']::webhook_event_type[]
);

-- Verify signature (partner implementation)
const crypto = require('crypto');
const signature = req.headers['x-livemart-signature'];
const payload = JSON.stringify(req.body);
const secret = 'your-secret-key';

const expected = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

if (signature === expected) {
  // Valid webhook
  console.log('Event:', req.body.event);
  console.log('Data:', req.body.data);
}
```

---

## Privacy & GDPR Operations

```sql
-- User requests data deletion
INSERT INTO user_deletion_requests(user_id, deletion_type)
VALUES ('user-uuid', 'anonymize'); -- or 'full'

-- Export user data (GDPR)
SELECT export_user_data('user-uuid');

-- Check user consent
SELECT check_user_consent('user-uuid', 'analytics');

-- Log consent
INSERT INTO consent_log(user_id, consent_type, consented, consent_text)
VALUES (
  'user-uuid',
  'analytics',
  true,
  'I agree to analytics tracking'
);

-- Process deletion request
SELECT process_deletion_request('deletion-request-uuid');
```

---

## Performance Optimization

```sql
-- Refresh materialized views (run hourly via cron)
SELECT refresh_rating_summaries();

-- Get cached product rating (fast)
SELECT * FROM get_product_rating('product-uuid');

-- Paginated reviews (cursor-based)
SELECT * FROM paginate_reviews(
  p_product_id := 'product-uuid',
  p_cursor := NULL,  -- or timestamp from previous page
  p_limit := 20,
  p_sort_by := 'recent',  -- or 'helpful', 'rating_high'
  p_filter_rating := NULL,  -- or 1-5
  p_images_only := false
);

-- Cache operations
SELECT cache_set('product:123:rating', '{"avg": 4.5, "count": 100}'::jsonb, 300);
SELECT cache_get('product:123:rating');
SELECT cache_clear_expired();
```

---

## A/B Experiment Operations

```sql
-- Assign user to experiment
SELECT assign_user_to_experiment(
  'experiment-uuid',
  'user-uuid',
  'session-123',  -- session_id (optional)
  'mobile',       -- device_type (optional)
  'Mozilla/5.0'   -- user_agent (optional)
);

-- Track conversion event
SELECT track_experiment_event(
  'experiment-uuid',
  'user-uuid',
  'review_submitted',
  '{"rating": 5, "has_images": true, "review_length": 150}'::jsonb
);

-- Calculate results
SELECT calculate_experiment_results('experiment-uuid');

-- Get results
SELECT 
  ev.name as variant,
  er.unique_users,
  er.primary_metric_value as conversion_rate,
  er.lift_percentage,
  er.is_statistically_significant,
  er.p_value
FROM experiment_results er
JOIN experiment_variants ev ON ev.id = er.variant_id
WHERE er.experiment_id = 'experiment-uuid'
ORDER BY er.computed_at DESC, ev.name;
```

---

## Troubleshooting

### Workers Not Running
```bash
# Check if process is running
ps aux | grep worker

# Check logs
tail -f logs/workers.log

# Restart with PM2
pm2 restart all
pm2 logs
```

### Database Connection Issues
```bash
# Test connection
psql "$DATABASE_URL" -c "SELECT version();"

# Check active connections
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity;"
```

### High Error Rate
```sql
-- Check recent errors
SELECT * FROM http_request_logs 
WHERE status >= 500 
ORDER BY timestamp DESC 
LIMIT 100;

-- Disable problematic feature
UPDATE feature_flags SET status = 'disabled' WHERE flag_key = 'new_feature';
```

### Webhook Delivery Failures
```sql
-- Check failed deliveries
SELECT 
  ws.name,
  ws.url,
  wd.error_message,
  wd.triggered_at
FROM webhook_deliveries wd
JOIN webhook_subscriptions ws ON ws.id = wd.subscription_id
WHERE wd.success = false
  AND wd.triggered_at >= now() - interval '1 hour'
ORDER BY wd.triggered_at DESC;

-- Retry failed webhooks
UPDATE webhook_queue 
SET status = 'pending', next_attempt_at = now()
WHERE status = 'failed' AND attempts < 3;
```

---

## Quick Reference: File Locations

```
live-mart-connect/
├── supabase/
│   ├── migrations/
│   │   ├── 20251120120000_ab_experiment_system.sql
│   │   ├── 20251120130000_rate_limiting_spam_protection.sql
│   │   ├── 20251120140000_privacy_gdpr_retention.sql
│   │   ├── 20251120150000_webhooks_partner_sdk.sql
│   │   ├── 20251120160000_performance_optimization.sql
│   │   └── 20251120170000_feature_flags_rollout.sql
│   └── functions/
│       └── _shared/
│           └── rate-limiter.ts
├── workers/
│   ├── analytics_nightly_job.node.ts
│   ├── weekly_email_reports.node.ts
│   └── webhook_delivery_worker.node.ts
├── src/
│   ├── i18n/
│   │   ├── en.json
│   │   └── es.json
│   └── lib/
│       └── i18n.ts
└── docs/
    ├── AB_EXPERIMENT_SPEC.md
    ├── TESTING_PLAN.md
    ├── MONITORING_ALERTING.md
    ├── RETAILER_DOCUMENTATION.md
    ├── COMPREHENSIVE_IMPLEMENTATION_PLAN.md
    └── COMPLETE_IMPLEMENTATION_SUMMARY.md
```

---

## Support

- **Documentation**: `/docs` folder
- **Issues**: Create GitHub issue
- **Questions**: Refer to RETAILER_DOCUMENTATION.md

---

**Everything is ready to deploy! 🚀**
