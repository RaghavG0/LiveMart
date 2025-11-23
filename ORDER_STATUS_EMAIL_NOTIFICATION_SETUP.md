# Order Status Email Notification System - Setup Guide

## Overview
This system automatically sends email notifications to buyers (customers or retailers) when order status is updated by sellers (retailers or wholesalers).

## Features Implemented

### ✅ Automated Email Notifications
- Email sent automatically when order status changes
- Uses Gmail OAuth refresh token (same as login OTP)
- Beautiful HTML email template with status colors
- Includes order details and tracking link

### ✅ Status Updates
- Updates order status in database
- Logs status changes to history
- Handles authorization (only sellers can update their orders)

### ✅ Error Handling
- Status update succeeds even if email fails
- Returns warning message if email notification fails
- Logs errors for debugging

## Files Modified/Created

### Edge Function
- **`supabase/functions/update-order-status/index.ts`** (Updated)
  - Added email notification functionality
  - Uses Gmail OAuth refresh token
  - Fetches buyer email from profiles/auth.users
  - Sends beautiful HTML email with status colors

### Frontend Components
- **`src/pages/SellerOrderManagement.tsx`** (Updated)
  - Refactored to use edge function instead of direct DB update
  - Added loading states for buttons
  - Shows email status in toast messages

- **`src/components/dashboards/WholesalerDashboard.tsx`** (Updated)
  - Refactored to use edge function instead of direct DB update
  - Added loading state for status dropdown
  - Shows email status in toast messages

- **`src/components/dashboard/OrderStatusManager.tsx`** (Already using edge function)
  - No changes needed - already integrated

## Email Template Features

### Status Colors
- **Pending**: Yellow/Orange (⏳)
- **Confirmed**: Blue (✓)
- **Processing**: Purple/Indigo (🔄)
- **Shipped**: Orange (📦)
- **Delivered**: Green (✅)
- **Cancelled**: Red (❌)
- **Ready for Pickup**: Purple (🏪)
- **Picked Up**: Green (✅)

### Email Contents
- Order ID
- Total Amount
- Current Status (with color-coded badge)
- Tracking link button
- Professional HTML template

## Setup Instructions

### 1. Environment Variables

The system uses the same Gmail OAuth credentials as the login OTP system. No additional setup needed if already configured!

**Already Set:**
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_USER`

**Optional (for tracking links):**
- `SITE_URL` - Your domain URL (defaults to placeholder if not set)

### 2. Deploy Edge Function

```bash
supabase functions deploy update-order-status
```

### 3. Testing

#### Test Email Notification
1. Login as a Retailer or Wholesaler
2. Go to Order Management page
3. Update an order status (e.g., "Pending" → "Confirmed")
4. Check buyer's email inbox for notification

#### Test Different Statuses
- Update to each status type
- Verify email colors match status
- Check tracking link works

## How It Works

### Flow Diagram

```
1. Seller updates order status
   ↓
2. Frontend calls update-order-status edge function
   ↓
3. Edge function:
   a. Validates seller authorization
   b. Updates order status in database
   c. Fetches buyer email from auth.users
   d. Sends email notification (non-blocking)
   ↓
4. Returns success with email status
   ↓
5. Frontend shows toast message
```

### Buyer Email Logic

- **Order Type: "customer"**
  - Buyer = Customer (customer_id)
  - Sends email to customer who placed the order

- **Order Type: "retailer"**
  - Buyer = Retailer (customer_id is the retailer in this case)
  - Sends email to retailer who ordered from wholesaler

### Email Sending

- Uses Gmail API with OAuth refresh token
- Automatically refreshes access token
- Non-blocking: Status update succeeds even if email fails
- Returns warning in response if email fails

## API Endpoint

### Update Order Status
**Endpoint**: `POST /functions/v1/update-order-status`

**Headers**:
```
Authorization: Bearer <user_jwt_token>
Content-Type: application/json
```

**Body**:
```json
{
  "orderId": "uuid",
  "newStatus": "confirmed",
  "notes": "Optional notes about the status update"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "data": { ...orderData },
  "message": "Order status updated to confirmed. Email notification sent.",
  "emailSent": true
}
```

**Response (Email Failed)**:
```json
{
  "success": true,
  "data": { ...orderData },
  "message": "Order status updated to confirmed. Status updated, but email notification failed.",
  "emailSent": false,
  "emailError": "Error message"
}
```

## Status Values

Valid status values:
- `pending`
- `confirmed`
- `processing`
- `shipped`
- `delivered`
- `cancelled`
- `ready_for_pickup`
- `picked_up`

## Troubleshooting

### Issue: Emails not being sent
**Check:**
1. Gmail OAuth credentials are set in Supabase secrets
2. Refresh token is valid and not expired
3. Check edge function logs for errors

### Issue: Status update succeeds but email fails
**Solution:**
- This is expected behavior - status update is prioritized
- Check email error in response message
- Verify Gmail API credentials

### Issue: Wrong email recipient
**Check:**
1. Order `customer_id` is correct
2. Buyer email exists in auth.users
3. Profile has correct user ID

## Security Notes

1. **Authorization**: Only sellers can update their own orders
2. **Email Privacy**: Only buyer email is sent to, never seller email
3. **Token Refresh**: OAuth tokens are automatically refreshed
4. **Error Handling**: Email failures don't expose sensitive data

## Future Enhancements

- Add SMS notifications as alternative
- Customize email templates per seller
- Add email preferences (opt-in/opt-out)
- Track email open rates
- Add email retry logic for failed sends

## Support

For Gmail OAuth setup, see: `EMAIL_CONFIGURATION_GUIDE.md`
For edge function deployment, see: Supabase documentation

