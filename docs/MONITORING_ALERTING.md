# Monitoring, SLOs & Alerting Configuration

## Prometheus Metrics

### Edge Function Metrics
```typescript
// supabase/functions/_shared/metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

export const metrics = {
  // Request metrics
  httpRequestsTotal: new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'endpoint', 'status']
  }),
  
  httpRequestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'endpoint'],
    buckets: [0.1, 0.3, 0.5, 1, 3, 5, 10]
  }),
  
  // Feedback metrics
  feedbackSubmissionsTotal: new Counter({
    name: 'feedback_submissions_total',
    help: 'Total feedback submissions',
    labelNames: ['status', 'product_id']
  }),
  
  feedbackSubmissionErrors: new Counter({
    name: 'feedback_submission_errors_total',
    help: 'Total feedback submission errors',
    labelNames: ['error_type']
  }),
  
  // Moderation metrics
  moderationQueueLength: new Gauge({
    name: 'moderation_queue_length',
    help: 'Number of pending reviews in moderation queue'
  }),
  
  moderationApprovalLatency: new Histogram({
    name: 'moderation_approval_latency_seconds',
    help: 'Time from submission to approval',
    buckets: [60, 300, 900, 3600, 86400] // 1m, 5m, 15m, 1h, 1d
  }),
  
  moderationActionsTotal: new Counter({
    name: 'moderation_actions_total',
    help: 'Total moderation actions',
    labelNames: ['action'] // approve, reject, flag
  }),
  
  // Notification metrics
  notificationsDelivered: new Counter({
    name: 'notifications_delivered_total',
    help: 'Total notifications delivered',
    labelNames: ['channel', 'type']
  }),
  
  notificationFailures: new Counter({
    name: 'notification_failures_total',
    help: 'Total notification failures',
    labelNames: ['channel', 'type', 'error']
  }),
  
  notificationDeliveryLatency: new Histogram({
    name: 'notification_delivery_latency_seconds',
    help: 'Notification delivery time',
    buckets: [1, 5, 10, 30, 60, 300]
  }),
  
  // Webhook metrics
  webhookDeliveriesTotal: new Counter({
    name: 'webhook_deliveries_total',
    help: 'Total webhook deliveries',
    labelNames: ['event_type', 'status']
  }),
  
  webhookDeliveryLatency: new Histogram({
    name: 'webhook_delivery_latency_seconds',
    help: 'Webhook delivery time',
    buckets: [0.1, 0.5, 1, 5, 10, 30]
  }),
  
  // Rate limiting metrics
  rateLimitHits: new Counter({
    name: 'rate_limit_hits_total',
    help: 'Rate limit violations',
    labelNames: ['endpoint', 'limit_type']
  }),
  
  // Experiment metrics
  experimentAssignments: new Counter({
    name: 'experiment_assignments_total',
    help: 'A/B test assignments',
    labelNames: ['experiment', 'variant']
  }),
  
  experimentConversions: new Counter({
    name: 'experiment_conversions_total',
    help: 'A/B test conversions',
    labelNames: ['experiment', 'variant', 'event']
  }),
  
  // Cache metrics
  cacheHits: new Counter({
    name: 'cache_hits_total',
    help: 'Cache hits'
  }),
  
  cacheMisses: new Counter({
    name: 'cache_misses_total',
    help: 'Cache misses'
  })
};

// Usage in edge functions
export function recordRequest(method: string, endpoint: string, status: number, durationMs: number) {
  metrics.httpRequestsTotal.inc({ method, endpoint, status });
  metrics.httpRequestDuration.observe({ method, endpoint }, durationMs / 1000);
}
```

## Grafana Dashboards

### Main Dashboard JSON
```json
{
  "dashboard": {
    "title": "LiveMart Reviews - Main Dashboard",
    "panels": [
      {
        "title": "Review Submission Rate",
        "targets": [
          {
            "expr": "rate(feedback_submissions_total[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Moderation Queue Length",
        "targets": [
          {
            "expr": "moderation_queue_length"
          }
        ],
        "type": "gauge",
        "alert": {
          "conditions": [
            {
              "evaluator": { "type": "gt", "params": [100] },
              "operator": { "type": "and" },
              "query": { "params": ["A", "5m", "now"] },
              "reducer": { "type": "avg" }
            }
          ]
        }
      },
      {
        "title": "API Latency (P50, P95, P99)",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P50"
          },
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P99"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Success Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"2..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100"
          }
        ],
        "type": "singlestat"
      },
      {
        "title": "Notification Delivery Rate",
        "targets": [
          {
            "expr": "rate(notifications_delivered_total[5m])"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Rate Limit Violations",
        "targets": [
          {
            "expr": "sum by (endpoint) (rate(rate_limit_hits_total[5m]))"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

## Alert Rules (Prometheus Alertmanager)

```yaml
# prometheus/alerts.yml
groups:
  - name: reviews_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            / 
            sum(rate(http_requests_total[5m]))
          ) > 0.05
        for: 5m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"
          runbook: "https://wiki.livemart.com/runbooks/high-error-rate"
      
      # Moderation queue backlog
      - alert: ModerationQueueBacklog
        expr: moderation_queue_length > 100
        for: 1h
        labels:
          severity: warning
          team: moderation
        annotations:
          summary: "Moderation queue has {{ $value }} pending reviews"
          description: "Queue has been above 100 for over 1 hour"
      
      # Critical moderation backlog
      - alert: ModerationQueueCritical
        expr: moderation_queue_length > 500
        for: 15m
        labels:
          severity: critical
          team: moderation
        annotations:
          summary: "CRITICAL: {{ $value }} reviews pending moderation"
          description: "Immediate action required"
      
      # High notification failure rate
      - alert: HighNotificationFailureRate
        expr: |
          (
            rate(notification_failures_total[5m])
            /
            (rate(notifications_delivered_total[5m]) + rate(notification_failures_total[5m]))
          ) > 0.10
        for: 10m
        labels:
          severity: warning
          team: notifications
        annotations:
          summary: "Notification failure rate: {{ $value | humanizePercentage }}"
      
      # Slow API responses
      - alert: SlowAPIResponses
        expr: |
          histogram_quantile(0.95, 
            rate(http_request_duration_seconds_bucket[5m])
          ) > 1.0
        for: 10m
        labels:
          severity: warning
          team: backend
        annotations:
          summary: "API P95 latency is {{ $value }}s (threshold: 1s)"
      
      # Very slow API responses
      - alert: VerySlowAPIResponses
        expr: |
          histogram_quantile(0.95, 
            rate(http_request_duration_seconds_bucket[5m])
          ) > 5.0
        for: 5m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "CRITICAL: API P95 latency is {{ $value }}s"
      
      # Webhook failures
      - alert: WebhookDeliveryFailures
        expr: |
          rate(webhook_deliveries_total{status="failed"}[10m]) > 0.5
        for: 15m
        labels:
          severity: warning
          team: integrations
        annotations:
          summary: "High webhook failure rate"
      
      # Rate limit excessive hits
      - alert: ExcessiveRateLimitHits
        expr: |
          sum(rate(rate_limit_hits_total[5m])) > 10
        for: 10m
        labels:
          severity: info
          team: security
        annotations:
          summary: "High rate limit violation activity"
          description: "Potential abuse or misconfigured clients"
      
      # Low cache hit rate
      - alert: LowCacheHitRate
        expr: |
          (
            rate(cache_hits_total[5m])
            /
            (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
          ) < 0.70
        for: 15m
        labels:
          severity: warning
          team: performance
        annotations:
          summary: "Cache hit rate is {{ $value | humanizePercentage }} (target: 70%)"
```

## SLOs (Service Level Objectives)

### SLO Definitions
```yaml
# slos.yml
slos:
  - name: api_availability
    objective: 99.9%  # 43 minutes downtime per month
    measurement: |
      sum(rate(http_requests_total{status!~"5.."}[30d]))
      /
      sum(rate(http_requests_total[30d]))
  
  - name: api_latency_p95
    objective: 500ms
    measurement: |
      histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
  
  - name: moderation_sla
    objective: 95% within 5 minutes
    measurement: |
      histogram_quantile(0.95, rate(moderation_approval_latency_seconds_bucket[24h]))
  
  - name: notification_delivery
    objective: 99% success rate
    measurement: |
      sum(rate(notifications_delivered_total[24h]))
      /
      (sum(rate(notifications_delivered_total[24h])) + sum(rate(notification_failures_total[24h])))
```

### Error Budget Tracking
```sql
-- Error budget queries
-- API Error Budget (0.1% = 43 minutes/month)
SELECT 
  COUNT(*) FILTER (WHERE response_status >= 500) as errors,
  COUNT(*) as total_requests,
  ROUND(
    (COUNT(*) FILTER (WHERE response_status >= 500)::decimal / COUNT(*)) * 100,
    4
  ) as error_rate_percent,
  -- Error budget remaining
  ROUND(
    (0.1 - (COUNT(*) FILTER (WHERE response_status >= 500)::decimal / COUNT(*) * 100)) / 0.1 * 100,
    2
  ) as budget_remaining_percent
FROM http_request_logs
WHERE timestamp >= date_trunc('month', now());
```

## Runbook

### High Error Rate Response
1. **Check current status**
   ```bash
   curl https://api.livemart.com/health
   ```

2. **Check logs**
   ```bash
   kubectl logs -l app=reviews-api --tail=100
   ```

3. **Check database**
   ```sql
   SELECT pg_stat_activity.pid, state, query
   FROM pg_stat_activity
   WHERE state != 'idle';
   ```

4. **Rollback if needed**
   ```bash
   # Disable feature flag
   UPDATE feature_flags SET status = 'disabled' WHERE flag_key = 'problematic_feature';
   
   # Or rollback deployment
   kubectl rollout undo deployment/reviews-api
   ```

### Moderation Queue Backlog Response
1. **Check queue status**
   ```sql
   SELECT 
     COUNT(*) as pending_count,
     MIN(created_at) as oldest_review
   FROM reviews
   WHERE moderation_status = 'pending';
   ```

2. **Enable auto-approval temporarily**
   ```sql
   UPDATE moderation_rules 
   SET auto_approve = true 
   WHERE trust_score_threshold = 80;
   ```

3. **Scale moderators**
   - Notify moderation team
   - Add temporary moderators if needed

## Monitoring Tools

### HealthCheck Endpoint
```typescript
// supabase/functions/health/index.ts
export async function handler(req: Request) {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    storage: await checkStorage(),
    workers: await checkWorkers()
  };
  
  const healthy = Object.values(checks).every(c => c.healthy);
  
  return new Response(JSON.stringify({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  }), {
    status: healthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Uptime Monitoring
- Use: UptimeRobot, Pingdom, or Datadog Synthetics
- Monitor endpoints:
  - `GET /health` - every 1 minute
  - `POST /submit-feedback` - every 5 minutes
  - `GET /reviews?product_id=X` - every 2 minutes
- Alert channels: PagerDuty, Slack, Email

## Log Aggregation (Optional)

```yaml
# logstash.conf (if using ELK stack)
input {
  http {
    port => 5000
    codec => json
  }
}

filter {
  if [level] == "ERROR" {
    mutate {
      add_tag => ["error"]
    }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "livemart-reviews-%{+YYYY.MM.dd}"
  }
}
```

## On-Call Rotation

- Primary: Backend team (24/7)
- Secondary: DevOps team
- Escalation: Engineering Manager
- Response times:
  - P0 (Critical): 15 minutes
  - P1 (High): 1 hour
  - P2 (Medium): 4 hours
  - P3 (Low): Next business day
