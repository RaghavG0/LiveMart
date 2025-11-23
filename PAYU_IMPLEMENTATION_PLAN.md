# PayU Integration & Multi-Address Management - Implementation Plan

## Files to Create

### Database Migrations
1. **`supabase/migrations/20251128000000_create_user_addresses_table.sql`**
   - Creates `user_addresses` table
   - Fields: id, user_id, address_line_1, address_line_2, city, state, zip, country, is_default, label (Home/Work/Other), phone, created_at, updated_at

### Edge Functions
2. **`supabase/functions/generate-payu-hash/index.ts`**
   - Generates PayU hash using SHA-512
   - Requires: PAYU_KEY, PAYU_SALT from environment
   - Input: transaction details (txnid, amount, productinfo, firstname, email, etc.)
   - Output: hash string

### Frontend Components
3. **`src/components/addresses/AddressSelector.tsx`**
   - Component to select/manage addresses in Checkout
   - Shows saved addresses as radio buttons
   - "Add New Address" button opens modal

4. **`src/components/addresses/AddressForm.tsx`**
   - Reusable form for adding/editing addresses
   - Fields: address_line_1, address_line_2, city, state, zip, phone, label

5. **`src/components/addresses/AddressList.tsx`**
   - Lists all saved addresses in Profile page
   - Edit/Delete functionality
   - Set default address

### Pages
6. **`src/pages/PaymentSuccess.tsx`** (Update existing)
   - Add invoice download button
   - Handle PayU success callback

7. **`src/pages/PaymentFailure.tsx`** (New)
   - Display payment failure message
   - Retry payment option
   - Link back to orders

### Utilities
8. **`src/lib/invoiceGenerator.ts`** (New)
   - Generate PDF invoices using pdfmake or similar
   - Support for both COD and PayU orders

## Files to Modify

### Existing Files
1. **`src/pages/Account.tsx`**
   - Add "Manage Addresses" section
   - Import and render AddressList component

2. **`src/pages/Checkout.tsx`**
   - Replace deliveryAddress textarea with AddressSelector
   - Update handlePlaceOrder to handle PayU flow
   - Create order first, then redirect to PayU
   - Store selected_address_id in order

3. **`src/components/PaymentMethodSelector.tsx`**
   - Add "Pay Online (PayU)" option
   - Keep COD option

4. **`src/pages/PaymentSuccess.tsx`**
   - Add invoice download functionality
   - Handle both COD and PayU orders

5. **`src/App.tsx`**
   - Add routes: `/payment/success`, `/payment/failure`

6. **Database Schema - orders table**
   - Add `selected_address_id` column (references user_addresses.id)
   - Keep `delivery_address` for backward compatibility

## Implementation Order

### Phase 1: Address Management
1. Create migration for `user_addresses` table
2. Create AddressForm, AddressList, AddressSelector components
3. Update Account.tsx to show address management
4. Update Checkout.tsx to use AddressSelector

### Phase 2: PayU Integration
1. Create generate-payu-hash edge function
2. Update PaymentMethodSelector to include PayU
3. Update Checkout.tsx to handle PayU flow
4. Create PaymentSuccess and PaymentFailure pages

### Phase 3: Invoice Generation
1. Create invoiceGenerator utility
2. Update PaymentSuccess page to include download button
3. Test invoice generation for both payment methods

## PayU Integration Flow

1. User selects PayU payment method
2. User clicks "Pay Now" (button text changes)
3. Frontend creates order first (status: pending, payment_status: pending)
4. Frontend calls `generate-payu-hash` edge function with order details
5. Edge function returns hash
6. Frontend creates hidden form with PayU parameters
7. Form auto-submits to PayU payment page
8. User completes payment on PayU
9. PayU redirects to success/failure URL
10. Success page shows invoice download option

## Environment Variables Required

```bash
PAYU_KEY=your_payu_merchant_key
PAYU_SALT=your_payu_salt
PAYU_MODE=test  # or "production"
```

## SQL Migration Summary

```sql
-- user_addresses table
CREATE TABLE user_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  address_line_1 TEXT NOT NULL,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  country TEXT DEFAULT 'India',
  phone TEXT,
  label TEXT CHECK (label IN ('Home', 'Work', 'Other')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add selected_address_id to orders table
ALTER TABLE orders ADD COLUMN selected_address_id UUID REFERENCES user_addresses(id);
```

