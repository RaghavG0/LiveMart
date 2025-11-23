# Social Feedback System - UX/UI Design Document

## Table of Contents
1. [User Flows](#user-flows)
2. [Wireframe Descriptions](#wireframe-descriptions)
3. [Visual Hierarchy & Design System](#visual-hierarchy--design-system)
4. [Post-Delivery Feedback Flow](#post-delivery-feedback-flow)
5. [Spam Prevention Strategy](#spam-prevention-strategy)

---

## User Flows

### Flow 1: Universal Review Submission (Any User)

```
START: User on Product Detail Page
  │
  ├─> [Product Page Loads]
  │   ├─> Display: Product Info, Images, Price
  │   └─> Display: "Write a Review" Button (Always visible if logged in)
  │
  ├─> [User Clicks "Write a Review"]
  │   ├─> IF: User has existing review
  │   │   └─> Display: Pre-filled form with existing review
  │   │
  │   └─> IF: User has no review
  │       └─> Display: Empty review form
  │
  ├─> [Review Form Opens]
  │   ├─> Step 1: Select Star Rating (Required)
  │   │   └─> Visual: 5 interactive stars, hover preview
  │   │
  │   ├─> Step 2: Write Comment (Optional, max 1000 chars)
  │   │   ├─> Display: Character counter (X/1000)
  │   │   └─> Display: Rich text hints (optional)
  │   │
  │   └─> Step 3: Upload Images (Optional, max 3)
  │       └─> Display: Drag & drop or click to upload
  │
  ├─> [User Submits Review]
  │   ├─> Validation: Rating required
  │   ├─> IF: Valid
  │   │   ├─> Show: Loading spinner
  │   │   ├─> API Call: POST /submit-review
  │   │   └─> IF: Success
  │   │       ├─> Show: Success toast
  │   │       ├─> Update: Review list (add new review at top)
  │   │       └─> Display: "Verified Buyer" badge (if order_id provided)
  │   │
  │   └─> IF: Error
  │       └─> Show: Error message with retry option
  │
  └─> END: Review visible in public list
```

### Flow 2: Threaded Discussion Participation

```
START: User Views Review
  │
  ├─> [Review Card Displayed]
  │   ├─> Display: Reviewer name, avatar, rating, date
  │   ├─> Display: "Verified Buyer" badge (if applicable)
  │   ├─> Display: Review text
  │   └─> Display: "Reply" button
  │
  ├─> [User Clicks "Reply"]
  │   ├─> IF: User is Vendor/Owner
  │   │   └─> Display: "Official Response" badge option
  │   │
  │   └─> IF: User is Regular User
  │       └─> Display: Standard reply form
  │
  ├─> [Reply Form Expands Below Review]
  │   ├─> Display: Textarea (10-2000 chars)
  │   ├─> Display: Character counter
  │   ├─> Display: "Post Reply" button
  │   └─> Display: "Cancel" button
  │
  ├─> [User Types Reply & Submits]
  │   ├─> Validation: Min 10 characters
  │   ├─> IF: Valid
  │   │   ├─> Show: Loading state
  │   │   ├─> API Call: POST /submit-reply
  │   │   └─> IF: Success
  │   │       ├─> Show: Success toast
  │   │       ├─> Display: Reply appears indented below review
  │   │       └─> Display: Badge ("Vendor" or "User")
  │   │
  │   └─> IF: Error
  │       └─> Show: Error message
  │
  ├─> [User Clicks Reply on Existing Reply]
  │   └─> Display: Nested reply form (further indented)
  │
  └─> END: Threaded conversation visible
```

### Flow 3: Post-Delivery Mandatory Feedback

```
START: Order Status Changes to "Delivered"
  │
  ├─> [System Event Triggered]
  │   └─> Database: Create entry in pending_delivery_feedback
  │
  ├─> [User Opens App / Navigates Anywhere]
  │   ├─> Background Check: GET /check-pending-feedback
  │   └─> IF: Has pending feedback
  │       └─> Trigger: Show modal immediately
  │
  ├─> [Modal Appears - Non-Dismissible]
  │   ├─> Display: Overlay (dark background, 80% opacity)
  │   ├─> Display: Modal Card (centered, max-width: 600px)
  │   ├─> Display: Header "Delivery Feedback Required"
  │   ├─> Display: Order info (Order #, Date, Total)
  │   └─> Display: Close button (X) - Only for "Skip for Now"
  │
  ├─> [User Sees Feedback Form]
  │   │
  │   ├─> Section 1: Product Quality
  │   │   ├─> Display: "Product Quality" label
  │   │   ├─> Display: 5-star rating (Required indicator)
  │   │   ├─> Display: Textarea (Optional, max 1000 chars)
  │   │   └─> Display: Character counter
  │   │
  │   └─> Section 2: Delivery Service
  │       ├─> Display: "Delivery Service" label
  │       ├─> Display: 5-star rating (Required indicator)
  │       ├─> Display: Textarea (Optional, max 1000 chars)
  │       └─> Display: Character counter
  │
  ├─> [User Interaction]
  │   ├─> IF: User provides at least one rating
  │   │   └─> Enable: "Submit Feedback" button
  │   │
  │   ├─> IF: User clicks "Skip for Now"
  │   │   ├─> Close: Modal
  │   │   └─> Note: Modal will reappear on next app open
  │   │
  │   └─> IF: User clicks "Submit Feedback"
  │       ├─> Validation: At least one rating required
  │       ├─> IF: Valid
  │       │   ├─> Show: Loading spinner
  │       │   ├─> API Call: POST /submit-delivery-feedback
  │       │   └─> IF: Success
  │       │       ├─> Show: Success toast
  │       │       ├─> Close: Modal
  │       │       ├─> Mark: Pending feedback as completed
  │       │       └─> IF: More pending orders
  │       │           └─> Show: Next modal after 1s delay
  │       │
  │       └─> IF: Error
  │           └─> Show: Error message with retry
  │
  └─> END: Feedback saved, user continues normal flow
```

---

## Wireframe Descriptions

### Wireframe 1: Product Detail Page - Review Section

```
┌─────────────────────────────────────────────────────────────┐
│ PRODUCT DETAIL PAGE                                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ [Product Image]        Product Name                          │
│                        ₹999.00                               │
│                        ⭐⭐⭐⭐☆ 4.2 (128 reviews)          │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ CUSTOMER REVIEWS                                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ WRITE A REVIEW                                            │ │
│ │ ─────────────────────────────────────────────────────── │ │
│ │                                                           │ │
│ │ Your Rating *                                            │ │
│ │ ⭐⭐⭐⭐⭐ (Interactive stars)                            │ │
│ │                                                           │ │
│ │ Your Review (Optional)                                    │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Tell others about your experience...                 │ │ │
│ │ │                                                       │ │ │
│ │ │                                                       │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │ 0/1000 characters                                         │ │
│ │                                                           │ │
│ │ Photos (Optional) - Max 3                                 │ │
│ │ [📷 Upload Images]                                        │ │
│ │                                                           │ │
│ │ [Submit Review] Button                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ REVIEWS (128)                                             │ │
│ │ ⭐⭐⭐⭐☆ 4.2 Average                                      │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │                                                           │ │
│ │ ┌─ REVIEW CARD ───────────────────────────────────────┐ │ │
│ │ │ 👤 John D.  [✓ Verified Buyer]  ⭐⭐⭐⭐⭐              │ │ │
│ │ │ 2 days ago                                              │ │ │
│ │ │                                                         │ │ │
│ │ │ "Great product! Fast delivery and excellent quality." │ │ │
│ │ │                                                         │ │ │
│ │ │ [📷 Image 1] [📷 Image 2]                              │ │ │
│ │ │                                                         │ │ │
│ │ │ ┌─ REPLY SECTION ───────────────────────────────────┐ │ │ │
│ │ │ │ [💬 Reply] Button                                   │ │ │ │
│ │ │ │                                                      │ │ │ │
│ │ │ │ ┌─ VENDOR REPLY (Indented) ─────────────────────┐ │ │ │ │
│ │ │ │ │ 🏪 [Official Response] Retailer Name          │ │ │ │ │
│ │ │ │ │ 1 day ago                                       │ │ │ │ │
│ │ │ │ │                                                 │ │ │ │ │
│ │ │ │ │ "Thank you for your feedback! We're glad..."   │ │ │ │ │
│ │ │ │ │                                                 │ │ │ │ │
│ │ │ │ │ [💬 Reply] Button                              │ │ │ │ │
│ │ │ │ └────────────────────────────────────────────────┘ │ │ │ │
│ │ │ │                                                      │ │ │ │
│ │ │ │ ┌─ USER REPLY (Indented) ───────────────────────┐ │ │ │ │
│ │ │ │ │ 👤 Sarah M.  3 hours ago                       │ │ │ │ │
│ │ │ │ │                                                 │ │ │ │ │
│ │ │ │ │ "I had the same experience! Highly recommend." │ │ │ │ │
│ │ │ │ │                                                 │ │ │ │ │
│ │ │ │ │ [💬 Reply] Button                              │ │ │ │ │
│ │ │ │ └────────────────────────────────────────────────┘ │ │ │ │
│ │ │ └────────────────────────────────────────────────────┘ │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │                                                               │ │
│ │ [Previous] [1] [2] [3] [Next]  (Pagination)                │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Wireframe 2: Threaded Discussion Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│ REVIEW THREAD VISUAL STRUCTURE                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─ ORIGINAL REVIEW (Level 0) ─────────────────────────────┐ │
│ │                                                           │ │
│ │ 👤 Reviewer Name  [✓ Verified Buyer]  ⭐⭐⭐⭐⭐          │ │
│ │ 5 days ago                                                │ │
│ │                                                           │ │
│ │ Review text content here...                               │ │
│ │                                                           │ │
│ │ [💬 Reply] Button                                         │ │
│ │                                                           │ │
│ │ ┌─ VENDOR REPLY (Level 1, Indent: 24px) ─────────────┐ │ │
│ │ │                                                       │ │ │
│ │ │ 🏪 Retailer Name  [Official Response]  ⭐⭐⭐⭐⭐     │ │ │
│ │ │ 4 days ago                                            │ │ │
│ │ │                                                       │ │ │
│ │ │ Vendor response text...                               │ │ │
│ │ │                                                       │ │ │
│ │ │ [💬 Reply] Button                                     │ │ │
│ │ │                                                       │ │ │
│ │ │ ┌─ USER REPLY TO VENDOR (Level 2, Indent: 48px) ───┐ │ │ │
│ │ │ │                                                   │ │ │ │
│ │ │ │ 👤 User Name  2 days ago                          │ │ │ │
│ │ │ │                                                   │ │ │ │
│ │ │ │ User reply to vendor...                           │ │ │ │
│ │ │ │                                                   │ │ │ │
│ │ │ │ [💬 Reply] Button                                 │ │ │ │
│ │ │ └───────────────────────────────────────────────────┘ │ │ │
│ │ └───────────────────────────────────────────────────────┘ │ │
│ │                                                           │ │
│ │ ┌─ USER REPLY (Level 1, Indent: 24px) ─────────────────┐ │ │
│ │ │                                                       │ │ │
│ │ │ 👤 Another User  3 days ago                           │ │ │
│ │ │                                                       │ │ │
│ │ │ User comment on review...                             │ │ │
│ │ │                                                       │ │ │
│ │ │ [💬 Reply] Button                                     │ │ │
│ │ └───────────────────────────────────────────────────────┘ │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ DESIGN NOTES:                                                 │
│ • Level 0: No indent, full width                              │
│ • Level 1: 24px left indent, left border (2px, primary)     │
│ • Level 2: 48px left indent, nested border                   │
│ • Max nesting: 3 levels (to prevent deep threads)             │
│ • Vendor badge: Gold/Orange background, "Official Response"    │
│ • Verified Buyer: Green badge with checkmark                   │
└─────────────────────────────────────────────────────────────┘
```

### Wireframe 3: Post-Delivery Feedback Modal

```
┌─────────────────────────────────────────────────────────────┐
│ OVERLAY (Dark, 80% opacity, z-index: 50)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                    ┌─────────────────────────────┐          │
│                    │ DELIVERY FEEDBACK REQUIRED  │          │
│                    │ ─────────────────────────── │          │
│                    │                             │          │
│                    │ Order #ABC12345              │          │
│                    │ Placed: Jan 15, 2024         │          │
│                    │ Total: ₹1,299.00              │          │
│                    │                             │          │
│                    │ Please share your experience│          │
│                    │ with this order.            │          │
│                    │                             │          │
│                    │ ┌─────────────────────────┐ │          │
│                    │ │ PRODUCT QUALITY         │ │          │
│                    │ │ ─────────────────────── │ │          │
│                    │ │                         │ │          │
│                    │ │ Rating *                │ │          │
│                    │ │ ⭐⭐⭐⭐⭐ (Interactive)  │ │          │
│                    │ │                         │ │          │
│                    │ │ Feedback (Optional)       │ │          │
│                    │ │ ┌─────────────────────┐ │ │          │
│                    │ │ │ Tell us about the   │ │ │          │
│                    │ │ │ product quality...  │ │ │          │
│                    │ │ └─────────────────────┘ │ │          │
│                    │ │ 0/1000 characters        │ │          │
│                    │ └─────────────────────────┘ │          │
│                    │                             │          │
│                    │ ┌─────────────────────────┐ │          │
│                    │ │ DELIVERY SERVICE        │ │          │
│                    │ │ ─────────────────────── │ │          │
│                    │ │                         │ │          │
│                    │ │ Rating *                │ │          │
│                    │ │ ⭐⭐⭐⭐⭐ (Interactive)  │ │          │
│                    │ │                         │ │          │
│                    │ │ Feedback (Optional)       │ │          │
│                    │ │ ┌─────────────────────┐ │ │          │
│                    │ │ │ Tell us about the   │ │ │          │
│                    │ │ │ delivery experience │ │ │          │
│                    │ │ └─────────────────────┘ │ │          │
│                    │ │ 0/1000 characters        │ │          │
│                    │ └─────────────────────────┘ │          │
│                    │                             │          │
│                    │ ┌─────────────────────────┐ │          │
│                    │ │ [Skip for Now] [Submit] │ │          │
│                    │ └─────────────────────────┘ │          │
│                    │                             │          │
│                    │ ℹ️ At least one rating      │          │
│                    │    required                │          │
│                    └─────────────────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘

MODAL SPECIFICATIONS:
• Width: 600px (max-width on mobile: 90vw)
• Position: Centered (top: 50%, left: 50%, transform: translate(-50%, -50%))
• Border-radius: 12px
• Shadow: Large (elevation: 24)
• Backdrop: Blur effect (backdrop-filter: blur(4px))
• Non-dismissible: Clicking outside does NOT close
• Close button (X): Only for "Skip for Now" action
```

---

## Visual Hierarchy & Design System

### Comment Thread Visual Design

#### 1. **Indentation System**
```
Level 0 (Original Review):
  • Margin-left: 0px
  • Full width: 100%
  • Background: White/Card
  • Border: None

Level 1 (First Reply):
  • Margin-left: 24px
  • Width: calc(100% - 24px)
  • Border-left: 3px solid primary color
  • Padding-left: 16px
  • Background: Slightly lighter (gray-50)

Level 2 (Reply to Reply):
  • Margin-left: 48px
  • Width: calc(100% - 48px)
  • Border-left: 3px solid secondary color
  • Padding-left: 16px
  • Background: Even lighter (gray-100)

Level 3 (Max Depth):
  • Margin-left: 72px
  • Width: calc(100% - 72px)
  • Border-left: 3px solid muted color
  • Padding-left: 16px
  • Background: Lightest (gray-50)
```

#### 2. **Badge System**

**Verified Buyer Badge:**
- Color: Green (#10B981)
- Icon: CheckCircle (✓)
- Text: "Verified Buyer"
- Size: Small (text-xs)
- Position: Next to reviewer name
- Style: Rounded pill with icon

**Official Response Badge (Vendor):**
- Color: Orange/Gold (#F59E0B)
- Icon: Store/Building (🏪)
- Text: "Official Response"
- Size: Small (text-xs)
- Position: Next to vendor name
- Style: Rounded pill, slightly larger than user badge

**User Reply Badge:**
- No badge (default state)
- Avatar: User initials or profile picture
- Name: Full name or masked (e.g., "John D.")

#### 3. **Typography Hierarchy**

```
Original Review:
  • Name: font-semibold, text-base (16px)
  • Date: text-xs, text-muted-foreground
  • Content: text-sm, leading-relaxed
  • Rating: Large stars (20px)

Replies:
  • Name: font-medium, text-sm (14px)
  • Date: text-xs, text-muted-foreground
  • Content: text-sm, leading-relaxed
  • Rating: Small stars (16px) - if applicable
```

#### 4. **Color Scheme**

```
Primary Colors:
  • Verified Buyer: Green-600 (#10B981)
  • Official Response: Amber-500 (#F59E0B)
  • User Reply: Gray-700 (#374151)

Background Colors:
  • Original Review: White (#FFFFFF)
  • Level 1 Reply: Gray-50 (#F9FAFB)
  • Level 2 Reply: Gray-100 (#F3F4F6)
  • Level 3 Reply: Gray-50 (#F9FAFB)

Border Colors:
  • Level 1: Primary-500
  • Level 2: Secondary-500
  • Level 3: Muted-300
```

#### 5. **Spacing System**

```
Card Padding:
  • Original Review: p-6 (24px)
  • Replies: p-4 (16px)

Gap Between Items:
  • Review to Reply: mt-4 (16px)
  • Reply to Reply: mt-3 (12px)

Indentation:
  • Level 1: ml-6 (24px)
  • Level 2: ml-12 (48px)
  • Level 3: ml-18 (72px)
```

---

## Post-Delivery Feedback Flow

### Step-by-Step User Journey

#### **Step 1: Order Delivery Trigger**
```
Event: Order status → "delivered"
Action: Database trigger creates pending_feedback entry
State: User not yet aware
```

#### **Step 2: User Opens App**
```
Event: User navigates to any page
Action: Background API call to check-pending-feedback
Result: System detects pending feedback
```

#### **Step 3: Modal Interruption**
```
Event: Modal appears immediately
Visual: 
  • Dark overlay (80% opacity)
  • Centered modal card
  • Smooth fade-in animation (300ms)
  • Non-dismissible (no click-outside-to-close)
  
User State: 
  • Current page dimmed but visible
  • Focus trapped in modal
  • Cannot proceed until action taken
```

#### **Step 4: User Reads Modal**
```
Content Displayed:
  • Header: "Delivery Feedback Required"
  • Order context: Order #, date, total
  • Two sections: Product Quality & Delivery Service
  • Each section: Star rating + optional text
  • Footer: "Skip for Now" + "Submit Feedback" buttons
  
User Understanding:
  • Clear that feedback is required
  • Understands they can skip (but will reappear)
  • Sees at least one rating is mandatory
```

#### **Step 5: User Interaction Options**

**Option A: Provide Feedback**
```
1. User rates Product Quality (1-5 stars)
   └─> Visual: Stars fill, rating number appears
   
2. (Optional) User types product feedback
   └─> Visual: Character counter updates
   
3. User rates Delivery Service (1-5 stars)
   └─> Visual: Stars fill, rating number appears
   
4. (Optional) User types delivery feedback
   └─> Visual: Character counter updates
   
5. User clicks "Submit Feedback"
   └─> Validation: At least one rating required
   └─> IF Valid: Submit → Success → Close → Next order (if any)
   └─> IF Invalid: Show error, highlight required field
```

**Option B: Skip for Now**
```
1. User clicks "Skip for Now"
   └─> Modal closes with fade-out animation
   └─> User returns to previous page
   └─> Pending feedback remains in system
   └─> Modal will reappear on next app open
```

#### **Step 6: Multiple Orders Handling**
```
Scenario: User has 3 delivered orders pending feedback

Flow:
  Order 1 Modal → Submit → Close → (1s delay) → 
  Order 2 Modal → Submit → Close → (1s delay) → 
  Order 3 Modal → Submit → Close → Done

User Experience:
  • Sequential, not overwhelming
  • Clear progress (can show "1 of 3" indicator)
  • Option to skip any individual order
```

#### **Step 7: Success State**
```
After Submission:
  • Success toast: "Thank you for your feedback!"
  • Modal closes smoothly
  • Pending entry marked as completed
  • User continues normal app usage
  • No further interruptions for this order
```

---

## Spam Prevention Strategy

### Multi-Layer Defense System

#### **Layer 1: Rate Limiting**

**Implementation:**
```javascript
// Per-user rate limits
- Reviews: 5 per hour per product
- Replies: 10 per hour per review
- Delivery Feedback: 1 per order (enforced by unique constraint)

// IP-based rate limiting (for anonymous attempts)
- 20 reviews per IP per day
- 50 replies per IP per day
```

**UI Feedback:**
- Show remaining quota: "You can submit 3 more reviews today"
- Clear error message: "Rate limit exceeded. Please try again in X minutes"
- Disable submit button when limit reached

#### **Layer 2: Content Validation**

**Text Analysis:**
```
1. Minimum Length:
   - Reviews: Rating required (comment optional)
   - Replies: 10 characters minimum
   - Delivery Feedback: At least one rating required

2. Maximum Length:
   - Reviews: 1000 characters
   - Replies: 2000 characters
   - Delivery Feedback: 1000 characters per field

3. Content Filtering:
   - Profanity filter (configurable word list)
   - Spam keyword detection
   - URL/link detection (flag for moderation)
   - Repeated character detection (e.g., "aaaaaa")
```

**Image Validation:**
```
- Max 3 images per review
- File size: 5MB per image
- Format: JPG, PNG, WebP only
- Image analysis: Detect spam patterns (all same image, etc.)
```

#### **Layer 3: User Reputation System**

**Reputation Score:**
```
Factors:
- Account age: Older accounts = higher trust
- Purchase history: Verified buyers = higher trust
- Review history: Consistent quality = higher trust
- Report count: Reported reviews = lower trust

Scoring:
- New user: 0 points
- Verified buyer: +10 points
- Account > 30 days: +5 points
- Account > 90 days: +10 points
- Each quality review: +1 point
- Each reported review: -5 points

Thresholds:
- < 0 points: Reviews require moderation
- 0-10 points: Reviews auto-published but flagged
- > 10 points: Reviews auto-published, no flag
```

**UI Indicators:**
- Show reputation badge: "Trusted Reviewer" (if > 20 points)
- Low reputation: "This review is pending moderation"

#### **Layer 4: Behavioral Analysis**

**Pattern Detection:**
```
Red Flags:
1. Multiple reviews in short time (same product)
2. Identical review text across products
3. All 5-star or all 1-star reviews (suspicious pattern)
4. Reviews from same IP address (multiple accounts)
5. Reviews immediately after account creation
6. No purchase history but many reviews
```

**Actions:**
- Flag for manual review
- Require CAPTCHA for next review
- Temporarily limit review submission
- Send to moderation queue

#### **Layer 5: Community Moderation**

**User Reporting:**
```
Report Options:
- "Spam"
- "Inappropriate Content"
- "Fake Review"
- "Off-topic"

Reporting Flow:
1. User clicks "Report" on review/reply
2. Modal: Select reason + optional comment
3. Submit → Review flagged
4. After 3 reports: Auto-hide pending moderation
5. Moderator reviews and takes action
```

**Moderation Queue:**
```
Priority Levels:
- High: Reported 3+ times, low reputation user
- Medium: Flagged by system, new user
- Low: First-time reviewer, verified buyer

Moderator Actions:
- Approve: Review published
- Reject: Review deleted, user notified
- Edit: Remove inappropriate content
- Ban: User cannot review (temporary/permanent)
```

#### **Layer 6: CAPTCHA Integration**

**Trigger Conditions:**
```
Show CAPTCHA when:
- User has < 5 reputation points
- User submitted 3+ reviews in 1 hour
- System detects suspicious pattern
- User from flagged IP address
```

**Implementation:**
- Use reCAPTCHA v3 (invisible) for most cases
- Fallback to v2 (checkbox) for high-risk cases
- No CAPTCHA for verified buyers with good reputation

#### **Layer 7: Machine Learning (Future Enhancement)**

**ML Model:**
```
Training Data:
- Known spam reviews (labeled)
- Legitimate reviews (labeled)
- User behavior patterns

Features:
- Text similarity scores
- User behavior patterns
- Review timing patterns
- Purchase correlation

Output:
- Spam probability score (0-1)
- Auto-flag if score > 0.7
- Send to moderation if score > 0.5
```

### UI/UX for Spam Prevention

#### **1. Review Submission Flow with Validation**

```
User Types Review
  │
  ├─> Real-time Validation
  │   ├─> Character count: "245/1000"
  │   ├─> Profanity check: "⚠️ Please use appropriate language"
  │   └─> Spam detection: "This review looks suspicious"
  │
  ├─> Submit Button States
  │   ├─> Disabled: Rating not selected
  │   ├─> Loading: Submitting...
  │   ├─> Success: "Review submitted!"
  │   └─> Error: "Please check your review and try again"
  │
  └─> Post-Submission
      ├─> IF: Low reputation
      │   └─> Show: "Your review is pending moderation"
      │
      └─> IF: High reputation
          └─> Show: "Review published successfully"
```

#### **2. Spam Warning Indicators**

```
Visual Cues:
- ⚠️ Warning icon for flagged content
- Grayed-out reviews pending moderation
- "This review is under review" badge
- "Reported X times" indicator (for moderators)
```

#### **3. User Education**

```
Tooltips/Help Text:
- "Helpful reviews include specific details about the product"
- "Reviews are more helpful when you've actually used the product"
- "Spam or fake reviews will be removed"

Onboarding:
- First review: Show tips for writing helpful reviews
- Explain verified buyer badge
- Show examples of good vs. bad reviews
```

### Monitoring & Analytics

**Metrics to Track:**
```
- Spam detection rate
- False positive rate
- Average time to moderation
- User report accuracy
- Review quality scores
- Reputation distribution
```

**Dashboard:**
- Real-time spam alerts
- Moderation queue status
- User reputation trends
- Review quality metrics

---

## Implementation Checklist

### Phase 1: Core Features
- [x] Database schema for open reviews
- [x] Threaded reply system
- [x] Delivery feedback tracking
- [x] API endpoints

### Phase 2: UI Components
- [x] Universal review form
- [x] Threaded discussion UI
- [x] Delivery feedback modal
- [ ] Spam prevention UI indicators
- [ ] Reputation badges
- [ ] Report functionality

### Phase 3: Spam Prevention
- [ ] Rate limiting implementation
- [ ] Content validation
- [ ] Reputation system
- [ ] Behavioral analysis
- [ ] CAPTCHA integration
- [ ] Moderation queue UI

### Phase 4: Polish
- [ ] Animations and transitions
- [ ] Loading states
- [ ] Error handling
- [ ] Accessibility (ARIA labels)
- [ ] Mobile responsiveness
- [ ] Performance optimization

---

## Design Assets Needed

1. **Icons:**
   - Verified Buyer checkmark
   - Official Response badge
   - Report flag icon
   - Spam warning icon

2. **Illustrations:**
   - Empty review state
   - No replies state
   - Spam warning illustration

3. **Animations:**
   - Modal fade-in/out
   - Star rating hover
   - Reply form expand
   - Success toast

4. **Color Palette:**
   - Primary colors (verified, official response)
   - Background gradients
   - Border colors for thread levels

---

## Accessibility Considerations

1. **Keyboard Navigation:**
   - Tab through all interactive elements
   - Enter to submit forms
   - Escape to close modals (if dismissible)

2. **Screen Readers:**
   - ARIA labels for all buttons
   - Role="dialog" for modals
   - Live regions for dynamic content

3. **Visual:**
   - High contrast for badges
   - Clear focus indicators
   - Text alternatives for icons

4. **Mobile:**
   - Touch-friendly targets (min 44x44px)
   - Swipe gestures for modals
   - Responsive typography

---

This design document provides a comprehensive blueprint for implementing the social feedback system with clear user flows, visual hierarchy, and spam prevention strategies.

