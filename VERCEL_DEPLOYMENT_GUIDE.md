# Vercel Deployment Troubleshooting Guide

## Issue: Blank White Page After Deployment

This guide helps resolve the blank white page issue on Vercel.

## ✅ Pre-Deployment Checklist

### 1. **Environment Variables** (MOST COMMON ISSUE)

Make sure ALL environment variables are set in Vercel:

Go to: `Vercel Dashboard → Your Project → Settings → Environment Variables`

**Required Variables:**
```bash
VITE_SUPABASE_URL=https://cdvhodymzfwdzfeltmsu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_OLA_MAPS_API_KEY=your_ola_maps_key_here
```

**Optional Variables:**
```bash
VITE_SUPABASE_FUNCTION_URL=https://cdvhodymzfwdzfeltmsu.supabase.co/functions/v1
```

⚠️ **IMPORTANT:** 
- After adding/updating env vars, **REDEPLOY** the project
- Env vars are only available at build time for Vite
- Make sure variable names start with `VITE_` prefix

### 2. **Build Configuration**

Verify your Vercel build settings:

**Framework Preset:** `Vite`
**Build Command:** `npm run build` or `vite build`
**Output Directory:** `dist`
**Install Command:** `npm install`
**Node Version:** 18.x or higher

### 3. **Check Build Logs**

In Vercel Dashboard:
1. Go to Deployments
2. Click on the latest deployment
3. Check "Building" logs for errors
4. Look for:
   - TypeScript errors
   - Missing dependencies
   - Build failures

## 🔍 Debugging Steps

### Step 1: Check Browser Console

1. Open deployed site
2. Press `F12` (or `Cmd+Option+I` on Mac)
3. Go to **Console** tab
4. Look for errors (red text)

**Common Errors:**

**"Failed to fetch"** or **CORS errors**
→ Check Supabase URL and API key are correct

**"Uncaught ReferenceError: process is not defined"**
→ Don't use `process.env` in Vite, use `import.meta.env`

**"Module not found"**
→ Missing dependency, run `npm install`

**"Unexpected token '<'"**
→ Check if env vars are set (API might return HTML error page)

### Step 2: Test Locally with Production Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

If it works locally but not on Vercel → Environment variable issue

### Step 3: Check Network Tab

1. Open DevTools → Network tab
2. Refresh page
3. Look for failed requests (red status codes)
4. Check if API calls are going to correct URLs

### Step 4: Verify Supabase Connection

Open browser console on deployed site and run:
```javascript
console.log(import.meta.env.VITE_SUPABASE_URL);
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Key exists' : 'Key missing');
```

If both show `undefined` → Environment variables not set in Vercel

## 🛠️ Common Fixes

### Fix 1: Redeploy After Adding Env Vars

```bash
# In Vercel Dashboard:
1. Settings → Environment Variables → Add all required vars
2. Deployments → Click "..." → Redeploy
3. Wait for build to complete
```

### Fix 2: Clear Vercel Build Cache

```bash
# In Vercel Dashboard:
1. Settings → General
2. Scroll to "Build & Development Settings"
3. Enable "Ignore Build Cache"
4. Redeploy
5. Disable "Ignore Build Cache" after successful deployment
```

### Fix 3: Update vercel.json

Create/update `vercel.json` in project root:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Fix 4: Check index.html

Make sure `dist/index.html` is generated:

```bash
npm run build
ls -la dist/
# Should show index.html and assets/
```

### Fix 5: Verify Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## 📊 Diagnostic Commands

Run these locally to verify everything works:

```bash
# Install dependencies
npm install

# Check for TypeScript errors
npm run build

# Test production build
npm run preview

# Check for missing dependencies
npm audit

# Verify all imports resolve
npx tsc --noEmit
```

## 🔗 Vercel-Specific Issues

### Issue: Build Succeeds but Site is Blank

**Cause:** Environment variables not available at runtime

**Solution:**
```bash
# Vercel environment variables are only available at BUILD time for Vite
# Make sure to:
1. Add ALL env vars in Vercel Dashboard
2. Redeploy (don't just git push)
3. Clear build cache if needed
```

### Issue: Works on Localhost but Not on Vercel

**Likely causes:**
1. ❌ Environment variables missing in Vercel
2. ❌ Using `process.env` instead of `import.meta.env`
3. ❌ Hardcoded localhost URLs
4. ❌ Missing dependencies in package.json

### Issue: 404 on Page Refresh

**Solution:** Add rewrites to `vercel.json` (see Fix 3 above)

## ✅ Success Checklist

Before marking deployment as successful:

- [ ] Site loads (not blank page)
- [ ] Console has no errors
- [ ] Can navigate between pages
- [ ] Can sign in/sign up
- [ ] API calls work (check Network tab)
- [ ] Images load correctly
- [ ] Maps display (if using Ola Maps)
- [ ] All environment variables set
- [ ] No CORS errors
- [ ] Page refresh works on any route

## 🆘 Still Not Working?

1. **Check Vercel Logs:**
   - Dashboard → Project → Deployments → Click deployment → View Function Logs

2. **Compare Working vs Broken:**
   - If it was working before, compare deployments
   - Check what changed (git diff)

3. **Create New Deployment:**
   ```bash
   git commit --allow-empty -m "Trigger new deployment"
   git push
   ```

4. **Contact Support:**
   - Share deployment URL
   - Share browser console errors
   - Share build logs from Vercel
   - Share environment (browser, OS)

## 📝 Quick Fix Commands

```bash
# Full reset
rm -rf node_modules package-lock.json
npm install
npm run build

# Force Vercel redeploy
vercel --force

# Check production build locally
npm run preview
```

## 🔐 Security Note

Never commit `.env` files to git. Always use Vercel Dashboard for environment variables.

## 📚 Additional Resources

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Vercel Build Configuration](https://vercel.com/docs/build-output-api/v3)
