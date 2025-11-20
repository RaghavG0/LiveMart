# Comprehensive Testing Plan

## Test Strategy

### 1. Unit Tests (Jest/Vitest)

#### Review Service Tests
```typescript
// tests/unit/review-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ReviewService } from '@/services/review-service';

describe('ReviewService', () => {
  let service: ReviewService;
  
  beforeEach(() => {
    service = new ReviewService();
  });
  
  describe('validateReviewData', () => {
    it('should accept valid review data', () => {
      const data = {
        rating: 5,
        comment: 'Great product!',
        orderId: 'uuid',
        productId: 'uuid'
      };
      expect(service.validateReviewData(data)).toBe(true);
    });
    
    it('should reject invalid rating', () => {
      const data = { rating: 6, comment: 'Test' };
      expect(() => service.validateReviewData(data)).toThrow('Invalid rating');
    });
    
    it('should reject short comments', () => {
      const data = { rating: 5, comment: 'Hi' };
      expect(() => service.validateReviewData(data)).toThrow('Comment too short');
    });
  });
  
  describe('calculateSentiment', () => {
    it('should detect positive sentiment', () => {
      const comment = 'Amazing product! Love it!';
      expect(service.calculateSentiment(comment)).toBeGreaterThan(0.5);
    });
    
    it('should detect negative sentiment', () => {
      const comment = 'Terrible quality, very disappointed';
      expect(service.calculateSentiment(comment)).toBeLessThan(0);
    });
  });
});
```

#### Rate Limiter Tests
```typescript
// tests/unit/rate-limiter.test.ts
import { describe, it, expect } from 'vitest';
import { RateLimiter } from '@/lib/rate-limiter';

describe('RateLimiter', () => {
  it('should allow requests within limit', async () => {
    const limiter = new RateLimiter(url, key);
    const result = await limiter.checkLimit('user-1', '127.0.0.1', '/submit');
    expect(result.allowed).toBe(true);
  });
  
  it('should block after exceeding limit', async () => {
    const limiter = new RateLimiter(url, key);
    // Make 11 requests (limit is 10)
    for (let i = 0; i < 11; i++) {
      await limiter.checkLimit('user-1', '127.0.0.1', '/submit');
    }
    const result = await limiter.checkLimit('user-1', '127.0.0.1', '/submit');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});
```

### 2. Integration Tests (Supertest)

```typescript
// tests/integration/review-api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';

const API_URL = process.env.SUPABASE_URL!;
const API_KEY = process.env.SUPABASE_ANON_KEY!;

describe('Review API Integration', () => {
  let authToken: string;
  let testUserId: string;
  let testProductId: string;
  let testOrderId: string;
  
  beforeAll(async () => {
    // Setup: Create test user, product, order
    const supabase = createClient(API_URL, API_KEY);
    const { data: { user } } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'password123'
    });
    authToken = user!.session!.access_token;
    testUserId = user!.id;
  });
  
  it('POST /submit-feedback - should create review with valid data', async () => {
    const response = await request(`${API_URL}/functions/v1`)
      .post('/submit-feedback')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        orderId: testOrderId,
        productId: testProductId,
        rating: 5,
        comment: 'Excellent product! Highly recommended.',
        imageIds: []
      });
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.reviewId).toBeDefined();
  });
  
  it('POST /submit-feedback - should reject without auth', async () => {
    const response = await request(`${API_URL}/functions/v1`)
      .post('/submit-feedback')
      .send({ rating: 5, comment: 'Test' });
    
    expect(response.status).toBe(401);
  });
  
  it('POST /submit-feedback - should respect rate limits', async () => {
    // Make 11 requests rapidly
    const promises = Array(11).fill(null).map(() =>
      request(`${API_URL}/functions/v1`)
        .post('/submit-feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ orderId: testOrderId, rating: 5, comment: 'Test review' })
    );
    
    const responses = await Promise.all(promises);
    const rateLimited = responses.some(r => r.status === 429);
    expect(rateLimited).toBe(true);
  });
});
```

### 3. E2E Tests (Cypress)

```typescript
// cypress/e2e/review-flow.cy.ts
describe('Review Submission Flow', () => {
  beforeEach(() => {
    cy.login('customer@example.com', 'password123');
  });
  
  it('should submit review successfully', () => {
    // Navigate to order history
    cy.visit('/orders');
    cy.contains('Order #12345').should('be.visible');
    
    // Click review button
    cy.get('[data-testid="review-button"]').first().click();
    
    // Fill review form
    cy.get('[aria-label="Rating"]').within(() => {
      cy.get('button').eq(4).click(); // 5 stars
    });
    
    cy.get('textarea[name="comment"]')
      .type('This is an excellent product. Very satisfied with my purchase!');
    
    // Upload image
    cy.get('input[type="file"]')
      .selectFile('cypress/fixtures/review-image.jpg');
    
    cy.wait(2000); // Wait for upload
    
    // Submit
    cy.get('button[type="submit"]').click();
    
    // Verify success
    cy.contains('Review submitted successfully').should('be.visible');
    cy.url().should('include', '/orders');
  });
  
  it('should show validation errors', () => {
    cy.visit('/product/123/review');
    
    // Try to submit empty form
    cy.get('button[type="submit"]').click();
    
    cy.contains('Please select a rating').should('be.visible');
    cy.contains('Please write a review').should('be.visible');
  });
  
  it('should display reviews on product page', () => {
    cy.visit('/product/123');
    
    cy.get('[data-testid="reviews-section"]').within(() => {
      cy.contains('Customer Reviews').should('be.visible');
      cy.get('.review-card').should('have.length.at.least', 1);
    });
  });
});

// cypress/e2e/moderation.cy.ts
describe('Admin Moderation', () => {
  beforeEach(() => {
    cy.login('admin@livemart.com', 'admin123');
  });
  
  it('should approve pending review', () => {
    cy.visit('/admin/moderation');
    
    cy.get('[data-testid="pending-reviews"]').within(() => {
      cy.get('.review-card').first().within(() => {
        cy.get('[data-testid="approve-button"]').click();
      });
    });
    
    cy.contains('Review approved').should('be.visible');
  });
  
  it('should bulk approve reviews', () => {
    cy.visit('/admin/moderation');
    
    // Select multiple reviews
    cy.get('input[type="checkbox"]').eq(1).check();
    cy.get('input[type="checkbox"]').eq(2).check();
    
    // Bulk approve
    cy.get('[data-testid="bulk-approve"]').click();
    cy.get('[data-testid="confirm-bulk"]').click();
    
    cy.contains('2 reviews approved').should('be.visible');
  });
});
```

### 4. Load Tests (k6)

```javascript
// tests/load/review-submission.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    'errors': ['rate<0.05'], // Error rate < 5%
  },
};

const BASE_URL = __ENV.API_URL;
const AUTH_TOKEN = __ENV.AUTH_TOKEN;

export default function () {
  const payload = JSON.stringify({
    orderId: 'test-order-id',
    productId: 'test-product-id',
    rating: Math.floor(Math.random() * 5) + 1,
    comment: `Test review ${Date.now()}`,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  };

  const res = http.post(`${BASE_URL}/functions/v1/submit-feedback`, payload, params);

  check(res, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);
}
```

```javascript
// tests/load/review-listing.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100, // 100 concurrent users
  duration: '2m',
  thresholds: {
    'http_req_duration': ['p(95)<200', 'p(99)<500'],
  },
};

const BASE_URL = __ENV.API_URL;

export default function () {
  const productId = 'test-product-id';
  
  const res = http.get(`${BASE_URL}/rest/v1/reviews?product_id=eq.${productId}&limit=20`);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has reviews': (r) => JSON.parse(r.body).length > 0,
  });
  
  sleep(Math.random() * 3); // Random think time
}
```

### 5. Security Tests

```typescript
// tests/security/auth.test.ts
describe('Authentication Security', () => {
  it('should reject requests without JWT', async () => {
    const res = await fetch(`${API_URL}/functions/v1/submit-feedback`, {
      method: 'POST',
      body: JSON.stringify({ rating: 5 })
    });
    expect(res.status).toBe(401);
  });
  
  it('should reject expired JWT', async () => {
    const expiredToken = 'expired-jwt-token';
    const res = await fetch(`${API_URL}/functions/v1/submit-feedback`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    });
    expect(res.status).toBe(401);
  });
  
  it('should prevent privilege escalation', async () => {
    const customerToken = await getCustomerToken();
    const res = await fetch(`${API_URL}/functions/v1/moderate-review`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${customerToken}` },
      body: JSON.stringify({ reviewId: 'test', action: 'approve' })
    });
    expect(res.status).toBe(403);
  });
});

// tests/security/injection.test.ts
describe('SQL Injection Prevention', () => {
  it('should sanitize SQL injection in comments', async () => {
    const maliciousComment = "'; DROP TABLE reviews; --";
    const res = await submitReview({
      rating: 5,
      comment: maliciousComment
    });
    
    expect(res.status).toBe(201);
    
    // Verify tables still exist
    const { data } = await supabase.from('reviews').select('count');
    expect(data).toBeDefined();
  });
});

// tests/security/xss.test.ts
describe('XSS Prevention', () => {
  it('should sanitize XSS in review comments', async () => {
    const xssComment = '<script>alert("XSS")</script>';
    const { data: review } = await submitReview({
      rating: 5,
      comment: xssComment
    });
    
    // Verify script tags are escaped/removed
    expect(review.comment).not.toContain('<script>');
  });
});
```

## Test Execution

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "cypress run",
    "test:e2e:open": "cypress open",
    "test:load": "k6 run tests/load/review-submission.js",
    "test:security": "vitest run tests/security",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e && npm run test:security"
  }
}
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:integration
      
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: cypress-io/github-action@v5
        with:
          start: npm run dev
          wait-on: 'http://localhost:3000'
```

## Coverage Goals

- **Unit Tests**: >80% code coverage
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: Critical user flows covered
- **Load Tests**: p95 < 500ms, p99 < 1s
- **Security Tests**: OWASP Top 10 covered
