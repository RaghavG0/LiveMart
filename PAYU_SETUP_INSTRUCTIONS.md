# PayU Integration Setup Instructions

## Overview
This document provides setup instructions for the PayU payment gateway integration with multi-address checkout support.

## Prerequisites
- PayU merchant account (Test or Production)
- PayU Merchant Key and Salt

## Setup Steps

### 1. Database Migration
Run the migration to create the `user_addresses` table:

```bash
# Apply migration
supabase migration up
```

Or manually run the SQL from:
`supabase/migrations/20251128000000_create_user_addresses_table.sql`

### 2. Environment Variables (Optional for Testing)

#### For Testing Without API Keys (Recommended)

**Option 1: Mock Payment Mode** (No external calls)
```env
VITE_USE_MOCK_PAYMENT=true
```

**Option 2: PayU Test Mode** (Uses default test credentials - No setup needed!)
- Just use the default configuration
- System automatically uses PayU test credentials
- No API keys required

#### For Production (Only if you have PayU merchant account)

#### Supabase Edge Functions (Server-side)
```bash
# PayU Credentials (only for production)
supabase secrets set PAYU_KEY=your_payu_merchant_key
supabase secrets set PAYU_SALT=your_payu_salt
```

#### Frontend (Client-side)
```env
VITE_PAYU_MODE=production
# VITE_PAYU_KEY is optional, key comes from edge function
```

**Note**: For testing, you don't need to set any environment variables! The system works out of the box with PayU test credentials.

### 3. Deploy Edge Functions

Deploy the PayU-related edge functions:

```bash
# Deploy hash generation function
supabase functions deploy generate-payu-hash

# Deploy callback handler (optional - for webhook-based updates)
supabase functions deploy payu-callback
```

### 4. PayU Dashboard Configuration

#### Success URL
```
https://your-domain.com/payment/success
```

#### Failure URL
```
https://your-domain.com/payment/failure
```

### 5. Testing

#### Test Payment Flow
1. Add items to cart
2. Go to checkout
3. Select or add delivery address
4. Choose "Pay Online (PayU)" payment method
5. Click "Pay Now"
6. You'll be redirected to PayU test payment page
7. Use PayU test credentials to complete payment
8. You'll be redirected back to success/failure page

#### PayU Test Credentials
- **Test Card**: 5123456789012346
- **CVV**: 123
- **Expiry**: Any future date (e.g., 12/25)
- **Name**: Any name

### 6. Features Implemented

#### Address Management
- ✅ Save multiple delivery addresses in Profile
- ✅ Set default address
- ✅ Add, edit, delete addresses
- ✅ Select address during checkout
- ✅ Add new address during checkout (without leaving page)

#### Payment Integration
- ✅ PayU payment gateway integration
- ✅ Server-side hash generation (secure)
- ✅ Redirect to PayU payment page
- ✅ Success/failure callback handling
- ✅ Order status updates after payment

#### Invoice Generation
- ✅ Download invoice for COD orders
- ✅ Download invoice for PayU orders
- ✅ Professional invoice format
- ✅ Print-friendly layout

## File Structure

```
live-mart-connect/
├── supabase/
│   ├── migrations/
│   │   └── 20251128000000_create_user_addresses_table.sql
│   └── functions/
│       ├── generate-payu-hash/
│       │   └── index.ts
│       └── payu-callback/
│           └── index.ts
├── src/
│   ├── components/
│   │   ├── addresses/
│   │   │   ├── AddressForm.tsx
│   │   │   ├── AddressList.tsx
│   │   │   └── AddressSelector.tsx
│   │   └── PaymentMethodSelector.tsx
│   ├── lib/
│   │   └── invoiceGenerator.ts
│   └── pages/
│       ├── Checkout.tsx (updated)
│       ├── Account.tsx (updated)
│       ├── PaymentSuccess.tsx (updated)
│       └── PaymentFailure.tsx (new)
└── PAYU_SETUP_INSTRUCTIONS.md
```

## API Endpoints

### Generate PayU Hash
**Endpoint**: `POST /functions/v1/generate-payu-hash`

**Headers**:
```
Authorization: Bearer <user_jwt_token>
Content-Type: application/json
```

**Body**:
```json
{
  "txnid": "ORDER_<orderId>_<timestamp>",
  "amount": "1000.00",
  "productinfo": "Product 1, Product 2",
  "firstname": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210"
}
```

**Response**:
```json
{
  "success": true,
  "hash": "abc123...",
  "key": "your_payu_key"
}
```

### PayU Callback (Optional)
**Endpoint**: `POST /functions/v1/payu-callback`

**Purpose**: Handle PayU webhook callbacks for payment status updates

**Note**: Currently, payment status is verified on the frontend redirect. This callback can be used for additional verification or webhook-based updates.

## Security Notes

1. **Hash Generation**: PayU hash is generated server-side (edge function) using SHA-512. Never generate hashes on the client.

2. **Hash Verification**: When PayU redirects back, verify the hash to ensure the payment response is legitimate.

3. **Order Creation**: Orders are created before payment. Payment status is updated after successful payment.

4. **Environment Variables**: Keep PayU credentials secure. Never commit them to version control.

## Troubleshooting

### Issue: Hash generation fails
**Solution**: Check that `PAYU_KEY` and `PAYU_SALT` are set correctly in Supabase secrets.

### Issue: Payment redirect not working
**Solution**: 
- Verify `VITE_PAYU_MODE` is set correctly
- Check PayU dashboard for correct success/failure URLs
- Ensure PayU merchant account is active

### Issue: Invoice download not working
**Solution**: 
- Check browser popup blocker settings
- Ensure invoice data is loaded correctly
- Verify order details are available

## Support

For PayU-specific issues, refer to:
- [PayU Developer Documentation](https://devguide.payu.in/)
- [PayU Test Environment](https://test.payu.in/)

For application issues, check:
- Supabase function logs
- Browser console for frontend errors
- Network tab for API requests

