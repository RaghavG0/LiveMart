# LiveMart Comprehensive Implementation Plan
## Prompts 16-29: Complete System Enhancement

---

## ✅ COMPLETED FEATURES

### 1. A/B Experiment System (Prompt 16)
**Status**: ✅ Complete

**Files Created**:
- `supabase/migrations/20251120120000_ab_experiment_system.sql` (600+ lines)
- `docs/AB_EXPERIMENT_SPEC.md` (Complete experiment design)

**Features Implemented**:
- Experiments table with traffic allocation & targeting
- Variant configuration with weighted randomization
- User assignment tracking
- Event tracking with properties
- Results calculation with statistical significance
- Sample experiments for timing & CTA optimization

**Key Functions**:
- `assign_user_to_experiment()` - Weighted random assignment
- `track_experiment_event()` - Event logging with timing
- `calculate_experiment_results()` - Statistical analysis
- `get_user_experiment_variant()` - Retrieve user's variant

**Experiments Ready**:
1. **Review Timing**: Immediate vs 24h vs 3 days
   - Sample size: 2,700 users (900 per variant)
   - Duration: 14 days
   - Success criteria: ≥5% lift
2. **CTA Copy**: "Rate now" vs "Help others" vs "Share experience"
   - Sample size: 3,600 users
   - Success criteria: ≥3% CTR lift

### 2. Rate Limiting & Spam Protection (Prompt 17)
**Status**: ✅ Complete

**Files Created**:
- `supabase/migrations/20251120130000_rate_limiting_spam_protection.sql` (700+ lines)
- `supabase/functions/_shared/rate-limiter.ts` (500+ lines middleware)

**Features Implemented**:
- **Rate Limiting**:
  - Per-user limits (10 writes/min default)
  - Per-IP limits (50/min default)
  - Burst protection (allow N requests then enforce rate)
  - Configurable windows (second/minute/hour/day)
  - Auto-blocking with retry-after headers

- **CAPTCHA Integration**:
  - Challenge generation after N violations
  - reCAPTCHA v3 & hCaptcha support
  - Score-based verification (0.0-1.0)
  - Token expiry (10 min default)

- **Duplicate Detection**:
  - SHA256 content hashing
  - Duplicate count tracking
  - Auto-spam flagging (≥3 duplicates)
  - Per-user fingerprinting

- **Abuse Reporting**:
  - User-submitted reports queue
  - Multiple abuse types (spam/offensive/fake/harassment)
  - Status workflow (pending→investigating→actioned)
  - Evidence attachments (screenshots, URLs)

- **Reputation System**:
  - Trust score (0-100)
  - Content quality score (0-100)
  - Behavior score (0-100)
  - Auto-suspension for low scores (<20)
  - Reputation events (helpful votes, spam reports, etc.)

**Default Limits**:
```
/submit-feedback: 10 req/min per user, 50 req/min per IP
/create-review: 5 req/hour per user
/moderate-review: 100 req/min (admin)
/flag-content: 20 req/hour per user
```

---

## 🚧 IN PROGRESS

### 3. Accessibility & Localization (Prompt 18)
**Status**: 🟡 Partially Implemented

**Remaining Tasks**:
- [ ] Add ARIA labels to all form controls
- [ ] Implement keyboard navigation (Tab, Enter, Escape)
- [ ] Create i18n files for EN + regional languages
- [ ] Add automated a11y tests (axe-core, Lighthouse)
- [ ] Ensure screen reader compatibility
- [ ] Color contrast validation (WCAG AA/AAA)

**Quick Implementation**:
```typescript
// src/i18n/en.json
{
  "review": {
    "submit": "Submit Review",
    "rating_label": "Rate your experience",
    "comment_placeholder": "Tell us about your experience...",
    "image_upload_label": "Add photos (optional)",
    "submit_success": "Review submitted successfully!",
    "submit_error": "Failed to submit review. Please try again."
  }
}

// src/components/feedback/FeedbackForm.tsx additions:
<button 
  aria-label={t('review.submit')}
  aria-describedby="submit-hint"
  role="button"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
>
  {t('review.submit')}
</button>
```

---

## 📋 REMAINING FEATURES (Prompts 19-29)

### 4. Testing Matrix (Prompt 19)
**Priority**: 🔴 High

**Deliverables Needed**:
1. **Unit Tests** (Jest/Vitest)
   - Services: Review submission, moderation, notification sending
   - Helpers: Rate limiting, spam detection, content validation
   - Utilities: Date formatting, string sanitization

2. **Integration Tests** (Supertest + Supabase)
   - API flows: Create→Moderate→List reviews
   - Authentication: JWT validation, role checks
   - Database: CRUD operations, RLS policies

3. **E2E Tests** (Cypress/Playwright)
   - User flows: Submit review → Admin approves → Review visible
   - Image upload flow
   - Abuse reporting flow
   - A/B experiment assignment

4. **Load Tests** (k6/Artillery)
   - Review submission burst (100 req/s)
   - Listing under load (1000 concurrent users)
   - Moderation queue processing

5. **Security Tests**
   - Auth bypass attempts
   - XSS injection in review text
   - SQL injection (parameterized queries)
   - CSRF protection
   - Role escalation attempts

**Sample Test Structure**:
```typescript
// tests/unit/spam-detector.test.ts
describe('SpamDetector', () => {
  it('should detect duplicate content', async () => {
    const detector = new SpamDetector(url, key);
    const result = await detector.detectDuplicate(userId, 'same text', 'review');
    expect(result.isDuplicate).toBe(true);
  });
});

// tests/integration/review-api.test.ts
describe('POST /submit-feedback', () => {
  it('should create review with valid data', async () => {
    const response = await request(app)
      .post('/submit-feedback')
      .auth(userToken, { type: 'bearer' })
      .send({ orderId, rating: 5, comment: 'Great!' });
    expect(response.status).toBe(201);
  });
});

// tests/e2e/review-flow.cy.ts
describe('Review Submission Flow', () => {
  it('should submit and display review', () => {
    cy.login('customer@example.com');
    cy.visit('/orders/123');
    cy.get('[data-testid="review-button"]').click();
    cy.get('[aria-label="Rating"]').click(5, 1); // 5 stars
    cy.get('textarea').type('Excellent product!');
    cy.get('button[type="submit"]').click();
    cy.contains('Review submitted').should('be.visible');
  });
});
```

### 5. Monitoring, SLOs & Alerts (Prompt 20)
**Priority**: 🔴 High

**Metrics to Track**:
```yaml
# Prometheus metrics
feedback_submission_rate: counter
feedback_submission_errors: counter
moderation_queue_length: gauge
moderation_approval_latency_seconds: histogram
notification_delivery_rate: counter
notification_failure_rate: counter
order_status_event_latency_seconds: histogram
```

**SLOs (Service Level Objectives)**:
- Review submission success rate: ≥99.5%
- Moderation queue processing time: p95 < 5 minutes
- Notification delivery: p99 < 30 seconds
- API latency: p95 < 200ms, p99 < 500ms

**Alerts** (Prometheus Alertmanager):
```yaml
groups:
  - name: feedback_alerts
    rules:
      - alert: ModerationQueueBacklog
        expr: moderation_queue_length > 100
        for: 1h
        annotations:
          summary: "Moderation queue has {{$value}} pending items"
      
      - alert: HighNotificationFailureRate
        expr: rate(notification_failure_rate[5m]) > 0.05
        for: 10m
        annotations:
          summary: "Notification failure rate: {{$value}}%"
      
      - alert: ReviewSubmissionErrors
        expr: rate(feedback_submission_errors[5m]) / rate(feedback_submission_rate[5m]) > 0.10
        for: 5m
        annotations:
          summary: "High review submission error rate: {{$value}}%"
```

**Grafana Dashboard Panels**:
1. Review submission rate (time series)
2. Moderation queue length (gauge)
3. Notification delivery success rate (graph)
4. API latency percentiles (heatmap)
5. Error rate by endpoint (bar chart)
6. Active experiments performance (table)

### 6. Privacy, GDPR & Data Retention (Prompt 21)
**Priority**: 🟡 Medium

**Required APIs**:
```sql
-- Function: Delete or anonymize user data
CREATE FUNCTION anonymize_user_feedback(p_user_id uuid) RETURNS void AS $$
BEGIN
  UPDATE reviews SET
    comment = '[Deleted by user]',
    user_id = '00000000-0000-0000-0000-000000000000',
    is_visible = false
  WHERE user_id = p_user_id;
  
  DELETE FROM media_uploads WHERE user_id = p_user_id;
  UPDATE profiles SET email = 'deleted_' || id::text || '@deleted.local' 
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Data Retention Policy**:
- Reviews: Keep indefinitely (unless deleted)
- Images: Keep 2 years, then archive
- Logs: Keep 90 days, then delete
- Audit trail: Keep 7 years (compliance)
- Deleted user data: Anonymize after 30 days

**Consent Logging**:
```typescript
await supabase.from('consent_log').insert({
  user_id: userId,
  consent_type: 'feedback_analytics',
  consented: true,
  consent_text: 'I agree to allow LiveMart to use my feedback for analytics',
  ip_address: req.ip,
  user_agent: req.headers['user-agent']
});
```

### 7. Rollout Plan & Feature Flags (Prompt 22)
**Priority**: 🟡 Medium

**Feature Flags**:
```typescript
// Feature flag configuration
const features = {
  feedback_api: { enabled: false, rollout_percentage: 0 },
  feedback_ui: { enabled: false, rollout_percentage: 0 },
  realtime_updates: { enabled: false },
  notifications: { enabled: false },
  ab_experiments: { enabled: false },
  rate_limiting: { enabled: true },
  spam_detection: { enabled: true }
};

// Check if feature enabled for user
function isFeatureEnabled(featureName: string, userId: string): boolean {
  const feature = features[featureName];
  if (!feature.enabled) return false;
  
  // Percentage rollout (hash userId for consistency)
  const hash = hashCode(userId) % 100;
  return hash < (feature.rollout_percentage || 100);
}
```

**Deployment Sequence**:
1. **Week 1**: Deploy migrations (flags OFF)
2. **Week 2**: Deploy backend APIs (flags OFF)
3. **Week 3**: Enable APIs in staging, test
4. **Week 4**: Canary to 5% users
5. **Week 5**: Ramp to 25% if metrics good
6. **Week 6**: Full rollout to 100%

**Rollback Procedure**:
```bash
# Immediate rollback
curl -X POST https://api.livem art.com/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"feedback_api": false}'

# Database rollback
supabase db push --dry-run  # Preview changes
supabase db reset --linked  # Reset to previous migration
```

### 8. Developer Docs & Retailer Onboarding (Prompt 23)
**Priority**: 🟢 Low (but important for launch)

**Documentation Structure**:
```
docs/
├── retailers/
│   ├── getting-started.md
│   ├── viewing-reviews.md
│   ├── responding-to-reviews.md
│   ├── best-practices.md
│   └── faq.md
├── developers/
│   ├── api-reference.md
│   ├── webhook-integration.md
│   ├── authentication.md
│   └── rate-limits.md
└── guides/
    ├── moderation-guidelines.md
    ├── abuse-reporting.md
    └── analytics-dashboard.md
```

**Onboarding Email Template**:
```html
Subject: Welcome to LiveMart Reviews! 📦

Hi {{retailer_name}},

Your LiveMart retailer account is now active! You can now:

✅ View customer reviews for your products
✅ Respond to feedback professionally
✅ Track your performance metrics
✅ Get weekly analytics reports

Quick Start Guide:
1. View Reviews: Dashboard → Reviews → Filter by product
2. Respond: Click "Reply" on any review
3. Best Practices: Keep responses under 200 words, be helpful

Resources:
- Documentation: https://docs.livemart.com/retailers
- Support: support@livemart.com
- Video Tutorial: https://livemart.com/tutorials/reviews

Questions? Our team is here to help!

The LiveMart Team
```

### 9. Performance Optimization (Prompt 24)
**Priority**: 🔴 High

**Optimizations**:
1. **Server-side aggregation**:
```sql
CREATE MATERIALIZED VIEW product_rating_summary AS
SELECT 
  product_id,
  COUNT(*) as total_reviews,
  AVG(rating) as avg_rating,
  COUNT(*) FILTER (WHERE rating = 5) as five_star,
  COUNT(*) FILTER (WHERE rating = 4) as four_star,
  MAX(created_at) as last_review_date
FROM reviews
WHERE is_visible = true AND is_approved = true
GROUP BY product_id;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY product_rating_summary;
```

2. **Lazy loading & pagination**:
```typescript
// Cursor-based pagination
async function getReviews(productId: string, cursor?: string, limit = 20) {
  let query = supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (cursor) {
    query = query.lt('created_at', cursor);
  }
  
  const { data, error } = await query;
  return { reviews: data, nextCursor: data?.[data.length - 1]?.created_at };
}
```

3. **CDN for images**:
```typescript
// Cloudflare Images or imgix
const imageUrl = `https://images.livemart.com/${imageId}/public?width=300&format=webp`;
```

4. **Redis caching**:
```typescript
// Cache hot product ratings
const cachedRating = await redis.get(`product:${productId}:rating`);
if (cachedRating) return JSON.parse(cachedRating);

const rating = await fetchRatingFromDB(productId);
await redis.setex(`product:${productId}:rating`, 300, JSON.stringify(rating));
```

**Performance Budget**:
- Initial page load: < 2 seconds
- Time to interactive: < 3 seconds
- Review list render: < 500ms
- Image load: < 1 second
- API response time: p95 < 200ms

### 10. Webhooks & SDK (Prompt 25)
**Priority**: 🟡 Medium

**Webhook Events**:
```typescript
// Event types
type WebhookEvent = 
  | 'SKU_ALERT'
  | 'FEEDBACK_SUBMITTED'
  | 'FEEDBACK_APPROVED'
  | 'FEEDBACK_FLAGGED'
  | 'ORDER_STATUS_CHANGED'
  | 'PRODUCT_RATING_UPDATED';

// Webhook payload structure
interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
  signature: string; // HMAC-SHA256
}

// HMAC signing
function signPayload(payload: object, secret: string): string {
  const message = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}
```

**Webhook Delivery**:
```typescript
// Retry policy: 3 attempts with exponential backoff
async function deliverWebhook(subscription: WebhookSubscription, payload: WebhookPayload) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LiveMart-Signature': payload.signature,
          'X-LiveMart-Event': payload.event
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        await logWebhookDelivery(subscription.id, 'success', attempt + 1);
        return;
      }
    } catch (error) {
      console.error(`Webhook delivery failed (attempt ${attempt + 1}):`, error);
    }
    
    attempt++;
    await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
  }
  
  // All retries failed
  await logWebhookDelivery(subscription.id, 'failed', maxRetries);
  await notifyWebhookFailure(subscription);
}
```

---

## 📊 IMPLEMENTATION METRICS

### Code Stats
- **Database Migrations**: 3 files, 2,000+ lines SQL
- **Edge Functions**: 13+ functions
- **Background Workers**: 6 workers
- **React Components**: 9+ components
- **Documentation**: 5 comprehensive docs
- **Tests**: 0 (needs implementation)

### Timeline Estimates
| Feature | Effort | Priority |
|---------|--------|----------|
| A/B Experiments ✅ | DONE | - |
| Rate Limiting ✅ | DONE | - |
| Accessibility | 8h | High |
| Testing Matrix | 16h | High |
| Monitoring & Alerts | 12h | High |
| Privacy & GDPR | 8h | Medium |
| Feature Flags | 6h | Medium |
| Docs & Onboarding | 10h | Low |
| Performance Optimization | 12h | High |
| Webhooks & SDK | 10h | Medium |
| **Total Remaining** | **82h** | **~2 weeks** |

---

## 🚀 RECOMMENDED NEXT STEPS

### Immediate (This Week)
1. ✅ Deploy A/B experiment migration
2. ✅ Deploy rate limiting migration
3. 🔲 Add accessibility features (ARIA labels, keyboard nav)
4. 🔲 Create basic test suite (unit + integration)
5. 🔲 Set up Prometheus metrics

### Short-term (Next 2 Weeks)
1. 🔲 Complete testing matrix (E2E, load, security)
2. 🔲 Implement feature flag system
3. 🔲 Add GDPR compliance endpoints
4. 🔲 Performance optimization (caching, pagination)
5. 🔲 Create monitoring dashboards

### Medium-term (Month 2)
1. 🔲 Build webhook system
2. 🔲 Write comprehensive documentation
3. 🔲 Conduct load testing
4. 🔲 Security audit
5. 🔲 Beta launch with 10% traffic

### Long-term (Month 3+)
1. 🔲 Full production rollout
2. 🔲 Post-launch monitoring
3. 🔲 Iterate based on metrics
4. 🔲 Add advanced features (ML moderation, sentiment analysis)

---

## 📞 SUPPORT & RESOURCES

- **Database**: PostgreSQL 14+ (Supabase)
- **Runtime**: Deno (Edge Functions), Node.js (Workers)
- **Frontend**: React 18 + TypeScript + shadcn/ui
- **Monitoring**: Prometheus + Grafana
- **Testing**: Jest, Cypress, k6
- **Docs**: Markdown in `/docs`

For questions or issues, refer to:
- Technical docs: `/docs/` directory
- API reference: `API_REFERENCE.md`
- Deployment guide: `DEPLOYMENT.md`
- Analytics guide: `ANALYTICS_DEPLOYMENT.md`
