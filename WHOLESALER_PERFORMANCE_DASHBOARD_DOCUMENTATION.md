# Wholesaler Performance Dashboard - Implementation Documentation

## 📋 Overview

This document provides comprehensive testing guidelines, acceptance criteria, and configuration details for the Wholesaler Performance Dashboard features.

**Implementation Date**: November 19, 2025  
**Module**: Wholesaler Dashboard Extensions  
**Status**: ✅ Complete

---

## 🎯 Feature Summary

The Wholesaler Performance Dashboard extends the existing wholesaler interface with advanced product monitoring, retailer insights, and alerting capabilities.

### Core Features Delivered

1. **Aggregated SKU Feedback** - Product performance analytics across all retailers
2. **Problem SKU Alerts** - Configurable threshold-based alerting system
3. **Retailer-Level Insights** - Identify retailers with recurring product issues
4. **Order Flow Visibility** - Complete order tracking with status history and feedback
5. **Export/Reporting** - CSV export for all performance and complaint data

---

## 🔧 Configuration & Thresholds

### Alert Configuration Parameters

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `min_rating_threshold` | DECIMAL(2,1) | 3.0 | 1.0-5.0 | Minimum average rating before triggering alert |
| `negative_review_spike_threshold` | INTEGER | 5 | 1-100 | Number of 1-2 star reviews to trigger spike alert |
| `spike_time_window_days` | INTEGER | 7 | 1-90 | Days to check for negative review spike |
| `complaint_threshold` | INTEGER | 3 | 1-50 | Number of retailer complaints before alert |
| `email_notifications_enabled` | BOOLEAN | true | - | Enable/disable email notifications |
| `notification_email` | TEXT | NULL | - | Email address for alert notifications |

### How to Configure Thresholds

**Via UI:**
1. Navigate to Wholesaler Dashboard > Alerts tab
2. Click "Configure Thresholds" button
3. Adjust values in dialog
4. Click "Save Configuration"

**Via Database:**
```sql
INSERT INTO wholesaler_alert_config (
  wholesaler_id,
  min_rating_threshold,
  negative_review_spike_threshold,
  spike_time_window_days,
  complaint_threshold,
  email_notifications_enabled,
  notification_email
) VALUES (
  'your-wholesaler-uuid',
  3.0,
  5,
  7,
  3,
  true,
  'alerts@example.com'
) ON CONFLICT (wholesaler_id) DO UPDATE SET
  min_rating_threshold = EXCLUDED.min_rating_threshold,
  negative_review_spike_threshold = EXCLUDED.negative_review_spike_threshold,
  spike_time_window_days = EXCLUDED.spike_time_window_days,
  complaint_threshold = EXCLUDED.complaint_threshold,
  email_notifications_enabled = EXCLUDED.email_notifications_enabled,
  notification_email = EXCLUDED.notification_email,
  updated_at = NOW();
```

---

## ✅ Acceptance Criteria

### 1. Aggregated SKU Feedback

**AC-1.1: Data Display**
- [ ] Shows all products with at least 1 review
- [ ] Displays average rating (1-5 stars with 2 decimal precision)
- [ ] Shows total review count across all retailers
- [ ] Displays number of unique retailers selling each product
- [ ] Indicates product sentiment (positive ≥4, neutral 3-3.9, negative <3)
- [ ] Shows trend indicator (improving, stable, declining)

**AC-1.2: Time Period Filtering**
- [ ] Supports 7, 30, 90, and 365-day views
- [ ] Filters reviews based on creation date
- [ ] Updates all metrics when period changes

**AC-1.3: Sorting Options**
- [ ] Sort by rating (ascending - problems first)
- [ ] Sort by review count (descending)
- [ ] Sort by trend (declining first)

**AC-1.4: Visualizations**
- [ ] Bar chart shows rating distribution (1-5 stars)
- [ ] Sentiment overview displays positive/neutral/negative breakdown
- [ ] Summary cards show: total products, average rating, retailers reached, performance split

**AC-1.5: Alert Integration**
- [ ] Products with active alerts display alert badges
- [ ] Alert messages shown inline with product details
- [ ] Products with recent issues flagged with issue count

### 2. Problem SKU Alerts

**AC-2.1: Alert Detection**
- [ ] Low rating alert triggers when avg rating < threshold
- [ ] Negative spike alert triggers when 1-2 star reviews exceed spike threshold
- [ ] Complaint alert triggers when retailer complaints ≥ complaint threshold
- [ ] Alerts check runs correctly via database function

**AC-2.2: Alert Management**
- [ ] Active alerts displayed prominently
- [ ] Wholesaler can acknowledge alerts
- [ ] Wholesaler can mark alerts as resolved
- [ ] Wholesaler can dismiss alerts
- [ ] Alert status transitions logged correctly

**AC-2.3: Alert Details**
- [ ] Shows product name and image
- [ ] Displays alert type (low rating, negative spike, high complaints)
- [ ] Shows current value vs threshold value
- [ ] Indicates number of affected retailers
- [ ] Displays alert creation timestamp

**AC-2.4: Configuration Interface**
- [ ] Configuration dialog accessible from Alerts tab
- [ ] All threshold parameters editable
- [ ] Email notification toggle works
- [ ] Email address field appears when notifications enabled
- [ ] Configuration saves correctly to database
- [ ] Triggers alert check after config save

**AC-2.5: Email Notifications**
- [ ] Sends email to configured address when new alerts created
- [ ] Email contains alert summary and details
- [ ] Email includes direct link to dashboard
- [ ] Email only sent when notifications enabled
- [ ] Email service integration functional (or simulated)

### 3. Retailer-Level Insights

**AC-3.1: Retailer List**
- [ ] Shows all retailers who have reported issues
- [ ] Displays retailer name
- [ ] Shows total issues, active issues, and resolved issues
- [ ] Indicates number of products affected
- [ ] Shows issue type breakdown (quality, delivery, packaging, quantity, other)

**AC-3.2: Issue Filtering**
- [ ] Time period filter (7, 30, 90, 180 days)
- [ ] Can filter by resolved/unresolved status
- [ ] Sorting by issue count (most problematic first)

**AC-3.3: Detailed Issue View**
- [ ] Click retailer opens detailed dialog
- [ ] Shows all issues for that retailer
- [ ] Each issue displays: product, type, severity, status, description, dates
- [ ] Can update issue status (investigating, resolved)
- [ ] Status updates persist to database

**AC-3.4: Issue Severity**
- [ ] Severity levels: low, medium, high, critical
- [ ] Color-coded badges for each severity
- [ ] Severity influences sorting priority

### 4. Order Flow Visibility

**AC-4.1: Order List**
- [ ] Shows all retailer orders (order_type = 'retailer')
- [ ] Displays order status with color-coded badges
- [ ] Shows retailer name, order ID, item count, total amount
- [ ] Displays order creation date
- [ ] Shows number of status updates

**AC-4.2: Status Filtering**
- [ ] Filter by: all, pending, confirmed, processing, shipped, delivered, cancelled
- [ ] Count shown for each status
- [ ] Filter updates list in real-time

**AC-4.3: Order Details Dialog**
- [ ] Shows complete order information
- [ ] Lists all order items with images, quantities, prices
- [ ] Displays delivery address
- [ ] Shows order notes if present

**AC-4.4: Status History**
- [ ] Complete status history displayed chronologically
- [ ] Shows previous status → new status transitions
- [ ] Displays timestamp for each change
- [ ] Shows notes if added during status change
- [ ] Visual timeline with icons

**AC-4.5: Customer Feedback**
- [ ] Shows average rating for delivered orders with reviews
- [ ] Displays individual reviews with ratings and comments
- [ ] Links reviews to specific products in order
- [ ] Aggregates feedback across all products in order

### 5. Export/Reporting

**AC-5.1: SKU Performance Export**
- [ ] Exports all products with reviews to CSV
- [ ] Includes: product ID, name, avg rating, reviews, sentiment, trend, alerts
- [ ] Filename includes timestamp
- [ ] Download triggers browser save dialog
- [ ] CSV properly formatted (headers, escaped values)

**AC-5.2: Complaint Logs Export**
- [ ] Exports all issue reports to CSV
- [ ] Includes: issue ID, product, retailer, type, severity, status, description, dates
- [ ] Calculates "days open" for each issue
- [ ] Respects time period filter
- [ ] Can filter by resolved status

**AC-5.3: Alerts Export**
- [ ] Exports active and acknowledged alerts to CSV
- [ ] Includes: alert ID, product, type, thresholds, values, status, dates
- [ ] Calculates "days active"

**AC-5.4: Complete Report**
- [ ] Triggers all three exports in parallel
- [ ] Creates 3 separate CSV files
- [ ] Shows success notification when complete

---

## 🧪 Testing Checklist

### Database Schema Testing

- [ ] **Migration runs successfully** without errors
- [ ] **All tables created** with correct columns and types
- [ ] **Indexes created** on foreign keys and frequently queried columns
- [ ] **RLS policies active** on all new tables
- [ ] **Default alert configs created** for existing wholesalers
- [ ] **Trigger functions work** (order status history logging)
- [ ] **Database functions execute** (check_sku_performance, get_wholesaler_sku_feedback)

### Edge Functions Testing

**get-wholesaler-feedback:**
- [ ] Returns 401 for unauthenticated requests
- [ ] Returns 403 for non-wholesaler users
- [ ] Returns aggregated SKU data correctly
- [ ] Respects timePeriod query parameter
- [ ] Respects minReviews filter
- [ ] Respects sortBy parameter
- [ ] Includes active alerts in response
- [ ] Includes config in response
- [ ] Summary statistics calculated correctly

**get-wholesaler-dashboard-summary:**
- [ ] Returns dashboard metrics correctly
- [ ] Calculates order metrics for last 30 days
- [ ] Identifies products needing attention
- [ ] Counts unique and active retailers
- [ ] Aggregates feedback summary
- [ ] Provides alert breakdown
- [ ] Lists top problem products
- [ ] Shows retailers with most complaints

**send-alert-notifications:**
- [ ] Queries wholesalers with email notifications enabled
- [ ] Fetches active alerts correctly
- [ ] Skips wholesalers with no active alerts
- [ ] Generates HTML email with correct data
- [ ] Sends email via configured service (or simulates)
- [ ] Returns summary of emails sent
- [ ] Handles errors gracefully

### UI Component Testing

**AggregatedSKUFeedback:**
- [ ] Loads data on mount
- [ ] Shows loading state
- [ ] Handles empty state
- [ ] Time period selector works
- [ ] Sort selector changes order
- [ ] Charts render correctly
- [ ] Summary cards display accurate data
- [ ] Product list shows all details
- [ ] Alert badges appear for flagged products
- [ ] Images load or show placeholder

**ProblemSKUAlerts:**
- [ ] Loads alerts on mount
- [ ] Shows loading state
- [ ] Handles empty state (all clear message)
- [ ] Critical vs warning styling correct
- [ ] Acknowledge button works
- [ ] Resolve button works
- [ ] Dismiss button works
- [ ] Status updates persist
- [ ] Configuration dialog opens
- [ ] Configuration saves successfully
- [ ] Triggers alert check after save

**RetailerInsights:**
- [ ] Loads retailer data on mount
- [ ] Shows loading state
- [ ] Handles empty state
- [ ] Time period filter works
- [ ] Issue breakdown displays correctly
- [ ] Click retailer opens dialog
- [ ] Dialog shows all issues
- [ ] Status update buttons work
- [ ] Issue severity color-coded
- [ ] Counts accurate

**WholesalerOrderFlow:**
- [ ] Loads orders on mount
- [ ] Shows loading state
- [ ] Handles empty state
- [ ] Status filter works
- [ ] Status counts accurate
- [ ] Click order opens dialog
- [ ] Order details complete
- [ ] Status history displays correctly
- [ ] Customer feedback shown if exists
- [ ] Reviews linked to products

**Enhanced WholesalerDashboard:**
- [ ] All tabs render correctly
- [ ] Navigation between tabs works
- [ ] Export dropdown menu opens
- [ ] Export options trigger correctly
- [ ] Legacy components still accessible
- [ ] Tab layout responsive on mobile

### Export Functionality Testing

- [ ] SKU performance export downloads
- [ ] Complaint logs export downloads
- [ ] Alerts export downloads
- [ ] Complete report creates 3 files
- [ ] CSV files properly formatted
- [ ] Headers correct
- [ ] Data values accurate
- [ ] Special characters escaped
- [ ] Filenames include timestamp
- [ ] Toast notifications appear

### Integration Testing

- [ ] **Wholesaler can configure thresholds** and see alerts update
- [ ] **New reviews trigger alert checks** when thresholds breached
- [ ] **Retailer issue reports** appear in insights immediately
- [ ] **Order status changes** logged to history table
- [ ] **Reviews link** to correct orders in order flow
- [ ] **Alerts link** to correct products in analytics
- [ ] **Export includes** latest data after changes

### Performance Testing

- [ ] **Large datasets** (100+ products, 1000+ reviews) load within 3 seconds
- [ ] **Pagination** or infinite scroll for large lists (if implemented)
- [ ] **Database queries optimized** with proper indexes
- [ ] **Edge functions respond** within 5 seconds
- [ ] **CSV exports** complete for 1000+ records
- [ ] **Real-time updates** don't cause lag

### Security Testing

- [ ] **RLS policies prevent** unauthorized data access
- [ ] **Edge functions verify** user authentication
- [ ] **API endpoints reject** cross-tenant requests
- [ ] **SQL injection protected** (using parameterized queries)
- [ ] **XSS prevented** (input sanitization)
- [ ] **CSRF tokens** if needed (Supabase handles this)

---

## 📊 Database Schema Reference

### New Tables

1. **sku_performance_alerts**
   - Stores alerts when products breach thresholds
   - Tracks alert status lifecycle
   - Links to products and wholesalers

2. **wholesaler_alert_config**
   - Per-wholesaler threshold configuration
   - Email notification preferences
   - One config per wholesaler

3. **retailer_issue_reports**
   - Tracks quality/delivery issues reported by retailers
   - Links to products, wholesalers, retailers, orders
   - Severity and status tracking

4. **order_status_history**
   - Audit trail of all order status changes
   - Links to orders and users who made changes
   - Timestamped for analytics

### Key Database Functions

1. **check_sku_performance()**
   - Scans all wholesaler products
   - Calculates metrics (avg rating, negative reviews, retailer complaints)
   - Creates/updates alerts when thresholds breached
   - Should be called periodically (cron job every 6 hours)

2. **get_wholesaler_sku_feedback(_wholesaler_id UUID, _time_period_days INTEGER)**
   - Returns aggregated feedback for all wholesaler products
   - Joins wholesaler products → retailer orders → retailer products → reviews
   - Calculates trends by comparing first half vs second half of time period
   - Returns JSON with retailer complaint data

### Indexes Created

- `idx_sku_alerts_wholesaler_status` - Fast alert queries by wholesaler
- `idx_sku_alerts_product` - Fast alert queries by product
- `idx_sku_alerts_created_at` - Time-based queries
- `idx_retailer_issues_wholesaler` - Fast issue queries by wholesaler
- `idx_retailer_issues_retailer` - Fast issue queries by retailer
- `idx_retailer_issues_product` - Fast issue queries by product
- `idx_order_history_order_id` - Fast history retrieval

---

## 🚀 Deployment Instructions

### 1. Apply Database Migration

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push migration
supabase db push

# Verify migration
supabase db diff --schema public
```

### 2. Deploy Edge Functions

```bash
# Deploy all new functions
supabase functions deploy get-wholesaler-feedback
supabase functions deploy get-wholesaler-dashboard-summary
supabase functions deploy send-alert-notifications

# Set environment variables (if using email service)
supabase secrets set SENDGRID_API_KEY=your_key_here
```

### 3. Configure Cron Job (Optional)

For automatic alert checks and email sending:

```sql
-- In Supabase Dashboard SQL Editor
SELECT cron.schedule(
  'check-sku-performance-alerts',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT check_sku_performance();
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-alert-notifications',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

### 4. Build & Deploy Frontend

```bash
# Build the React app
npm run build

# Deploy to Vercel
vercel --prod

# Or deploy to your hosting service
```

### 5. Test in Production

1. **Create test alerts** by setting low thresholds
2. **Submit test issue reports** via UI
3. **Trigger alert check** manually
4. **Verify email delivery** (if configured)
5. **Test export functionality** with real data

---

## 🐛 Known Issues & Limitations

1. **Email Service Integration**: Currently simulated. Requires integration with SendGrid, AWS SES, Resend, or similar service.

2. **Review Matching**: Links reviews to wholesaler products by name matching. If retailers rename products, reviews won't be matched. Consider adding a `source_product_id` field to track lineage.

3. **Large Dataset Performance**: With 10,000+ reviews, aggregation queries may slow down. Consider adding materialized views or caching layer.

4. **Real-time Updates**: Components don't automatically refresh when data changes. Consider adding Supabase Realtime subscriptions for live updates.

5. **Mobile Responsiveness**: Dashboard optimized for desktop. Some tables may require horizontal scrolling on mobile devices.

---

## 📈 Future Enhancements

1. **Predictive Analytics** - ML model to predict which products will have issues
2. **Automated Responses** - AI-generated reply suggestions for issue reports
3. **Comparison Tools** - Compare performance across time periods or product categories
4. **Custom Dashboards** - Drag-and-drop widget builder
5. **Webhook Integrations** - Send alerts to Slack, Discord, or custom webhooks
6. **Advanced Filtering** - Multi-select filters, saved filter presets
7. **Batch Operations** - Bulk acknowledge/resolve alerts
8. **Historical Trends** - Long-term trend analysis with year-over-year comparisons

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue: Alerts not triggering**
- Check alert configuration exists for wholesaler
- Verify thresholds are set correctly
- Run `SELECT check_sku_performance();` manually
- Check product has delivered orders with reviews

**Issue: Reviews not appearing in analytics**
- Verify retailer has delivered orders from wholesaler
- Check retailer has added products to their inventory
- Confirm customer reviews exist on retailer's products
- Verify product names match exactly

**Issue: Email notifications not sending**
- Check email_notifications_enabled = true
- Verify notification_email is set
- Check edge function logs for errors
- Confirm email service API key configured

**Issue: Export downloads empty CSV**
- Verify data exists in time period
- Check browser console for errors
- Ensure pop-up blocker isn't preventing download
- Try with smaller data set first

### Debug SQL Queries

```sql
-- Check alert configuration
SELECT * FROM wholesaler_alert_config 
WHERE wholesaler_id = 'YOUR_UUID';

-- Check active alerts
SELECT * FROM sku_performance_alerts 
WHERE wholesaler_id = 'YOUR_UUID' 
AND alert_status = 'active';

-- Check issue reports
SELECT * FROM retailer_issue_reports 
WHERE wholesaler_id = 'YOUR_UUID' 
ORDER BY created_at DESC LIMIT 10;

-- Check order status history
SELECT osh.*, o.customer_id, o.status 
FROM order_status_history osh 
JOIN orders o ON o.id = osh.order_id 
WHERE o.seller_id = 'YOUR_UUID' 
ORDER BY osh.created_at DESC LIMIT 20;

-- Manually trigger alert check
SELECT check_sku_performance();

-- Get aggregated feedback
SELECT * FROM get_wholesaler_sku_feedback('YOUR_UUID', 30);
```

---

## ✅ Sign-Off

**Implementation Complete**: ✅  
**Tested**: ⏳ Pending QA  
**Deployed**: ⏳ Pending production deployment  
**Documentation**: ✅ Complete

---

**Last Updated**: November 19, 2025  
**Version**: 1.0.0  
**Author**: AI Development Team
