# FAQ Chatbot & Low Stock Alerts - Implementation Summary

## ✅ Features Implemented

### 1. Role-Based FAQ Chatbot
- ✅ Modern support chat page accessible from all dashboards
- ✅ Role-based questions and answers (Customer, Retailer, Wholesaler)
- ✅ Interactive chat interface with message history
- ✅ Clickable FAQ questions with instant answers
- ✅ Accordion view for all Q&A pairs
- ✅ Hardcoded responses with support contact information

### 2. Low Stock Inventory Alerts
- ✅ Alert banner on Retailer and Wholesaler dashboards
- ✅ Real-time detection of out-of-stock products
- ✅ Visual highlighting of out-of-stock rows in product tables
- ✅ "Manage Products" button to quickly navigate to inventory

## Files Created

### 1. FAQ Data
- **`src/data/faqData.ts`**
  - Contains role-based FAQ questions and answers
  - 8 questions per role (Customer, Retailer, Wholesaler)
  - Each answer includes support contact information

### 2. Support Chat Page
- **`src/pages/SupportChat.tsx`**
  - Full-page support chat interface
  - Role detection from user_roles table
  - Chat history with question/answer pairs
  - FAQ questions list on the left
  - Chat window on the right
  - Accordion view for all FAQs

### 3. Low Stock Alert Component
- **`src/components/alerts/LowStockAlert.tsx`**
  - Warning banner component
  - Shows out-of-stock product count
  - "Manage Products" button for quick navigation
  - Only displays when out-of-stock products exist

## Files Modified

### 1. Dashboard Components
- **`src/components/dashboards/CustomerDashboard.tsx`**
  - Added "Support" icon to navbar
  - Links to `/support-chat` page

- **`src/components/dashboards/RetailerDashboard.tsx`**
  - Added "Support" icon to navbar
  - Added `LowStockAlert` component
  - Tracks out-of-stock count from ProductList
  - Highlights out-of-stock products in table

- **`src/components/dashboards/WholesalerDashboard.tsx`**
  - Added "Support" icon to navbar
  - Added `LowStockAlert` component
  - Tracks out-of-stock count from ProductList
  - Highlights out-of-stock products in table

### 2. Product List Component
- **`src/components/products/ProductList.tsx`**
  - Added `onStockCountChange` callback prop
  - Calculates out-of-stock count after fetching products
  - Highlights out-of-stock rows with red background and border
  - Visual distinction for zero-stock products

### 3. App Routing
- **`src/App.tsx`**
  - Added route `/support-chat` for SupportChat page

## Features Details

### FAQ Chatbot

#### Customer FAQs (8 questions)
- Where is my order?
- How to cancel my order?
- What is the return policy?
- How to track my delivery?
- What payment methods are accepted?
- How to update my delivery address?
- What are the delivery charges?
- How long does delivery take?

#### Retailer FAQs (8 questions)
- How to add products to my inventory?
- What is the settlement cycle?
- How to contact wholesalers?
- How to manage order status updates?
- What are the commission rates?
- How to update my shop location?
- How to handle out-of-stock products?
- How to view customer feedback?

#### Wholesaler FAQs (8 questions)
- How does bulk verification work?
- What are the commission rates for wholesalers?
- Which shipping partners are integrated?
- How to manage retailer orders?
- How to set up inventory alerts?
- How to view performance analytics?
- What payment terms are available?
- How to handle product complaints?

### Low Stock Alerts

#### Visual Indicators
- **Alert Banner**: Red warning banner at top of dashboard
- **Product Rows**: Out-of-stock products highlighted with:
  - Red background (`bg-red-50`)
  - Red left border (`border-l-4 border-l-red-500`)
  - Hover effect (`hover:bg-red-100`)

#### Functionality
- Automatically counts products with `stock_quantity === 0`
- Updates in real-time when products are added/edited/deleted
- "Manage Products" button focuses on inventory/products tab
- Only shows when out-of-stock products exist

## UI/UX Features

### Support Chat Page
- **Modern Design**: Gradient background matching app theme
- **Two-Panel Layout**: FAQ list + Chat window
- **Interactive**: Click questions to see answers in chat
- **Chat History**: Maintains conversation history
- **Accordion View**: Expandable list of all FAQs
- **Role Detection**: Automatically shows relevant FAQs based on user role

### Navigation Icons
- **Support Icon**: MessageCircle icon in all dashboards
- **Consistent Placement**: After Notifications, before Account
- **Labels**: Text labels below icons for accessibility
- **Theming**: Matches existing dashboard header styling

## Technical Implementation

### Role Detection
```typescript
// Fetches user role from user_roles table
const { data } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .single();
```

### Stock Count Calculation
```typescript
// Calculates out-of-stock products
const outOfStockCount = products.filter(p => p.stock_quantity === 0).length;
onStockCountChange(outOfStockCount); // Callback to parent
```

### Visual Highlighting
```typescript
// Out-of-stock row styling
className={isOutOfStock ? "bg-red-50 border-l-4 border-l-red-500 hover:bg-red-100" : ""}
```

## Usage

### Accessing Support Chat
1. Click the "Support" icon in any dashboard navbar
2. Navigate to `/support-chat` page
3. Browse FAQ questions on the left
4. Click any question to see answer in chat window
5. Use accordion at bottom to view all FAQs

### Low Stock Alerts
1. **Alert appears automatically** when products have zero stock
2. **Banner shows count** of out-of-stock products
3. **Table rows highlighted** for easy identification
4. **Click "Manage Products"** to focus on inventory tab
5. **Alert disappears** when all products are restocked

## Support Contact Information

All FAQ answers include:
- **Phone**: +91 1800-123-4567
- **Email**: help@livemart.com

(These are placeholders - update in `src/data/faqData.ts`)

## Next Steps / Customization

### Update Support Contact
Edit `src/data/faqData.ts` to change phone number and email in all FAQ answers.

### Add More FAQs
Add more questions to `FAQ_DATA` object in `src/data/faqData.ts`.

### Customize Alert Message
Edit `src/components/alerts/LowStockAlert.tsx` to modify alert text.

### Style Customization
- Chat page: `src/pages/SupportChat.tsx`
- Alert banner: `src/components/alerts/LowStockAlert.tsx`
- Product highlighting: `src/components/products/ProductList.tsx`

## Testing

### Test Support Chat
1. Login as Customer/Retailer/Wholesaler
2. Click Support icon in navbar
3. Verify role-specific FAQs appear
4. Click questions and verify answers display
5. Test chat history and accordion view

### Test Low Stock Alerts
1. Login as Retailer/Wholesaler
2. Create products with `stock_quantity = 0`
3. Verify alert banner appears
4. Verify product rows are highlighted
5. Update stock quantity and verify alert disappears

## Summary

✅ **FAQ Chatbot**: Full-featured support page with role-based FAQs  
✅ **Low Stock Alerts**: Real-time inventory warnings with visual indicators  
✅ **Modern UI**: Matches app theme with gradient backgrounds  
✅ **Accessibility**: Icons have labels, keyboard navigation supported  
✅ **Real-time Updates**: Stock counts update automatically  

All features are frontend-only and require no backend changes!

