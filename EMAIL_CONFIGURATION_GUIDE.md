# Email Configuration Guide for OTP System

## Issue: OTP Emails Not Being Delivered

If OTP emails are not being delivered, the system will now provide detailed logging to help diagnose the issue.

## Configuration Options

The system supports three methods for sending emails, tried in order:

### Method 1: Gmail API with OAuth Refresh Token (Recommended for Production)

**Option A: Using Refresh Token (Recommended - Auto-refreshes)**

**Required Environment Variables:**
```env
GMAIL_USER=your-email@gmail.com
GMAIL_CLIENT_ID=your-oauth-client-id
GMAIL_CLIENT_SECRET=your-oauth-client-secret
GMAIL_REFRESH_TOKEN=your-oauth-refresh-token
```

**Setup Steps:**
1. Create a Google Cloud Project
2. Enable Gmail API
3. Create OAuth 2.0 credentials (OAuth Client ID)
4. Generate a refresh token with `gmail.send` scope
5. Set the environment variables in Supabase Edge Functions

**To set in Supabase:**
```bash
# Using Supabase CLI
supabase secrets set GMAIL_USER=your-email@gmail.com
supabase secrets set GMAIL_CLIENT_ID=your-client-id
supabase secrets set GMAIL_CLIENT_SECRET=your-client-secret
supabase secrets set GMAIL_REFRESH_TOKEN=your-refresh-token
```

**Or in Supabase Dashboard:**
1. Go to Project Settings → Edge Functions → Secrets
2. Add `GMAIL_USER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN`

**Option B: Using Direct Access Token (Alternative - Manual refresh needed)**

**Required Environment Variables:**
```env
GMAIL_USER=your-email@gmail.com
GMAIL_ACCESS_TOKEN=your-oauth-access-token
```

**Note:** Access tokens expire after 1 hour. Refresh token method (Option A) is preferred as it auto-refreshes.

### Method 2: EmailJS (Alternative)

**Required Environment Variables:**
```env
EMAILJS_SERVICE_ID=your-service-id
EMAILJS_TEMPLATE_ID=your-template-id
EMAILJS_PUBLIC_KEY=your-public-key
```

**Setup Steps:**
1. Sign up at https://www.emailjs.com/
2. Create an email service
3. Create a template
4. Get your Public Key
5. Set the environment variables

### Method 3: Mock/Development (Fallback)

If neither Gmail API nor EmailJS is configured, the system will:
- Log the OTP to console (for development)
- Return an error indicating email was not sent
- **This should NOT be used in production**

## Debugging Email Delivery

### Check Edge Function Logs

View logs in Supabase Dashboard:
1. Go to Edge Functions → `send-login-otp`
2. Check the Logs tab

Look for:
- ✅ `✓ Login OTP sent to {email} via Gmail API` - Success
- ❌ `❌ Gmail API error:` - Gmail API failed
- ❌ `❌ EmailJS error:` - EmailJS failed
- ⚠️ `⚠️ [MOCK MODE]` - No email service configured

### Common Issues

1. **"Email service not configured"**
   - Solution: Configure Gmail API or EmailJS (see above)

2. **"Gmail API error: 401 Unauthorized"**
   - Solution: Invalid or expired OAuth token. Regenerate the access token.

3. **"Gmail API error: 403 Forbidden"**
   - Solution: Token doesn't have `gmail.send` scope. Regenerate with correct scope.

4. **EmailJS errors**
   - Solution: Verify service ID, template ID, and public key are correct

## Verification

After configuration:
1. Try sending an OTP
2. Check Edge Function logs for success message
3. Check your email inbox (and spam folder)
4. If using mock mode, OTP will be in console logs

## Next Steps

1. Configure one of the email services above
2. Redeploy the edge function: `supabase functions deploy send-login-otp`
3. Test the OTP flow
4. Check logs if emails still don't arrive

