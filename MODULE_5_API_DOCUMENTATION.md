# MODULE 5: FEEDBACK & DASHBOARD UPDATES - API DOCUMENTATION

## 📊 DATA MODEL

### 1. Extended Tables

#### **reviews** (Extended)
```sql
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users,
  product_id uuid NOT NULL REFERENCES products,
  order_id uuid REFERENCES orders ON DELETE CASCADE,  -- NEW
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  edited_at timestamptz,  -- NEW
  UNIQUE (user_id, product_id, order_id)  -- NEW: One review per order-product
);
```

**Key Changes:**
- Added `order_id` to tie reviews to specific orders
- Added `edited_at` to track when reviews are updated
- Added unique constraint to prevent duplicate reviews per (customer, product, order)
- Updated RLS policy to only allow reviews for **delivered** orders

---

#### **order_status_history** (New)
```sql
CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders ON DELETE CASCADE,
  old_status order_status,
  new_status order_status NOT NULL,
  changed_by uuid REFERENCES auth.users ON DELETE SET NULL,
  changed_by_role app_role,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

**Purpose:** Automatically logs every order status change via database trigger

**Trigger:** `log_order_status_change()` fires after UPDATE on `orders.status`

---

#### **delivery_confirmation_tokens** (New)
```sql
CREATE TABLE public.delivery_confirmation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

**Purpose:** Secure delivery confirmation via email/SMS links

**Security:**
- Tokens expire after set time
- One-time use only (marked as `used` after confirmation)
- Public RLS policy allows token verification

---

### 2. Helper Functions

#### **get_product_rating(product_uuid)**
Returns aggregated rating statistics for a product:
```sql
RETURNS TABLE(
  average_rating numeric,
  total_reviews bigint
)
```

#### **get_retailer_feedback_summary(retailer_uuid)**
Returns feedback summary for all products sold by a retailer:
```sql
RETURNS TABLE(
  total_reviews bigint,
  average_rating numeric,
  rating_distribution jsonb
)
```

---

## 🔌 REST API ENDPOINTS

### 1. Submit/Update Feedback

**Endpoint:** `POST /functions/v1/submit-feedback`

**Authentication:** Required (Customer only)

**Request Body:**
```json
{
  "productId": "uuid",
  "orderId": "uuid",
  "rating": 1-5,
  "comment": "Optional review text"
}
```

**Validation:**
- ✅ User must be authenticated
- ✅ Order must belong to the user
- ✅ Order must contain the product
- ✅ Order status must be `delivered`
- ✅ Rating must be between 1-5

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": "review_uuid",
    "user_id": "user_uuid",
    "product_id": "product_uuid",
    "order_id": "order_uuid",
    "rating": 5,
    "comment": "Great product!",
    "created_at": "2025-11-19T12:00:00Z",
    "edited_at": null,
    "updated": false
  },
  "message": "Feedback submitted successfully"
}
```

**Behavior:**
- If review already exists → **Updates** existing review + sets `edited_at`
- If review doesn't exist → **Creates** new review

**Error Cases:**
```json
// 401 Unauthorized
{ "error": "Unauthorized" }

// 400 Missing fields
{ "error": "Missing required fields: productId, orderId, rating" }

// 400 Invalid rating
{ "error": "Rating must be between 1 and 5" }

// 404 Order not found
{ "error": "Order not found or does not contain this product" }

// 400 Order not delivered
{ "error": "Can only review products from delivered orders" }
```

---

### 2. Get Product Feedback

**Endpoint:** `GET /functions/v1/get-product-feedback?productId={uuid}&page=1&limit=10`

**Authentication:** Not required (public endpoint)

**Query Parameters:**
- `productId` (required): UUID of the product
- `page` (optional, default: 1): Page number for pagination
- `limit` (optional, default: 10): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "review_uuid",
        "rating": 5,
        "comment": "Excellent quality!",
        "customerName": "John Doe",
        "createdAt": "2025-11-19T12:00:00Z",
        "editedAt": null,
        "isEdited": false
      }
    ],
    "summary": {
      "averageRating": 4.5,
      "totalReviews": 127
    },
    "pagination": {
      "currentPage": 1,
      "totalPages": 13,
      "totalItems": 127,
      "itemsPerPage": 10
    }
  }
}
```

**Use Cases:**
- Display reviews on product detail pages
- Show average rating on product cards
- Filter/sort products by rating

---

### 3. Update Order Status

**Endpoint:** `POST /functions/v1/update-order-status`

**Authentication:** Required (Retailer/Wholesaler who is seller for the order)

**Request Body:**
```json
{
  "orderId": "uuid",
  "newStatus": "shipped",
  "notes": "Optional status update notes"
}
```

**Valid Status Values:**
- `pending`
- `confirmed`
- `processing`
- `shipped`
- `delivered`
- `cancelled`

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "id": "order_uuid",
    "status": "shipped",
    "updated_at": "2025-11-19T12:00:00Z"
  },
  "message": "Order status updated to shipped"
}
```

**Side Effects:**
1. Order status is updated
2. Status change is automatically logged to `order_status_history` table via trigger
3. Real-time notification is sent to customer (via Supabase realtime)

**Error Cases:**
```json
// 401 Unauthorized
{ "error": "Unauthorized" }

// 400 Invalid status
{ "error": "Invalid status. Must be one of: pending, confirmed, processing, shipped, delivered, cancelled" }

// 404 Order not found
{ "error": "Order not found" }

// 403 Not seller for order
{ "error": "Unauthorized to update this order" }
```

---

### 4. Confirm Delivery (Token-based)

**Endpoint:** `GET /functions/v1/confirm-delivery?token={token}`

**Authentication:** Not required (uses token for verification)

**Query Parameters:**
- `token` (required): Delivery confirmation token sent via email/SMS

**Response (Success):**
```json
{
  "success": true,
  "message": "Delivery confirmed successfully",
  "orderId": "order_uuid"
}
```

**Response (Already Delivered):**
```json
{
  "success": true,
  "message": "Order already marked as delivered",
  "alreadyDelivered": true
}
```

**Behavior:**
1. Validates token (not used, not expired)
2. Updates order status to `delivered`
3. Marks token as used (prevents reuse)
4. Logs status change to history

**Error Cases:**
```json
// 400 Invalid/expired token
{ "error": "Invalid or expired token" }

// 400 Token expired
{ "error": "Token has expired" }

// 404 Order not found
{ "error": "Order not found" }
```

**Use Case:**
- Email/SMS delivery confirmation link
- Customer clicks link → Order automatically marked as delivered
- Enables feedback collection flow

---

### 5. Get Retailer Feedback

**Endpoint:** `GET /functions/v1/get-retailer-feedback?retailerId={uuid}&page=1&limit=20`

**Authentication:** Required (typically accessed by the retailer themselves)

**Query Parameters:**
- `retailerId` (optional, defaults to authenticated user): UUID of the retailer
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "review_uuid",
        "rating": 5,
        "comment": "Fast delivery!",
        "customerName": "Jane Smith",
        "createdAt": "2025-11-19T12:00:00Z",
        "editedAt": null,
        "isEdited": false,
        "product": {
          "id": "product_uuid",
          "name": "Product Name",
          "imageUrl": "https://..."
        }
      }
    ],
    "summary": {
      "totalReviews": 245,
      "averageRating": 4.7,
      "ratingDistribution": {
        "1": 5,
        "2": 8,
        "3": 22,
        "4": 85,
        "5": 125
      }
    },
    "pagination": {
      "currentPage": 1,
      "totalPages": 13,
      "totalItems": 245,
      "itemsPerPage": 20
    }
  }
}
```

**Use Cases:**
- Retailer dashboard: "My Product Reviews" section
- Feedback analytics and insights
- Identify top-rated/low-rated products
- Customer satisfaction monitoring

---

## 🔐 SECURITY & RLS POLICIES

### reviews Table
- **SELECT**: Anyone can view reviews (public)
- **INSERT**: Only authenticated users who have received a **delivered** order containing the product
- **UPDATE**: Only review author can update their own review
- **DELETE**: Only review author can delete their own review

### order_status_history Table
- **SELECT**: Order customer or seller for that order
- **INSERT**: Only sellers for that order (auto-triggered by status update)

### delivery_confirmation_tokens Table
- **SELECT (authenticated)**: Order customer can view their tokens
- **SELECT (public)**: Anyone can verify valid tokens (for delivery confirmation)

---

## 🔄 INTEGRATION WITH EXISTING MODULES

### Module 1 (Auth) Integration
- All feedback APIs use existing Supabase auth
- User roles (`customer`, `retailer`, `wholesaler`) respected
- No changes to auth flow required

### Module 2 (Dashboards) Integration
- Customer Dashboard: Can view "My Feedback" by querying `reviews` table filtered by `user_id`
- Retailer Dashboard: Use `get-retailer-feedback` API to show feedback analytics
- Wholesaler Dashboard: Query reviews for products supplied to retailers (via product relationships)

### Module 3 (Search) Integration
- Product listings can include `average_rating` and `total_reviews` from `get_product_rating()` function
- Enable filtering/sorting by rating

### Module 4 (Orders) Integration
- Order status updates automatically trigger history logging
- Delivered orders enable feedback submission
- No breaking changes to existing order flow

---

## 🎯 NON-BREAKING GUARANTEES

✅ **No existing API signatures changed**
✅ **All new fields have defaults or are nullable**
✅ **RLS policies only extended, not modified**
✅ **Existing order flow unchanged**
✅ **Reviews table backward compatible (order_id is nullable initially)**

---

## 📝 NEXT STEPS FOR FRONTEND

1. **Product Detail Page**: Integrate `get-product-feedback` to display reviews
2. **Order History**: Add "Leave Feedback" button for delivered orders → calls `submit-feedback`
3. **Dashboards**: 
   - Customer: Show "My Reviews" section
   - Retailer: Show feedback analytics via `get-retailer-feedback`
   - Wholesaler: Aggregate feedback for supplied products
4. **Seller Order Management**: Use `update-order-status` for status updates
5. **Delivery Confirmation**: Generate tokens and send email/SMS with `confirm-delivery` link

---

## 🧪 TESTING

### Test Feedback Submission
```bash
curl -X POST 'https://cdvhodymzfwdzfeltmsu.supabase.co/functions/v1/submit-feedback' \
  -H 'Authorization: Bearer YOUR_USER_JWT' \
  -H 'Content-Type: application/json' \
  -d '{
    "productId": "product_uuid",
    "orderId": "order_uuid",
    "rating": 5,
    "comment": "Excellent product!"
  }'
```

### Test Get Product Feedback
```bash
curl 'https://cdvhodymzfwdzfeltmsu.supabase.co/functions/v1/get-product-feedback?productId=PRODUCT_UUID&page=1&limit=10'
```

### Test Order Status Update
```bash
curl -X POST 'https://cdvhodymzfwdzfeltmsu.supabase.co/functions/v1/update-order-status' \
  -H 'Authorization: Bearer SELLER_JWT' \
  -H 'Content-Type: application/json' \
  -d '{
    "orderId": "order_uuid",
    "newStatus": "delivered",
    "notes": "Delivered by courier"
  }'
```

### Test Delivery Confirmation
```bash
curl 'https://cdvhodymzfwdzfeltmsu.supabase.co/functions/v1/confirm-delivery?token=UNIQUE_TOKEN'
```

---

## 📊 DATABASE DIAGRAM

```
┌─────────────┐
│   orders    │
│  (existing) │
└──────┬──────┘
       │ 1:N
       ▼
┌──────────────────────┐     ┌─────────────────┐
│ order_status_history │◄────│  TRIGGER: Auto  │
│      (NEW)           │     │  logs changes   │
└──────────────────────┘     └─────────────────┘

┌─────────────┐
│   orders    │
└──────┬──────┘
       │ 1:1
       ▼
┌────────────────────────────┐
│ delivery_confirmation_     │
│        tokens (NEW)        │
└────────────────────────────┘

┌─────────────┐     ┌──────────────┐
│   orders    │────▶│ order_items  │
│  (existing) │ 1:N │  (existing)  │
└─────────────┘     └───────┬──────┘
                            │
                            ▼
┌─────────────┐     ┌──────────────┐
│  products   │◄────│   reviews    │
│  (existing) │ 1:N │  (EXTENDED)  │
└─────────────┘     └───────┬──────┘
                            │
                    ┌───────┴────────┐
                    │ NEW COLUMNS:   │
                    │ - order_id     │
                    │ - edited_at    │
                    └────────────────┘
```
