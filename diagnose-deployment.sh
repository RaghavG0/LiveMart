#!/bin/bash

echo "🔍 LiveMart Deployment Diagnostics"
echo "=================================="
echo ""

# Check if dist folder exists
echo "1. Checking build output..."
if [ -d "dist" ]; then
    echo "   ✅ dist/ folder exists"
    if [ -f "dist/index.html" ]; then
        echo "   ✅ dist/index.html exists"
    else
        echo "   ❌ dist/index.html missing!"
    fi
else
    echo "   ❌ dist/ folder not found! Run: npm run build"
fi
echo ""

# Check environment variables
echo "2. Checking environment variables..."
if [ -f ".env" ]; then
    echo "   ✅ .env file exists"
    
    # Check for required variables
    if grep -q "VITE_SUPABASE_URL" .env; then
        echo "   ✅ VITE_SUPABASE_URL found"
    else
        echo "   ❌ VITE_SUPABASE_URL missing!"
    fi
    
    if grep -q "VITE_SUPABASE_ANON_KEY" .env; then
        echo "   ✅ VITE_SUPABASE_ANON_KEY found"
    else
        echo "   ❌ VITE_SUPABASE_ANON_KEY missing!"
    fi
    
    if grep -q "VITE_OLA_MAPS_API_KEY" .env; then
        echo "   ✅ VITE_OLA_MAPS_API_KEY found"
    else
        echo "   ⚠️  VITE_OLA_MAPS_API_KEY missing (location features won't work)"
    fi
else
    echo "   ⚠️  .env file not found (okay for Vercel, but check Vercel Dashboard)"
fi
echo ""

# Check package.json scripts
echo "3. Checking package.json scripts..."
if grep -q '"build"' package.json; then
    echo "   ✅ build script found"
else
    echo "   ❌ build script missing!"
fi
echo ""

# Check node_modules
echo "4. Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "   ✅ node_modules exists"
else
    echo "   ❌ node_modules missing! Run: npm install"
fi
echo ""

# Check for TypeScript errors (if tsconfig exists)
echo "5. Checking for build issues..."
if command -v npm &> /dev/null; then
    echo "   Running build test..."
    npm run build > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "   ✅ Build successful"
    else
        echo "   ❌ Build failed! Run: npm run build (to see errors)"
    fi
else
    echo "   ⚠️  npm not found"
fi
echo ""

# Check vercel.json
echo "6. Checking Vercel configuration..."
if [ -f "vercel.json" ]; then
    echo "   ✅ vercel.json exists"
else
    echo "   ⚠️  vercel.json not found (SPA routing may not work)"
fi
echo ""

echo "=================================="
echo "📋 Summary & Next Steps"
echo "=================================="
echo ""
echo "For Vercel deployment issues:"
echo "1. Make sure ALL environment variables are set in Vercel Dashboard"
echo "2. After adding env vars, REDEPLOY the project"
echo "3. Check browser console (F12) for errors"
echo "4. Check Vercel build logs for errors"
echo ""
echo "Read VERCEL_DEPLOYMENT_GUIDE.md for detailed troubleshooting"
echo ""
