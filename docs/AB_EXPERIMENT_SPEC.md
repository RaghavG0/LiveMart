# A/B Experiment Design: Review Request Optimization

## Experiment Overview

**Objective**: Optimize review submission rate and review quality through experimentation with timing and CTA copy.

**Hypothesis**: Delaying review requests allows customers time to use the product, leading to higher-quality reviews with more detailed feedback and images.

## Experiment 1: Review Request Timing

### Variants

| Variant | Timing | Configuration | Description |
|---------|--------|---------------|-------------|
| **Control** | Immediate | `delay_hours: 0` | Request review immediately after delivery confirmation |
| **Variant A** | 24 Hours | `delay_hours: 24` | Wait 24 hours after delivery, send reminder at 72h |
| **Variant B** | 3 Days | `delay_hours: 72` | Wait 3 days after delivery, send reminder at 7 days |

### Traffic Allocation
- 33.3% per variant
- Equal weighting across all variants
- 100% of eligible users (deliveries confirmed)

### Primary Metric
**Review Submission Rate** = (Users who submitted review) / (Users who received request) × 100

**Success Criteria**: ≥5% lift over control

### Secondary Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Review Quality Score** | Avg review length (chars) | ≥150 chars |
| **Image Attachment Rate** | % reviews with images | ≥30% |
| **Average Rating** | Mean star rating | ≥4.0 |
| **NPS Lift** | Change in NPS score | ≥5 points |
| **Time to Submit** | Hours from request to submission | < 48 hours |

### Sample Size Calculation

**Formula**: 
```
n = (Z_α/2 + Z_β)² × (p₁(1-p₁) + p₂(1-p₂)) / (p₂ - p₁)²
```

**Assumptions**:
- Baseline conversion rate (p₁): 15%
- Expected lift (MDE): 5% absolute (20% → 15%)
- Confidence level (α): 95% (Z = 1.96)
- Statistical power (β): 80% (Z = 0.84)

**Calculation**:
```
n = (1.96 + 0.84)² × (0.15×0.85 + 0.20×0.80) / (0.05)²
n = 7.84 × 0.2875 / 0.0025
n ≈ 900 per variant
```

**Total Sample Size**: 2,700 users (900 × 3 variants)

### Duration Calculation

**Assumptions**:
- Daily deliveries: 500
- Experiment eligibility: 80% (400/day)
- 3 variants: ~133 users/variant/day

**Duration**: 900 ÷ 133 = **7 days minimum**

**Recommended**: 14 days (allow for weekly cycles and edge cases)

### Success Criteria

**Primary Success**: Variant A or B achieves:
- ≥5% absolute lift in review submission rate
- p-value < 0.05 (statistically significant)
- Minimum 900 users per variant

**Secondary Success**: Winner also shows:
- Higher review quality (length + images)
- No degradation in average rating
- Positive NPS impact

---

## Experiment 2: CTA Copy Optimization

### Variants

| Variant | CTA Text | Style | Emoji | Character Count |
|---------|----------|-------|-------|-----------------|
| **Control** | "Rate now" | Short | ⭐ | 8 |
| **Variant A** | "Tell us what you think — help others" | Long | 💬 | 37 |
| **Variant B** | "Share your experience with our community" | Long | 🤝 | 41 |

### Traffic Allocation
- 33.3% per variant
- Independent of timing experiment (can run simultaneously)

### Primary Metric
**CTA Click-Through Rate** = (Users who clicked CTA) / (Users who saw CTA) × 100

**Success Criteria**: ≥3% lift over control

### Secondary Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Review Submission Rate** | % who completed after clicking | ≥70% |
| **Avg Review Length** | Mean character count | ≥150 chars |
| **Completion Rate** | % who submitted vs abandoned | ≥60% |

### Sample Size Calculation

**Assumptions**:
- Baseline CTR: 25%
- Expected lift: 3% absolute (25% → 28%)
- Confidence: 95%, Power: 80%

**Calculation**: ~1,200 users per variant = **3,600 total**

**Duration**: 3,600 ÷ 400 = **9 days minimum**

**Recommended**: 14 days

---

## Implementation Plan

### Phase 1: Setup (Week 1)

#### Database Schema
- [x] Create experiments table
- [x] Create experiment_variants table
- [x] Create experiment_assignments table
- [x] Create experiment_events table
- [x] Create experiment_results table
- [x] Add assignment and tracking functions

#### Edge Functions
```typescript
// supabase/functions/assign-experiment/index.ts
// - Check if user eligible
// - Assign to variant using weighted random
// - Return variant config

// supabase/functions/track-experiment-event/index.ts
// - Validate user assignment
// - Record event with properties
// - Update aggregations
```

#### Worker Integration
```typescript
// workers/experiment_tracker.node.ts
// - Poll for new deliveries
// - Check experiment eligibility
// - Schedule review requests based on variant
// - Track outcomes
```

### Phase 2: Integration (Week 2)

#### Update Notification Worker
```typescript
// In notification_worker.node.ts
async function sendReviewRequest(userId: string, orderId: string) {
  // 1. Check active experiments
  const timingExp = await getActiveExperiment('review_timing');
  const ctaExp = await getActiveExperiment('cta_copy');
  
  // 2. Assign user to variants
  const timingVariant = await assignUserToExperiment(timingExp.id, userId);
  const ctaVariant = await assignUserToExperiment(ctaExp.id, userId);
  
  // 3. Apply timing delay
  const delayHours = timingVariant.config.delay_hours || 0;
  if (delayHours > 0) {
    await scheduleNotification(userId, orderId, delayHours);
    return;
  }
  
  // 4. Apply CTA config
  const ctaText = ctaVariant.config.cta_text || 'Rate now';
  const emoji = ctaVariant.config.emoji || '⭐';
  
  // 5. Send notification
  await sendEmail({
    to: userEmail,
    subject: `${emoji} How was your order?`,
    body: renderTemplate('review_request', { ctaText })
  });
  
  // 6. Track event
  await trackExperimentEvent(timingExp.id, userId, 'notification_sent');
  await trackExperimentEvent(ctaExp.id, userId, 'notification_sent');
}
```

#### Update Review Submission
```typescript
// In submit-feedback/index.ts
async function submitReview(userId: string, reviewData: any) {
  // ... existing submission logic ...
  
  // Track experiment conversions
  const activeExperiments = await getActiveExperimentsForUser(userId);
  
  for (const exp of activeExperiments) {
    await trackExperimentEvent(exp.id, userId, 'review_submitted', {
      review_length: reviewData.comment?.length || 0,
      has_images: (reviewData.imageIds?.length || 0) > 0,
      rating: reviewData.rating,
      time_to_action_seconds: calculateTimeSince(exp.assigned_at)
    });
  }
}
```

### Phase 3: Launch (Week 3)

#### Pre-Launch Checklist
- [ ] Test assignment logic (verify equal distribution)
- [ ] Test event tracking (verify events recorded)
- [ ] Test results calculation (verify metrics computed)
- [ ] Verify no data leakage between experiments
- [ ] Load test (1000 assignments/min)
- [ ] Smoke test in staging

#### Launch Sequence
1. **Day 1**: Deploy schema and functions
2. **Day 2**: Deploy worker updates (feature flag OFF)
3. **Day 3**: Enable for 10% of traffic (canary)
4. **Day 4**: Monitor metrics, fix issues
5. **Day 5**: Ramp to 50% traffic
6. **Day 6**: Ramp to 100% traffic

### Phase 4: Monitor (Weeks 3-4)

#### Daily Checks
```sql
-- Check assignments distribution
SELECT 
  ev.name,
  COUNT(*) as assignments,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM experiment_assignments ea
JOIN experiment_variants ev ON ea.variant_id = ev.id
WHERE ea.experiment_id = 'timing-experiment-id'
  AND ea.assigned_at >= CURRENT_DATE
GROUP BY ev.name;

-- Check conversion rates
SELECT 
  ev.name,
  COUNT(DISTINCT ea.user_id) as users,
  COUNT(DISTINCT ee.user_id) FILTER (WHERE ee.event_type = 'review_submitted') as conversions,
  ROUND(COUNT(DISTINCT ee.user_id) FILTER (WHERE ee.event_type = 'review_submitted') * 100.0 / COUNT(DISTINCT ea.user_id), 2) as conversion_rate
FROM experiment_assignments ea
JOIN experiment_variants ev ON ea.variant_id = ev.id
LEFT JOIN experiment_events ee ON ea.id = ee.assignment_id
WHERE ea.experiment_id = 'timing-experiment-id'
GROUP BY ev.name;
```

#### Weekly Analysis
- Run `calculate_experiment_results()` function
- Check statistical significance (p-value < 0.05)
- Analyze secondary metrics
- Review qualitative feedback

### Phase 5: Decision (Week 5)

#### Analysis Criteria

**Statistical Significance**:
- p-value < 0.05
- Confidence interval doesn't cross zero
- Minimum sample size reached (900/variant)

**Practical Significance**:
- Lift meets success threshold (≥5%)
- Secondary metrics improved or neutral
- No negative user feedback

**Winner Declaration**:
1. Calculate final results
2. Run statistical tests (z-test for proportions)
3. Compare against success criteria
4. Validate with holdout group (10%)
5. Document findings

#### Rollout Decision Tree
```
Is winner statistically significant? 
  NO → Run longer or redesign
  YES ↓
  
Is lift ≥5%?
  NO → Run longer or redesign
  YES ↓
  
Are secondary metrics positive?
  NO → Investigate trade-offs
  YES ↓
  
ROLL OUT TO 100%
```

---

## Tracking Plan

### Events to Track

| Event | When | Properties | Experiment |
|-------|------|-----------|------------|
| `notification_sent` | Review request sent | `channel`, `delay_hours` | Timing |
| `notification_opened` | User opens email/push | `time_to_open_seconds` | Both |
| `cta_clicked` | User clicks review CTA | `cta_text`, `device_type` | CTA Copy |
| `review_started` | User opens review form | `source` | Both |
| `review_submitted` | Review completed | `length`, `has_images`, `rating` | Both |
| `review_abandoned` | User exits form | `field_completed` | Both |

### Implementation

```typescript
// Tracking utility
class ExperimentTracker {
  async track(userId: string, eventType: string, properties: object = {}) {
    // Get user's active experiments
    const experiments = await this.getActiveExperiments(userId);
    
    // Track event for each experiment
    for (const exp of experiments) {
      await supabase.rpc('track_experiment_event', {
        p_experiment_id: exp.id,
        p_user_id: userId,
        p_event_type: eventType,
        p_event_properties: properties
      });
    }
  }
}

// Usage in notification worker
tracker.track(userId, 'notification_sent', {
  channel: 'email',
  delay_hours: variant.config.delay_hours,
  variant_name: variant.name
});

// Usage in review submission
tracker.track(userId, 'review_submitted', {
  review_length: comment.length,
  has_images: imageIds.length > 0,
  rating: rating,
  time_to_submit_hours: (Date.now() - notificationSentAt) / 3600000
});
```

---

## Metrics Dashboard

### Real-Time Metrics (Grafana/Looker)

```sql
-- Conversion funnel by variant
WITH funnel AS (
  SELECT 
    ev.name,
    COUNT(DISTINCT ea.user_id) as assigned,
    COUNT(DISTINCT ee.user_id) FILTER (WHERE ee.event_type = 'notification_opened') as opened,
    COUNT(DISTINCT ee.user_id) FILTER (WHERE ee.event_type = 'cta_clicked') as clicked,
    COUNT(DISTINCT ee.user_id) FILTER (WHERE ee.event_type = 'review_submitted') as submitted
  FROM experiment_assignments ea
  JOIN experiment_variants ev ON ea.variant_id = ev.id
  LEFT JOIN experiment_events ee ON ea.id = ee.assignment_id
  WHERE ea.experiment_id = 'timing-exp-id'
  GROUP BY ev.name
)
SELECT 
  name,
  assigned,
  ROUND(opened * 100.0 / assigned, 2) as open_rate,
  ROUND(clicked * 100.0 / opened, 2) as ctr,
  ROUND(submitted * 100.0 / assigned, 2) as conversion_rate
FROM funnel;
```

### Key Visualizations

1. **Conversion Rate Over Time** (line chart)
2. **Variant Comparison** (bar chart)
3. **Funnel Visualization** (sankey diagram)
4. **Statistical Significance** (probability chart)
5. **Secondary Metrics Heatmap**

---

## Risk Mitigation

### Potential Risks

| Risk | Mitigation |
|------|------------|
| **Low traffic** | Extend duration or reduce variants |
| **Seasonal effects** | Run for full weeks (Mon-Sun) |
| **Selection bias** | Randomize fairly, check distribution |
| **Implementation bugs** | Thorough testing, gradual rollout |
| **External factors** | Monitor for anomalies, use control |

### Guardrail Metrics

Monitor these to ensure no harm:
- Overall review volume (shouldn't drop >10%)
- Customer satisfaction (CSAT)
- Support ticket volume
- Unsubscribe rate from notifications

### Rollback Plan

If any guardrail triggered:
1. Pause experiment (set status = 'paused')
2. Investigate root cause
3. Fix issue or redesign experiment
4. Resume or cancel

---

## Budget & Resources

### Engineering Effort
- Schema & functions: 4 hours
- Integration: 8 hours
- Testing: 4 hours
- Monitoring: 2 hours/week
- **Total**: ~20 hours

### Infrastructure Cost
- Database storage: ~10GB (negligible)
- Edge function calls: ~50K/day × 14 days = 700K (within free tier)
- Worker compute: ~$5/month

### Success ROI

**Scenario**: 5% lift in review rate
- Current: 500 deliveries/day × 15% = 75 reviews/day
- Improved: 500 × 20% = 100 reviews/day
- **Gain**: +25 reviews/day = +750/month

**Value**: More reviews = higher conversion rate = +$X revenue

---

## Conclusion

This A/B experiment provides a systematic approach to optimizing review collection with clear success criteria, comprehensive tracking, and data-driven decision making. The phased rollout ensures safety while the statistical rigor ensures valid conclusions.
