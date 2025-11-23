# Comprehensive Feedback & Review System Implementation

## Overview

This document describes the complete implementation of a comprehensive feedback and review system with:
1. **Open Review Policy** - Anyone can review products, regardless of purchase
2. **Multi-Tiered Discussion System** - Threaded replies from vendors and users
3. **Mandatory Delivery Feedback** - Automatic trigger when orders are delivered

---

## Database Schema

### 1. Reviews Table (Updated)
- `order_id` - Now **optional** (allows open reviews)
- `verified_buyer` - Boolean flag (auto-set based on order_id)
- Unique constraint: One review per (user, product, order_id or null)

### 2. Review Replies Table (Updated)
- `parent_reply_id` - For threading/nested replies
- `reply_type` - 'vendor' or 'user'
- `user_id` - For user replies
- `seller_id` - For vendor replies (nullable)

### 3. Delivery Feedback Table (New)
- `order_id` - Reference to order
- `product_quality_rating` - 1-5 stars
- `delivery_service_rating` - 1-5 stars
- `product_feedback` - Optional text
- `delivery_feedback` - Optional text

### 4. Pending Delivery Feedback Table (New)
- Tracks which users need to provide mandatory feedback
- Auto-created when order status changes to 'delivered'
- Auto-completed when feedback is submitted

---

## API Endpoints

### 1. POST `/submit-review`
**Purpose**: Submit or update a product review (open policy)

**Request Body**:
```json
{
  "productId": "uuid",
  "orderId": "uuid (optional)",
  "rating": 1-5,
  "comment": "string (optional, max 1000 chars)",
  "imageIds": ["uuid"] (optional, max 3)
}
```

**Response**:
```json
{
  "success": true,
  "message": "Review submitted successfully",
  "reviewId": "uuid"
}
```

**Features**:
- Works with or without `orderId` (open review policy)
- Auto-sets `verified_buyer` flag if order_id provided
- Updates existing review if one exists

---

### 2. POST `/submit-reply`
**Purpose**: Reply to a review or another reply (threading)

**Request Body**:
```json
{
  "reviewId": "uuid",
  "parentReplyId": "uuid (optional, for threading)",
  "replyText": "string (10-2000 chars)",
  "replyType": "vendor" | "user" (auto-detected if not provided)
}
```

**Response**:
```json
{
  "success": true,
  "message": "Reply submitted successfully",
  "replyId": "uuid",
  "createdAt": "timestamp"
}
```

**Features**:
- Supports nested replies (threading)
- Auto-detects if user is vendor or regular user
- Vendors can only reply to their own product reviews

---

### 3. GET `/check-pending-feedback`
**Purpose**: Check if user has pending delivery feedback

**Response**:
```json
{
  "success": true,
  "hasPending": true,
  "pendingOrders": [
    {
      "order_id": "uuid",
      "order_total": 123.45,
      "order_date": "timestamp",
      "delivery_address": "string"
    }
  ]
}
```

---

### 4. POST `/submit-delivery-feedback`
**Purpose**: Submit mandatory delivery feedback

**Request Body**:
```json
{
  "orderId": "uuid",
  "productQualityRating": 1-5 (optional),
  "deliveryServiceRating": 1-5 (optional),
  "productFeedback": "string (optional, max 1000 chars)",
  "deliveryFeedback": "string (optional, max 1000 chars)"
}
```

**Note**: At least one rating is required.

**Response**:
```json
{
  "success": true,
  "message": "Delivery feedback submitted successfully",
  "feedbackId": "uuid"
}
```

---

## Frontend Components

### 1. `FeedbackForm.tsx` (Updated)
- Now supports **open reviews** (orderId is optional)
- Works for all authenticated users
- Shows existing review if user already reviewed

### 2. `FeedbackList.tsx` (Updated)
- Displays **verified buyer** badge for purchasers
- Shows threaded replies below each review
- Includes product seller ID for reply permissions

### 3. `ReviewReplies.tsx` (New)
- Threaded discussion UI
- Supports vendor and user replies
- Nested reply structure
- Real-time updates

### 4. `DeliveryFeedbackModal.tsx` (New)
- Mandatory feedback form
- Product quality and delivery service ratings
- Optional text feedback
- Auto-triggers when order is delivered

### 5. `PendingFeedbackChecker.tsx` (New)
- Global component that checks for pending feedback
- Shows modal automatically when user has pending orders
- Handles multiple pending orders sequentially

---

## Workflow

### Open Review Flow
1. User visits product page
2. If authenticated, sees review form (no order required)
3. User can submit review with rating and comment
4. If `orderId` provided, review gets "Verified Buyer" badge
5. Review appears in public list with badge if verified

### Threaded Discussion Flow
1. User/vendor views review
2. Can click "Reply" to add response
3. Replies can be nested (reply to a reply)
4. Vendors can reply to any review on their products
5. Users can reply to any review
6. All replies visible to everyone

### Mandatory Delivery Feedback Flow
1. Order status changes to "delivered"
2. Database trigger creates entry in `pending_delivery_feedback`
3. Next time user opens app, `PendingFeedbackChecker` detects pending feedback
4. Modal appears with feedback form
5. User provides at least one rating (product quality or delivery service)
6. On submit, feedback saved and pending entry marked as completed
7. If multiple orders pending, shows next one after completion

---

## Database Triggers

### 1. `create_pending_delivery_feedback()`
- Fires when order status → 'delivered'
- Creates entry in `pending_delivery_feedback` table

### 2. `mark_delivery_feedback_completed()`
- Fires when delivery feedback is submitted
- Marks pending entry as completed

### 3. `set_verified_buyer_flag()`
- Fires before insert/update on reviews
- Auto-sets `verified_buyer` based on order_id and delivery status

---

## RLS Policies

### Reviews
- **Insert**: Any authenticated user can create reviews
- **Select**: Anyone can view reviews (public)
- **Update**: Users can update their own reviews
- **Delete**: Users can delete their own reviews

### Review Replies
- **Insert**: Vendors can reply to their product reviews, users can reply to any review
- **Select**: Anyone can view replies (public)
- **Update**: Users can update their own replies
- **Delete**: Users can delete their own replies

### Delivery Feedback
- **Insert**: Users can create feedback for their delivered orders
- **Select**: Users can view their own feedback, sellers can view feedback for their orders

---

## UI Features

### Verified Buyer Badge
- Green badge with checkmark icon
- Shows "Verified Buyer" text
- Only appears for reviews with `verified_buyer = true`

### Threaded Replies
- Indented nested replies
- Vendor badge for seller replies
- Reply button on each review/reply
- Character counter (10-2000 chars)

### Delivery Feedback Modal
- Non-dismissible (can skip but will reappear)
- Two rating sections (product quality, delivery service)
- Optional text feedback for each
- At least one rating required

---

## Migration Instructions

1. **Run Database Migration**:
   ```bash
   supabase migration up
   ```

2. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy submit-review
   supabase functions deploy submit-reply
   supabase functions deploy check-pending-feedback
   supabase functions deploy submit-delivery-feedback
   ```

3. **Update Frontend**:
   - Components are already updated
   - `PendingFeedbackChecker` is added to `App.tsx`
   - No additional configuration needed

---

## Testing Checklist

- [ ] Open review: User without purchase can review product
- [ ] Verified buyer: Review with order_id shows badge
- [ ] Vendor reply: Seller can reply to review
- [ ] User reply: Regular user can reply to review
- [ ] Threaded replies: Reply to a reply works
- [ ] Delivery feedback: Modal appears when order delivered
- [ ] Multiple orders: Sequential modals for multiple pending orders
- [ ] Skip functionality: User can skip feedback (will reappear)
- [ ] Review update: User can edit existing review
- [ ] Review delete: User can delete own review

---

## Notes

- The system maintains backward compatibility with existing reviews
- Old reviews without `order_id` will have `verified_buyer = false`
- The mandatory feedback modal respects user choice to skip (doesn't force)
- All text inputs are sanitized to prevent XSS
- Rate limiting is applied to prevent spam

---

## Future Enhancements

1. Email notifications for vendor replies
2. Review helpfulness voting
3. Review sorting (newest, highest rated, verified buyers first)
4. Review moderation queue integration
5. Analytics dashboard for review metrics

