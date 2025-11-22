# 🔧 Troubleshooting Subscribe Email Error

## Error: "Edge Function returned a non-2xx status code"

This error means the Edge Function is returning an error status (400, 500, etc.). Here's how to fix it:

---

## ✅ Step 1: Run Database Migration

The most common cause is that the `subscribers` table doesn't exist yet.

### Option A: Using Supabase CLI

```bash
# Navigate to project directory
cd /Users/raghavgulati/Desktop/oop/live-mart-connect

# Link your project (if not already linked)
supabase login
supabase link --project-ref cdvhodymzfwdzfeltmsu

# Push migrations to create the subscribers table
supabase db push

# Or apply the specific migration
supabase migration up
```

### Option B: Using Supabase Dashboard

1. **Go to Supabase Dashboard**: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **Select your project**: `cdvhodymzfwdzfeltmsu`
3. **Go to SQL Editor**: Click "SQL Editor" in the left sidebar
4. **Run the migration**: Copy and paste the contents of:
   `/supabase/migrations/20251121120000_create_subscribers_table.sql`
5. **Click "Run"** to execute the SQL

### Verify Table Exists

```sql
-- Run this in Supabase SQL Editor
SELECT * FROM subscribers LIMIT 1;
```

If you get an error, the table doesn't exist. Run the migration.

---

## ✅ Step 2: Deploy the Edge Function

The function might not be deployed yet.

```bash
# Navigate to project directory
cd /Users/raghavgulati/Desktop/oop/live-mart-connect

# Deploy the subscribe-email function
supabase functions deploy subscribe-email
```

**Expected Output:**
```
Deploying function subscribe-email...
✓ Function subscribe-email deployed successfully!
```

---

## ✅ Step 3: Check Edge Function Logs

To see the actual error:

1. **Go to Supabase Dashboard** → Your Project
2. **Click "Edge Functions"** in left sidebar
3. **Click on `subscribe-email`** function
4. **Go to "Logs" tab**
5. **Look for error messages** - this will show you the exact problem

**Common errors you might see:**

### Error: "relation 'subscribers' does not exist"
**Fix**: Run the migration (Step 1)

### Error: "permission denied for table subscribers"
**Fix**: Check RLS policies are set correctly in the migration

### Error: "RESEND_API_KEY not found"
**Fix**: This is OK! The function will still work, it just won't send emails. Add the Resend API key later.

---

## ✅ Step 4: Test the Function Manually

You can test the function directly:

### Using curl:

```bash
curl -X POST https://cdvhodymzfwdzfeltmsu.supabase.co/functions/v1/subscribe-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"email": "test@example.com"}'
```

### Using Supabase Dashboard:

1. Go to **Edge Functions** → `subscribe-email`
2. Click **"Invoke Function"** tab
3. Enter:
   ```json
   {
     "email": "test@example.com"
   }
   ```
4. Click **"Invoke"**
5. Check the response - if it's 500, check the logs

---

## ✅ Step 5: Verify Everything Works

1. **Go to your website**
2. **Scroll to footer**
3. **Enter an email**
4. **Click Subscribe**
5. **Should see success toast** ✅
6. **Check Supabase Dashboard** → Database → `subscribers` table - your email should be there

---

## 🔍 Common Issues & Solutions

### Issue 1: Function Not Found (404)

**Error**: "Edge Function not found"

**Solution**:
```bash
# Deploy the function
supabase functions deploy subscribe-email
```

---

### Issue 2: Database Table Missing (500)

**Error**: "relation 'subscribers' does not exist"

**Solution**:
```bash
# Run migration
supabase db push
```

Or apply via SQL Editor in Supabase Dashboard.

---

### Issue 3: Permission Denied (403)

**Error**: "permission denied for table subscribers"

**Solution**: 
- Check that RLS policies are set in the migration
- Verify the service role key is set correctly
- Check that the migration was applied fully

---

### Issue 4: CORS Error

**Error**: CORS-related errors in browser console

**Solution**: The CORS headers are already in the function. Make sure you're using the correct Supabase URL.

---

### Issue 5: Network Error

**Error**: "Failed to fetch" or network errors

**Solution**:
- Check your internet connection
- Verify Supabase URL is correct: `https://cdvhodymzfwdzfeltmsu.supabase.co`
- Check browser console for more details

---

## 📝 Quick Checklist

- [ ] Migration file exists: `supabase/migrations/20251121120000_create_subscribers_table.sql`
- [ ] Migration has been applied (check in Supabase SQL Editor)
- [ ] Edge Function exists: `supabase/functions/subscribe-email/index.ts`
- [ ] Edge Function has been deployed: `supabase functions deploy subscribe-email`
- [ ] Function logs show no errors (check in Supabase Dashboard)
- [ ] Test subscription works on website

---

## 🆘 Still Not Working?

1. **Check Supabase Dashboard Logs**:
   - Edge Functions → subscribe-email → Logs
   - Look for the actual error message

2. **Check Browser Console**:
   - Open DevTools (F12)
   - Go to Console tab
   - Look for errors

3. **Check Network Tab**:
   - Open DevTools (F12)
   - Go to Network tab
   - Find the `subscribe-email` request
   - Click it and check the Response tab

4. **Verify Environment Variables**:
   - Make sure `VITE_SUPABASE_URL` is set correctly
   - Should be: `https://cdvhodymzfwdzfeltmsu.supabase.co`

---

## ✅ Success!

Once it's working, you should:
- See success toast message ✅
- Email appears in `subscribers` table ✅
- (If Resend is configured) Welcome email received ✅

---

**Last Updated**: 2024-11-21

