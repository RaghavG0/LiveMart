## Feedback Moderation System - Complete Documentation

### Overview

The feedback moderation system provides comprehensive tools for admin users to review, moderate, and manage user-generated reviews and feedback. The system includes automated flagging, manual moderation workflows, bulk actions, and complete audit trails.

---

## Features

### 1. **Moderation Queue**
- Centralized queue for all feedback requiring review
- Auto-queue creation for new reviews with trigger-based automation
- Priority-based sorting (higher priority = more urgent)
- Status tracking: pending, approved, rejected, flagged, escalated
- Real-time filtering by product, reviewer, date range, rating, and flags

### 2. **Moderation Actions**
- **Approve**: Mark feedback as visible publicly
- **Reject**: Hide feedback and record rejection reason
- **Edit**: Modify feedback content (original preserved in audit trail)
- **Escalate**: Tag and route to legal/ops/compliance teams
- All actions require authenticated admin user

### 3. **Auto-Moderation**
- Automatic flagging for:
  - Profanity detection
  - Spam identification
  - Duplicate content
  - Low quality reviews
  - Suspicious patterns
- Confidence scoring (0.0 - 1.0)
- Override capability for false positives
- Integration-ready for ML/AI workers

### 4. **Bulk Actions**
- Bulk approve/reject up to 100 items per request
- Rate limiting to prevent abuse
- Transaction-based processing for consistency
- Detailed result reporting (succeeded/failed counts)

### 5. **Audit Log**
- Immutable audit trail for all moderation activities
- Records: actor, timestamp, action, reason, state changes
- Searchable by review ID, actor, action type, date range
- JSONB state snapshots for before/after comparison
- No update/delete allowed (integrity enforcement)

### 6. **Access Control**
- Admin-only access enforced via RLS policies
- JWT-based authentication on all API endpoints
- Role verification before any moderation action
- Automatic session validation

---

## Architecture

### Database Schema

#### Tables

1. **moderation_queue**
   - Central queue for feedback items
   - Stores original and current content snapshots
   - Tracks status, priority, assignments
   - Auto-populated via trigger on review insert

2. **moderation_actions**
   - Records all moderation actions
   - Links to queue items and reviews
   - Stores content changes for edits
   - Escalation type tracking

3. **moderation_audit_log**
   - Immutable audit trail
   - JSONB state before/after
   - Actor information with IP tracking
   - Automatic population via trigger

4. **auto_moderation_flags**
   - Auto-detected issues
   - Confidence scores
   - Override tracking
   - Detection metadata (JSONB)

#### Functions

- `get_moderation_queue()` - Retrieve queue with filters
- `approve_feedback()` - Approve and make visible
- `reject_feedback()` - Reject and hide with reason
- `edit_feedback()` - Edit content with audit trail
- `escalate_feedback()` - Escalate to teams
- `bulk_moderate_feedback()` - Bulk approve/reject
- `get_moderation_audit_log()` - Retrieve audit trail
- `flag_for_auto_moderation()` - Create auto-flags
- `override_auto_flag()` - Override false positives

#### Triggers

- `trigger_auto_queue_review` - Auto-create queue items
- `trigger_log_moderation_action` - Auto-log to audit trail

### API Endpoints

#### 1. GET `/functions/v1/get-moderation-queue`

Retrieve moderation queue with filters.

**Query Parameters:**
```
status: pending | approved | rejected | flagged | escalated
productId: UUID
reviewerId: UUID
minPriority: integer
dateFrom: ISO8601 date
dateTo: ISO8601 date
minRating: 1-5
maxRating: 1-5
flaggedOnly: boolean
assignedTo: UUID
limit: integer (default: 100)
offset: integer (default: 0)
```

**Response:**
```json
{
  "queue": [
    {
      "queue_id": "uuid",
      "review_id": "uuid",
      "product_id": "uuid",
      "product_name": "string",
      "reviewer_id": "uuid",
      "reviewer_name": "string",
      "status": "pending",
      "priority": 10,
      "original_rating": 3,
      "original_comment": "string",
      "current_rating": 3,
      "current_comment": "string",
      "auto_flags": [
        {
          "flag_type": "spam",
          "confidence": 0.85,
          "detected_content": "string",
          "overridden": false
        }
      ],
      "created_at": "ISO8601",
      "reviewed_at": "ISO8601",
      "last_action_at": "ISO8601"
    }
  ],
  "statistics": {
    "total": 100,
    "statusCounts": {
      "pending": 50,
      "approved": 30,
      "rejected": 10,
      "flagged": 8,
      "escalated": 2
    }
  }
}
```

#### 2. POST `/functions/v1/moderate-feedback`

Execute moderation action on single item.

**Request Body:**
```json
{
  "queueItemId": "uuid",
  "action": "approve | reject | edit | escalate",
  "reason": "string (required for reject, edit, escalate)",
  "notes": "string (optional)",
  "newRating": "integer 1-5 (for edit)",
  "newComment": "string (for edit)",
  "escalationType": "legal | operations | compliance | high_priority (for escalate)"
}
```

**Response:**
```json
{
  "success": true,
  "action_id": "uuid",
  "queue_item_id": "uuid",
  "review_id": "uuid",
  "status": "approved",
  "edited": true
}
```

#### 3. POST `/functions/v1/bulk-moderate`

Bulk approve/reject multiple items.

**Request Body:**
```json
{
  "queueItemIds": ["uuid1", "uuid2"],
  "action": "approve | reject",
  "reason": "string (required for reject)",
  "notes": "string (optional)",
  "rateLimit": 100
}
```

**Response:**
```json
{
  "success": true,
  "total": 50,
  "succeeded": 48,
  "failed": 2,
  "results": [
    {
      "queue_item_id": "uuid",
      "result": {
        "success": true,
        "action_id": "uuid"
      }
    }
  ]
}
```

#### 4. GET `/functions/v1/get-audit-log`

Retrieve audit log entries.

**Query Parameters:**
```
reviewId: UUID
queueItemId: UUID
actorId: UUID
actionType: approve | reject | edit | escalate | flag | unflag
dateFrom: ISO8601 date
dateTo: ISO8601 date
limit: integer (default: 100)
offset: integer (default: 0)
```

**Response:**
```json
{
  "auditLog": [
    {
      "log_id": "uuid",
      "review_id": "uuid",
      "actor_id": "uuid",
      "actor_name": "string",
      "actor_role": "admin",
      "action_type": "approve",
      "action_summary": "string",
      "state_before": { "rating": 3, "comment": "..." },
      "state_after": { "rating": 4, "comment": "..." },
      "reason": "string",
      "notes": "string",
      "created_at": "ISO8601"
    }
  ],
  "statistics": {
    "total": 500,
    "actionCounts": {
      "approve": 300,
      "reject": 150,
      "edit": 40,
      "escalate": 10
    }
  }
}
```

---

## UI Components

### 1. AdminDashboard
- Main admin interface
- Route: `/admin`
- Access: Admin role only (automatic redirect if not admin)
- Statistics cards showing queue metrics
- Tabbed interface for queue and audit log

### 2. ModerationQueue
- Displays queue items with all metadata
- Item selection for bulk actions
- Quick action buttons (Approve, Reject, Edit, Escalate)
- Auto-flag badges with confidence scores
- Priority indicators
- Real-time status updates

### 3. ModerationFilters
- Expandable filter panel
- Filters by status, priority, rating, date, flags
- Active filter count indicator
- Reset functionality
- Apply filters with API call

### 4. ModerationActionDialog
- Modal for executing actions
- Dynamic fields based on action type
- Edit: rating selector + comment textarea
- Escalate: escalation type selector
- Reject/Edit/Escalate: reason required
- Notes optional for all actions

### 5. AuditLogViewer
- Searchable audit log table
- Filter by review ID, actor, dates
- Color-coded action badges
- Actor information with role
- Expandable state change details
- Export capability

---

## Usage Guide

### For Administrators

#### Accessing the Admin Dashboard
1. Sign in as admin user
2. Navigate to `/admin`
3. Dashboard displays automatically if authorized

#### Reviewing Queue Items
1. View pending items in Moderation Queue tab
2. Use filters to narrow down items (status, product, date, etc.)
3. Review item details, ratings, comments
4. Check auto-moderation flags if present

#### Taking Action on Single Item
1. Click action button (Approve, Reject, Edit, Escalate)
2. Fill in required fields in dialog
   - **Reject**: Provide reason (required)
   - **Edit**: Modify rating/comment + reason
   - **Escalate**: Select type + reason
   - **Approve**: Optional notes
3. Click Confirm
4. Item updates immediately

#### Bulk Actions
1. Select multiple items using checkboxes
2. Click "Bulk Approve" or "Bulk Reject"
3. For bulk reject: enter reason in prompt
4. Confirm action
5. View success/failure summary

#### Reviewing Audit Log
1. Switch to Audit Log tab
2. Use search filters (review ID, actor, dates)
3. Review action history
4. Check state before/after for edits
5. Verify moderation compliance

---

## Testing

### Running Tests

The test suite is located in `tests/moderation_system_tests.sql`.

```bash
# Connect to database
psql YOUR_DATABASE_URL

# Run test suite
\i tests/moderation_system_tests.sql
```

### Test Coverage

1. **Queue Creation** - Verifies auto-queue on review insert
2. **Approve Functionality** - Tests approval workflow
3. **Reject Functionality** - Tests rejection with reason
4. **Edit Functionality** - Verifies edit with audit trail
5. **Escalate Functionality** - Tests escalation routing
6. **Audit Log Integrity** - Verifies immutable logging
7. **Bulk Actions** - Tests bulk operations and rate limits
8. **Auto-Moderation** - Tests flagging and override
9. **RLS Policies** - Verifies admin-only access

### Expected Results

All tests should pass with output:
```
✓ PASSED - Queue item auto-created
✓ PASSED - Approve feedback works correctly
✓ PASSED - Reject feedback works correctly
✓ PASSED - Edit feedback preserves audit trail
✓ PASSED - Escalate feedback works correctly
✓ PASSED - Audit log integrity maintained
✓ PASSED - Bulk moderation and rate limits work correctly
✓ PASSED - Auto-moderation flags work correctly
✓ PASSED - RLS policies enforce admin-only access

Total: 9 tests | Passed: 9 | Failed: 0
```

---

## Deployment

### Step 1: Deploy Database Migrations

```bash
# Deploy moderation system migration
supabase db push

# Or apply specific migrations
psql YOUR_DATABASE_URL < supabase/migrations/20251119120000_feedback_moderation_system.sql
psql YOUR_DATABASE_URL < supabase/migrations/20251119120001_add_moderation_to_reviews.sql
```

### Step 2: Deploy Edge Functions

```bash
# Deploy all moderation functions
supabase functions deploy get-moderation-queue
supabase functions deploy moderate-feedback
supabase functions deploy bulk-moderate
supabase functions deploy get-audit-log
```

### Step 3: Update Type Definitions

```bash
# Regenerate types from remote database
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

### Step 4: Build and Deploy Frontend

```bash
# Build React app
npm run build

# Deploy to your hosting provider
# (Vercel, Netlify, etc.)
```

### Step 5: Run Tests

```bash
# Connect to production database (use read replica if available)
psql YOUR_PRODUCTION_DATABASE_URL

# Run test suite
\i tests/moderation_system_tests.sql
```

---

## Security Considerations

### Access Control
- All moderation endpoints require admin authentication
- RLS policies enforce database-level access control
- JWT tokens validated on every request
- Session expiration handled automatically

### Audit Trail
- All actions logged with actor identification
- State changes recorded as JSONB snapshots
- IP addresses captured for forensics
- Logs are immutable (no updates/deletes)

### Rate Limiting
- Bulk actions limited to 100 items per request
- API endpoints can be rate-limited at edge function level
- Database function enforces maximum batch size

### Data Privacy
- Original content preserved for legal compliance
- Rejected content hidden but not deleted
- Audit logs accessible only to admins
- GDPR-compliant data handling

---

## Troubleshooting

### Issue: "Forbidden - Admin access required"
**Solution**: Verify user has `admin` role in profiles table
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_ID';
```

### Issue: Queue items not appearing
**Solution**: Check if trigger is enabled
```sql
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_auto_queue_review';
-- If tgenabled is 'D' (disabled), enable it:
ALTER TABLE reviews ENABLE TRIGGER trigger_auto_queue_review;
```

### Issue: Audit log not recording actions
**Solution**: Verify trigger exists and is enabled
```sql
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_log_moderation_action';
```

### Issue: RLS blocking admin access
**Solution**: Check RLS policies
```sql
SELECT * FROM pg_policies WHERE tablename = 'moderation_queue';
-- Ensure admin policy exists and is correct
```

### Issue: Bulk actions failing
**Solution**: Check rate limit and transaction errors
```sql
-- View recent errors in logs
SELECT * FROM pg_stat_statements ORDER BY last_execution DESC LIMIT 10;
```

---

## Future Enhancements

### Planned Features
1. **ML Integration** - Automated quality scoring
2. **Sentiment Analysis** - Emotional tone detection
3. **Multi-language Support** - Translation and moderation
4. **User Appeals** - Allow users to contest rejections
5. **Moderation Metrics** - Performance dashboards
6. **Scheduled Reports** - Weekly/monthly summaries
7. **Custom Workflows** - Configurable approval chains
8. **Mobile App** - Admin moderation on mobile

### Integration Opportunities
- Slack/Discord notifications for escalations
- Email alerts for high-priority items
- Webhook support for external systems
- API for third-party moderation tools

---

## API Reference Summary

| Endpoint | Method | Purpose | Admin Only |
|----------|--------|---------|------------|
| `/functions/v1/get-moderation-queue` | GET | Retrieve queue | ✓ |
| `/functions/v1/moderate-feedback` | POST | Single action | ✓ |
| `/functions/v1/bulk-moderate` | POST | Bulk actions | ✓ |
| `/functions/v1/get-audit-log` | GET | Audit history | ✓ |

---

## Database Function Reference

| Function | Purpose | Returns |
|----------|---------|---------|
| `get_moderation_queue()` | Retrieve queue with filters | TABLE |
| `approve_feedback()` | Approve feedback | JSONB |
| `reject_feedback()` | Reject feedback | JSONB |
| `edit_feedback()` | Edit content | JSONB |
| `escalate_feedback()` | Escalate to team | JSONB |
| `bulk_moderate_feedback()` | Bulk operations | JSONB |
| `get_moderation_audit_log()` | Audit trail | TABLE |
| `flag_for_auto_moderation()` | Create flag | UUID |
| `override_auto_flag()` | Override flag | BOOLEAN |

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review test suite for examples
3. Examine audit logs for action history
4. Verify RLS policies and triggers
5. Contact development team

---

**Version**: 1.0.0  
**Last Updated**: November 19, 2025  
**Maintainer**: Development Team
