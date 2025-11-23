# PayU Test Mode Setup (No API Keys Required)

## Overview
You can test the PayU payment integration without setting up actual API keys. The system supports two modes:

1. **Mock Payment Mode** - Completely simulates payment without calling PayU
2. **PayU Test Mode** - Uses PayU's default test credentials

## Option 1: Mock Payment Mode (Recommended for Testing)

This mode simulates the payment flow without any external API calls.

### Setup

Add to your `.env` or `.env.local` file:

```env
VITE_USE_MOCK_PAYMENT=true
```

### How It Works

- When user clicks "Pay Now", the system simulates a payment
- Order status is automatically updated to "paid" and "confirmed"
- User is redirected to the success page
- No actual payment is processed
- No PayU credentials required

### Benefits

- ✅ No API keys needed
- ✅ Works offline
- ✅ Fast testing
- ✅ No external dependencies

## Option 2: PayU Test Mode (Uses PayU Test Environment)

This mode uses PayU's default test credentials to connect to their test payment gateway.

### Setup

**No configuration needed!** The system uses PayU's default test credentials automatically:
- Test Key: `gtKFFx`
- Test Salt: `eCwWELxi`

### How It Works

- When user clicks "Pay Now", they are redirected to PayU's test payment page
- Uses PayU's default test merchant account
- Payment is processed on PayU's test servers (no real money)
- User completes payment with test card details
- Redirects back to your success/failure page

### PayU Test Card Details

- **Card Number**: `5123456789012346`
- **CVV**: `123`
- **Expiry**: Any future date (e.g., `12/25`)
- **Name**: Any name

### Benefits

- ✅ Tests real PayU integration flow
- ✅ No API keys required (uses default test credentials)
- ✅ Experience actual PayU payment page
- ✅ Good for UI/UX testing

## Configuration Options

### Environment Variables (Optional)

```env
# Enable mock payment mode (no external calls)
VITE_USE_MOCK_PAYMENT=true

# OR use PayU test mode (default)
VITE_PAYU_MODE=test

# Optional: Override test credentials if you have your own test account
# VITE_PAYU_KEY=your_test_key
# VITE_PAYU_SALT=your_test_salt
```

## Switching Between Modes

### To Use Mock Payment Mode:
```env
VITE_USE_MOCK_PAYMENT=true
```

### To Use PayU Test Mode:
```env
# Remove or set to false
VITE_USE_MOCK_PAYMENT=false
# OR simply don't set it (default behavior)
```

### To Use Production PayU:
```env
VITE_USE_MOCK_PAYMENT=false
VITE_PAYU_MODE=production
# Set real credentials in Supabase secrets
```

## Testing Checklist

### Mock Payment Mode
- [ ] Add items to cart
- [ ] Go to checkout
- [ ] Select PayU payment method
- [ ] Click "Pay Now"
- [ ] Verify payment is simulated
- [ ] Check order status is updated to "paid"
- [ ] Verify redirect to success page
- [ ] Test invoice download

### PayU Test Mode
- [ ] Add items to cart
- [ ] Go to checkout
- [ ] Select PayU payment method
- [ ] Click "Pay Now"
- [ ] Verify redirect to PayU test page
- [ ] Use test card details to complete payment
- [ ] Verify redirect back to success page
- [ ] Check order status is updated
- [ ] Test invoice download

## Default Behavior

If no environment variables are set:
- ✅ System uses **PayU Test Mode** with default test credentials
- ✅ No API keys required
- ✅ Works out of the box for testing

## Notes

1. **Mock Mode** is perfect for:
   - Development testing
   - UI/UX testing
   - Offline development
   - Quick iterations

2. **Test Mode** is perfect for:
   - Integration testing
   - Testing actual PayU flow
   - Verifying redirect URLs
   - End-to-end testing

3. **Production Mode** requires:
   - Real PayU merchant account
   - Production API keys in Supabase secrets
   - `VITE_PAYU_MODE=production`

## Troubleshooting

### Mock Payment Not Working
- Check that `VITE_USE_MOCK_PAYMENT=true` is set
- Check browser console for errors
- Verify order is being created

### PayU Test Mode Not Working
- Check browser console for errors
- Verify network connectivity
- Check that PayU test page loads

### Payment Redirect Issues
- Verify success/failure URLs in PayU dashboard (if using custom test account)
- Check browser popup blockers
- Verify order ID is being passed correctly

## Summary

**For testing without API keys, you have two options:**

1. **Mock Mode** (`VITE_USE_MOCK_PAYMENT=true`) - Fast, offline, no external calls
2. **Test Mode** (default) - Uses PayU test credentials automatically, no setup needed

Both modes work without any API key configuration! 🎉

