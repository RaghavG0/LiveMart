# 📧 Resend Email Service Integration Guide

Complete guide to integrate Resend transactional email service into LiveMart's subscription system.

---

## 📋 Table of Contents
1. [What is Resend?](#what-is-resend)
2. [Step 1: Create Resend Account](#step-1-create-resend-account)
3. [Step 2: Get Your API Key](#step-2-get-your-api-key)
4. [Step 3: Verify Your Domain (Production)](#step-3-verify-your-domain-production)
5. [Step 4: Add API Key to Supabase](#step-4-add-api-key-to-supabase)
6. [Step 5: Update Edge Function](#step-5-update-edge-function)
7. [Step 6: Deploy the Function](#step-6-deploy-the-function)
8. [Step 7: Test the Integration](#step-7-test-the-integration)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 What is Resend?

**Resend** is a modern email API service that makes it easy to send transactional emails. It's perfect for:
- Welcome emails
- Order confirmations
- Password resets
- Newsletter subscriptions

**Why Resend?**
- ✅ Simple API
- ✅ Free tier: 3,000 emails/month
- ✅ Fast delivery
- ✅ Developer-friendly
- ✅ Great for Deno/Edge Functions

---

## Step 1: Create Resend Account

1. **Visit Resend**: Go to [https://resend.com](https://resend.com)

2. **Sign Up**: Click "Sign Up" (top right)

3. **Choose Method**:
   - Sign up with GitHub (recommended)
   - Or use email/password

4. **Verify Email**: Check your inbox and click the verification link

---

## Step 2: Get Your API Key

1. **Login** to Resend Dashboard

2. **Navigate to API Keys**:
   - Click on **"API Keys"** in the left sidebar
   - Or go directly: [https://resend.com/api-keys](https://resend.com/api-keys)

3. **Create New API Key**:
   - Click **"Create API Key"** button
   - **Name**: `LiveMart Supabase Functions` (or any name you prefer)
   - **Permission**: Select **"Full Access"** (or "Sending Access" if you want to restrict)
   - Click **"Add"**

4. **Copy Your API Key**:
   - ⚠️ **IMPORTANT**: Copy the API key immediately!
   - It starts with `re_` (e.g., `re_1234567890abcdef...`)
   - You won't be able to see it again after closing this modal
   - Save it securely (you'll need it in Step 4)

---

## Step 3: Verify Your Domain (Production)

**For Testing (Optional)**: You can skip this step and use Resend's test domain `onboarding@resend.dev` for development.

**For Production**: You need to verify your domain to send emails from `noreply@yourdomain.com`.

1. **Go to Domains**: Click **"Domains"** in Resend dashboard

2. **Add Domain**:
   - Click **"Add Domain"**
   - Enter your domain: `livemart.com` (or your actual domain)
   - Click **"Add"**

3. **Add DNS Records**:
   Resend will provide DNS records. Add these to your domain's DNS settings:

   ```
   Type: TXT
   Name: @
   Value: [Value provided by Resend]
   
   Type: MX
   Name: @
   Value: feedback-smtp.resend.com
   Priority: 10
   
   Type: CNAME
   Name: resend._domainkey
   Value: [Value provided by Resend]
   ```

4. **Wait for Verification**: Usually takes 5-60 minutes. Check status in Resend dashboard.

5. **Once Verified**: You can send from any email on your domain (e.g., `noreply@livemart.com`)

---

## Step 4: Add API Key to Supabase

Now we need to add the Resend API key as a secret environment variable in Supabase.

### Option A: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**: [https://supabase.com/dashboard](https://supabase.com/dashboard)

2. **Select Your Project**: Click on your LiveMart project (`cdvhodymzfwdzfeltmsu`)

3. **Navigate to Edge Functions**:
   - Click **"Edge Functions"** in the left sidebar
   - Or go to: `Project Settings` → `Edge Functions`

4. **Go to Secrets**:
   - Click on **"Secrets"** tab (top of the page)

5. **Add New Secret**:
   - Click **"New Secret"** button
   - **Name**: `RESEND_API_KEY`
   - **Value**: Paste your Resend API key (starts with `re_`)
   - Click **"Add Secret"**

6. **Verify**: You should see `RESEND_API_KEY` in the secrets list

### Option B: Using Supabase CLI (Alternative)

```bash
# Install Supabase CLI (if not already installed)
brew install supabase/tap/supabase

# Login to Supabase
supabase login

# Link your project
cd /Users/raghavgulati/Desktop/oop/live-mart-connect
supabase link --project-ref cdvhodymzfwdzfeltmsu

# Set the secret
supabase secrets set RESEND_API_KEY=re_your_actual_api_key_here
```

**Verify it was set:**
```bash
supabase secrets list
```

---

## Step 5: Update Edge Function

The Edge Function code has been updated to use Resend. Here's what it does:

### Key Features:
- ✅ Sends welcome email via Resend API
- ✅ Uses environment variable for API key
- ✅ Handles errors gracefully
- ✅ Includes unsubscribe instructions
- ✅ Professional email template

### The Code (Already Updated):

The function at `/supabase/functions/subscribe-email/index.ts` now:
1. Gets `RESEND_API_KEY` from environment variables
2. Calls Resend API to send welcome email
3. Uses your verified domain (or test domain)
4. Includes proper error handling

**Email Details:**
- **From**: `LiveMart <noreply@livemart.com>` (or your verified domain)
- **Subject**: "Welcome to LiveMart Alerts & Notifications!"
- **Content**: Welcome message with unsubscribe instructions

---

## Step 6: Deploy the Function

Now deploy the updated Edge Function to Supabase:

### Option A: Using Supabase CLI (Recommended)

```bash
# Navigate to project directory
cd /Users/raghavgulati/Desktop/oop/live-mart-connect

# Deploy the subscribe-email function
supabase functions deploy subscribe-email

# Or deploy all functions
supabase functions deploy
```

**Expected Output:**
```
Deploying function subscribe-email...
Function subscribe-email deployed successfully!
```

### Option B: Using Supabase Dashboard

1. **Go to Edge Functions** in Supabase Dashboard
2. **Click "Deploy"** (if you have the function code there)
3. Or use **"Create Function"** and paste the code

---

## Step 7: Test the Integration

### Test 1: Subscribe via Website

1. **Open your LiveMart website**
2. **Scroll to footer**
3. **Enter your email** in the subscription form
4. **Click "Subscribe"**
5. **Check your inbox** - you should receive a welcome email within seconds!

### Test 2: Check Edge Function Logs

1. **Go to Supabase Dashboard** → **Edge Functions**
2. **Click on `subscribe-email`** function
3. **Go to "Logs" tab**
4. **Look for**:
   - `Successfully subscribed email: your@email.com`
   - `[Email Service] Email sent successfully via Resend`

### Test 3: Check Resend Dashboard

1. **Go to Resend Dashboard** → **Emails**
2. **You should see**:
   - Email sent to your address
   - Status: "Delivered" ✅
   - Timestamp of when it was sent

### Test 4: Verify Email Content

Check your inbox for:
- ✅ Correct "From" address
- ✅ Subject: "Welcome to LiveMart Alerts & Notifications!"
- ✅ Professional welcome message
- ✅ Unsubscribe instructions

---

## 🐛 Troubleshooting

### Issue 1: "Failed to send email" in logs

**Possible Causes:**
- API key not set correctly
- API key doesn't have proper permissions
- Domain not verified (if using custom domain)

**Solutions:**
1. **Verify API Key**: Check it starts with `re_` and is correct
2. **Check Secrets**: `supabase secrets list` should show `RESEND_API_KEY`
3. **Test with Resend Test Domain**: Use `onboarding@resend.dev` for testing

### Issue 2: Email not received

**Check:**
1. **Spam Folder**: Check your spam/junk folder
2. **Resend Dashboard**: Check if email shows as "Delivered"
3. **Edge Function Logs**: Check for errors in Supabase logs
4. **Email Address**: Verify the email address is correct

### Issue 3: "Unauthorized" or "401" error

**Cause**: Invalid or missing API key

**Solution:**
1. Regenerate API key in Resend dashboard
2. Update the secret in Supabase: `supabase secrets set RESEND_API_KEY=new_key`
3. Redeploy the function

### Issue 4: Domain verification failed

**Solutions:**
1. Double-check DNS records match exactly (no extra spaces)
2. Wait up to 60 minutes for DNS propagation
3. Use Resend's test domain (`onboarding@resend.dev`) for development
4. Contact Resend support if issues persist

### Issue 5: Function deployment fails

**Solutions:**
1. Check you're logged in: `supabase login`
2. Verify project link: `supabase link --project-ref cdvhodymzfwdzfeltmsu`
3. Check for syntax errors in the function code
4. Try deploying with verbose output: `supabase functions deploy subscribe-email --debug`

---

## 📧 Email Template Customization

You can customize the welcome email in the Edge Function:

**Location**: `/supabase/functions/subscribe-email/index.ts`

**Find this section** (around line 25-40):
```typescript
const emailSubject = "Welcome to LiveMart Alerts & Notifications!";
const emailBody = `
Hi there,
...
`;
```

**Customize**:
- Change subject line
- Modify email content
- Add HTML formatting (Resend supports HTML emails)
- Add your branding

**Example HTML Email**:
```typescript
const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .header { background-color: #10b981; color: white; padding: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Welcome to LiveMart!</h1>
  </div>
  <p>You are now subscribed...</p>
</body>
</html>
`;

// Then in the Resend API call:
body: JSON.stringify({
  from: 'LiveMart <noreply@livemart.com>',
  to: [email],
  subject: emailSubject,
  html: emailHtml,  // Use HTML instead of text
}),
```

---

## ✅ Success Checklist

- [ ] Resend account created
- [ ] API key generated and saved
- [ ] API key added to Supabase secrets
- [ ] Domain verified (optional, for production)
- [ ] Edge Function updated with Resend code
- [ ] Function deployed to Supabase
- [ ] Test subscription sent
- [ ] Welcome email received
- [ ] Email appears in Resend dashboard

---

## 🎉 You're Done!

Your email subscription system is now fully integrated with Resend! 

**Next Steps:**
- Monitor email delivery in Resend dashboard
- Customize email templates
- Set up additional email types (order confirmations, etc.)
- Monitor unsubscribe rates

**Need Help?**
- Resend Docs: [https://resend.com/docs](https://resend.com/docs)
- Resend Support: support@resend.com
- Supabase Docs: [https://supabase.com/docs](https://supabase.com/docs)

---

**Last Updated**: 2024-11-21
**Version**: 1.0.0

