# OTP Sign-Up & Verification System - Setup Guide

## Overview

This document describes the complete Sign-Up and OTP Verification flow implementation.

## Features Implemented

### 1. Initial Sign-Up Screen (`/signup`)
- Email, Mobile Number, and Password fields
- Email format validation
- Error message: "Please enter a valid mail ID" for invalid emails
- Redirects to OTP verification page (does NOT create account yet)

### 2. OTP Verification Screen (`/verify-otp`)
- 6-digit OTP input (6 separate input boxes)
- Auto-sends OTP to email on page load
- 30-second countdown timer
- "Resend OTP" and "Receive via SMS" buttons (disabled initially)
- Buttons enabled after 30 seconds
- Account creation only after successful OTP verification

### 3. Backend Functions
- `send-signup-otp`: Sends OTP via email or SMS
- `verify-signup-otp`: Verifies OTP and creates account

---

## Database Schema

### `signup_otps` Table
```sql
- id (UUID, Primary Key)
- email (TEXT, NOT NULL)
- phone (TEXT, nullable)
- otp_code (TEXT, NOT NULL) - 6-digit code
- otp_type (TEXT) - 'email' or 'sms'
- expires_at (TIMESTAMP) - 10 minutes from creation
- verified (BOOLEAN) - Default false
- attempts (INTEGER) - Verification attempts counter
- created_at (TIMESTAMP)
- verified_at (TIMESTAMP, nullable)
```

---

## API Endpoints

### 1. POST `/send-signup-otp`
**Purpose**: Send OTP to email or phone

**Request Body**:
```json
{
  "email": "user@example.com",
  "phone": "+1234567890",  // Optional, required for SMS
  "otpType": "email"  // or "sms"
}
```

**Response**:
```json
{
  "success": true,
  "message": "OTP sent to your email",
  "expiresAt": "2024-11-24T12:00:00Z"
}
```

**Features**:
- Generates 6-digit OTP
- Stores in database with 10-minute expiration
- Invalidates previous unverified OTPs
- Checks if user already exists
- Sends via email or SMS (mock functions included)

---

### 2. POST `/verify-signup-otp`
**Purpose**: Verify OTP and create account

**Request Body**:
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "password": "userpassword",
  "fullName": "John Doe",  // Optional
  "phone": "+1234567890",  // Optional
  "role": "customer",  // Optional, default: "customer"
  "locationAddress": "...",  // Optional
  "locationLat": 12.34,  // Optional
  "locationLng": 56.78  // Optional
}
```

**Response**:
```json
{
  "success": true,
  "message": "Account created successfully!",
  "userId": "uuid"
}
```

**Error Responses**:
- `"OTP Mismatch, please try again."` - Invalid OTP
- `"OTP has expired. Please request a new one."` - Expired OTP
- `"Too many failed attempts. Please request a new OTP."` - Max 5 attempts

**Features**:
- Verifies OTP code
- Checks expiration
- Prevents brute force (max 5 attempts)
- Creates user account only after successful verification
- Auto-confirms email (since OTP is verified)
- Creates profile via database trigger

---

## Frontend Components

### 1. SignUp Page (`src/pages/SignUp.tsx`)
**Features**:
- Email validation with regex
- Real-time error display
- Stores data in sessionStorage
- Redirects to `/verify-otp` on valid email

**Validation**:
- Email format: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Password: Minimum 6 characters
- Mobile: Optional but validated if provided

---

### 2. VerifyOTP Page (`src/pages/VerifyOTP.tsx`)
**Features**:
- 6 separate input boxes for OTP
- Auto-focus next input on digit entry
- Paste support (6 digits)
- Backspace navigation
- 30-second countdown timer
- Disabled buttons during countdown
- Resend OTP via email
- Receive OTP via SMS
- Error handling with "OTP Mismatch" message
- Auto sign-in after successful verification

**Timer Logic**:
```javascript
- Starts at 30 seconds
- Counts down every second
- Disables buttons during countdown
- Enables buttons when timer reaches 0
- Restarts timer when OTP is resent
```

**OTP Input Features**:
- Only accepts digits (0-9)
- Auto-advances to next input
- Supports paste (6 digits)
- Handles backspace navigation
- Clears on error

---

## Setup Instructions

### 1. Run Database Migration
```bash
cd live-mart-connect
supabase migration up
```

### 2. Deploy Edge Functions
```bash
supabase functions deploy send-signup-otp
supabase functions deploy verify-signup-otp
```

### 3. Configure Email Service (Optional)

**Option A: Resend (Recommended)**
1. Sign up at https://resend.com
2. Get your API key
3. Update `send-signup-otp/index.ts`:
   - Uncomment the Resend code block
   - Set environment variable: `RESEND_API_KEY`

**Option B: SendGrid**
- Similar process, replace with SendGrid API

**Option C: AWS SES**
- Configure AWS credentials and use SES SDK

### 4. Configure SMS Service (Optional)

**Option A: Twilio (Recommended)**
1. Sign up at https://twilio.com
2. Get Account SID, Auth Token, and Phone Number
3. Update `send-signup-otp/index.ts`:
   - Uncomment the Twilio code block
   - Set environment variables:
     - `TWILIO_ACCOUNT_SID`
     - `TWILIO_AUTH_TOKEN`
     - `TWILIO_PHONE_NUMBER`

**Option B: AWS SNS**
- Configure AWS credentials and use SNS SDK

**Note**: For development/testing, the mock functions will work and log OTPs to console.

---

## Environment Variables

Add these to your Supabase project settings (Edge Functions secrets):

### For Email (Resend):
```
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### For SMS (Twilio):
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

### For Site URL:
```
SITE_URL=https://yourdomain.com
```

---

## User Flow

```
1. User visits /signup
   ↓
2. Enters Email, Mobile, Password
   ↓
3. Clicks "Sign Up"
   ↓
4. Email validation
   ├─ Invalid → Show error: "Please enter a valid mail ID"
   └─ Valid → Redirect to /verify-otp
   ↓
5. OTP page loads
   ├─ Auto-sends OTP to email
   ├─ Starts 30-second timer
   └─ Buttons disabled
   ↓
6. User enters 6-digit OTP
   ↓
7. Clicks "Verify & Create Account"
   ├─ OTP Valid → Create account → Auto sign-in → Navigate to home
   └─ OTP Invalid → Show error: "OTP Mismatch, please try again."
   ↓
8. After 30 seconds
   ├─ "Resend OTP" button enabled
   └─ "Receive via SMS" button enabled
   ↓
9. User can resend OTP (email or SMS)
   └─ Timer restarts
```

---

## Security Features

1. **OTP Expiration**: 10 minutes
2. **Max Attempts**: 5 attempts per OTP
3. **Auto-cleanup**: Expired OTPs cleaned up after 1 hour
4. **One-time Use**: OTP marked as verified after use
5. **Invalidation**: Previous OTPs invalidated when new one is sent
6. **Brute Force Protection**: Max 5 attempts tracked

---

## Testing

### Test Email OTP (Mock Mode)
1. Sign up with valid email
2. Check browser console for OTP: `[MOCK] Sending OTP to email@example.com: 123456`
3. Enter OTP in verification page
4. Account should be created

### Test SMS OTP (Mock Mode)
1. After 30 seconds, click "Receive via SMS"
2. Check browser console for OTP: `[MOCK] Sending OTP to +1234567890: 123456`
3. Enter OTP
4. Account should be created

### Test Error Cases
- Invalid email format → Should show error
- Wrong OTP → Should show "OTP Mismatch"
- Expired OTP → Should show expiration error
- Too many attempts → Should show max attempts error

---

## Code Structure

```
Frontend:
├── src/pages/SignUp.tsx          # Initial signup form
└── src/pages/VerifyOTP.tsx       # OTP verification page

Backend:
├── supabase/functions/
│   ├── send-signup-otp/index.ts  # Send OTP (email/SMS)
│   └── verify-signup-otp/index.ts # Verify OTP & create account
└── supabase/migrations/
    └── 20251124000000_otp_verification_system.sql
```

---

## Next Steps

1. **Configure Email Service**: Uncomment and configure Resend/SendGrid code
2. **Configure SMS Service**: Uncomment and configure Twilio code
3. **Customize Email Template**: Update HTML template in `send-signup-otp`
4. **Add Rate Limiting**: Add per-email/IP rate limiting
5. **Add Analytics**: Track OTP send/verify success rates

---

## Notes

- Mock functions are included for development/testing
- OTPs are logged to console in mock mode
- Account is only created after successful OTP verification
- Email is auto-confirmed (no need for email verification link)
- Timer uses `setInterval` for accurate countdown
- All buttons properly disabled/enabled based on timer state

