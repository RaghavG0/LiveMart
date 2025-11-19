# 📡 Wholesaler Dashboard API Reference

Quick reference for all API endpoints and database functions.

---

## Edge Functions

### 1. GET Wholesaler Feedback
**Endpoint**: `/functions/v1/get-wholesaler-feedback/{wholesaler_id}/feedback`

**Query Parameters**:
- `timePeriod` (integer, optional): Days to look back (default: 90)
- `minReviews` (integer, optional): Minimum reviews to include product (default: 1)
- `sortBy` (string, optional): 'rating' | 'reviews' | 'trend' (default: 'rating')

**Response**:
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "product_id": "uuid",
        "product_name": "string",
        "product_image_url": "string",
        "avg_rating": 3.45,
        "total_reviews": 23,
        "positive_reviews": 12,
        "negative_reviews": 5,
        "retailers_count": 8,
        "recent_issues_count": 2,
        "trend": "declining",
        "sentiment": "neutral",
        "has_alerts": true,
        "active_alerts": [...]
      }
    ],
    "alerts": [...],
    "config": {...},
    "summary": {
      "total_products": 15,
      "products_with_alerts": 3,
      "avg_rating_overall": "3.67",
      "total_reviews": 234,
      "positive_products": 8,
      "neutral_products": 4,
      "negative_products": 3,
      "total_retailers": 25
    }
  }
}
```

---

### 2. GET Dashboard Summary
**Endpoint**: `/functions/v1/get-wholesaler-dashboard-summary/{wholesaler_id}/dashboard/summary`

**Response**:
```json
{
  "success": true,
  "data": {
    "alerts": {
      "total_active": 5,
      "breakdown": {
        "low_rating": 2,
        "negative_spike": 2,
        "complaint_threshold": 1
      },
      "critical_products": [...]
    },
    "orders": {
      "total_orders": 45,
      "total_revenue": 12540.50,
      "pending_orders": 3,
      "delivered_orders": 38,
      "cancelled_orders": 2,
      "avg_order_value": "278.68"
    },
    "retailers": {
      "total_retailers": 18,
      "active_last_30_days": 12,
      "top_complainers": [...]
    },
    "feedback": {
      "total_products_with_reviews": 15,
      "avg_rating": "3.67",
      "total_reviews": 156,
      "products_trending_down": 3
    },
    "quality_metrics": {
      "products_needing_attention": 5,
      "recent_issues_count": 8,
      "products_below_threshold": 2,
      "negative_review_spikes": 2
    }
  }
}
```

---

### 3. POST Send Alert Notifications
**Endpoint**: `/functions/v1/send-alert-notifications`

**Request**: No body required (triggered by cron or manually)

**Response**:
```json
{
  "success": true,
  "emails_sent": 3,
  "results": [
    {
      "wholesaler_id": "uuid",
      "status": "sent",
      "alert_count": 2,
      "email": "alerts@example.com"
    },
    {
      "wholesaler_id": "uuid",
      "status": "skipped",
      "reason": "no_active_alerts"
    }
  ]
}
```

---

## Database Functions

### 1. check_sku_performance()
**Purpose**: Scans all wholesaler products and creates alerts when thresholds breached

**Usage**:
```sql
SELECT check_sku_performance();
```

**Returns**: void  
**Side Effects**: Inserts/updates records in `sku_performance_alerts` table

**Run Frequency**: Every 6 hours via cron job

---

### 2. get_wholesaler_sku_feedback()
**Purpose**: Returns aggregated feedback for wholesaler's SKUs

**Usage**:
```sql
SELECT * FROM get_wholesaler_sku_feedback(
  'wholesaler-uuid',  -- _wholesaler_id
  90                  -- _time_period_days
);
```

**Returns**: Table with columns:
- `product_id` (UUID)
- `product_name` (TEXT)
- `product_image_url` (TEXT)
- `avg_rating` (DECIMAL)
- `total_reviews` (INTEGER)
- `positive_reviews` (INTEGER)
- `negative_reviews` (INTEGER)
- `retailers_count` (INTEGER)
- `top_complaint_retailers` (JSONB)
- `recent_issues_count` (INTEGER)
- `trend` (TEXT) - 'improving', 'stable', 'declining'

---

### 3. log_order_status_change()
**Purpose**: Trigger function that logs order status changes

**Triggered**: Automatically on UPDATE of `orders` table

**Side Effects**: Inserts record in `order_status_history` table

---

## Direct Table Access (via Supabase Client)

### Query Active Alerts
```javascript
const { data, error } = await supabase
  .from('sku_performance_alerts')
  .select('*')
  .eq('wholesaler_id', wholesalerId)
  .eq('alert_status', 'active')
  .order('created_at', { ascending: false });
```

### Query Retailer Issues
```javascript
const { data, error } = await supabase
  .from('retailer_issue_reports')
  .select(`
    *,
    products!inner(name),
    profiles!retailer_issue_reports_retailer_id_fkey(full_name)
  `)
  .eq('wholesaler_id', wholesalerId)
  .in('status', ['reported', 'investigating'])
  .order('created_at', { ascending: false });
```

### Query Order History
```javascript
const { data, error } = await supabase
  .from('order_status_history')
  .select('*')
  .eq('order_id', orderId)
  .order('created_at', { ascending: true });
```

### Update Alert Status
```javascript
const { error } = await supabase
  .from('sku_performance_alerts')
  .update({ 
    alert_status: 'acknowledged',
    acknowledged_at: new Date().toISOString()
  })
  .eq('id', alertId);
```

### Update Issue Status
```javascript
const { error } = await supabase
  .from('retailer_issue_reports')
  .update({ 
    status: 'resolved',
    resolved_at: new Date().toISOString()
  })
  .eq('id', issueId);
```

### Upsert Alert Configuration
```javascript
const { error } = await supabase
  .from('wholesaler_alert_config')
  .upsert({
    wholesaler_id: wholesalerId,
    min_rating_threshold: 3.0,
    negative_review_spike_threshold: 5,
    spike_time_window_days: 7,
    complaint_threshold: 3,
    email_notifications_enabled: true,
    notification_email: 'alerts@example.com',
    updated_at: new Date().toISOString()
  });
```

---

## Export Functions (Frontend)

### Export SKU Performance
```typescript
import { exportSKUPerformance } from '@/lib/exportUtils';

await exportSKUPerformance(wholesalerId, {
  timePeriod: 90,
  minRating: 0,
  maxRating: 5,
  productIds: ['uuid1', 'uuid2'] // optional filter
});
```

### Export Complaint Logs
```typescript
import { exportComplaintLogs } from '@/lib/exportUtils';

await exportComplaintLogs(wholesalerId, {
  timePeriod: 30,
  includeResolved: false,
  retailerIds: ['uuid1'] // optional filter
});
```

### Export Active Alerts
```typescript
import { exportActiveAlerts } from '@/lib/exportUtils';

await exportActiveAlerts(wholesalerId);
```

### Export Complete Report
```typescript
import { exportCompleteReport } from '@/lib/exportUtils';

await exportCompleteReport(wholesalerId, {
  timePeriod: 90
});
```

---

## Authentication

All API endpoints require authentication via Supabase JWT:

```typescript
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch(endpoint, {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
});
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes**:
- `200` - Success
- `401` - Unauthorized (missing/invalid auth token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `500` - Internal server error

---

## Rate Limits

No explicit rate limits configured. Supabase defaults apply:
- Edge Functions: 500 req/sec per function
- Database: Based on plan (Free: 500 req/min, Pro: Unlimited)

---

## Cron Job Setup

To automatically check alerts and send notifications:

```sql
-- Run every 6 hours
SELECT cron.schedule(
  'wholesaler-alert-check',
  '0 */6 * * *',
  $$
  SELECT check_sku_performance();
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-alert-notifications',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

---

**Quick Links**:
- [Main Documentation](./WHOLESALER_PERFORMANCE_DASHBOARD_DOCUMENTATION.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Supabase Dashboard](https://supabase.com/dashboard)
