# Fix Foreign Keys and Remove Duplicate Analytics

## Issues Fixed

### 1. ✅ Removed Duplicate Analytics
- **Problem**: `RetailerFeedbackOverview` was showing duplicate analytics:
  - `FeedbackAnalytics` component (with charts)
  - Summary Cards below it (Average Rating, Total Reviews, Products Reviewed)
- **Fix**: Removed the duplicate summary cards section (lines 201-241)

### 2. ✅ Fixed Reviews Query
- **Problem**: Query used `profiles!inner(full_name)` which requires a foreign key that doesn't exist
- **Fix**: 
  - Removed `profiles!inner` from the query
  - Fetch profiles separately after getting reviews
  - Map profiles to reviews manually
  - Handle edge case when there are no reviews

### 3. ✅ Created Foreign Key Migrations

Two migrations have been created to fix the foreign key issues:

#### Migration 1: `20251127000000_add_orders_customer_id_to_profiles_fkey.sql`
- Adds foreign key `orders_customer_id_fkey` from `orders.customer_id` to `profiles.id`
- Fixes the PGRST200 error for orders queries

#### Migration 2: `20251127000001_add_reviews_user_id_to_profiles_fkey.sql`
- Adds foreign key `reviews_user_id_fkey` from `reviews.user_id` to `profiles.id`
- Fixes the PGRST200 error for reviews queries

## How to Apply

### Option 1: Via Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Run each migration file's SQL content:

**For Orders Foreign Key:**
```sql
-- Copy and paste content from: supabase/migrations/20251127000000_add_orders_customer_id_to_profiles_fkey.sql
```

**For Reviews Foreign Key:**
```sql
-- Copy and paste content from: supabase/migrations/20251127000001_add_reviews_user_id_to_profiles_fkey.sql
```

4. Click **Run** for each migration
5. Refresh your Retailer Dashboard

### Option 2: Via Supabase CLI

```bash
cd /Users/raghavgulati/Desktop/oop/live-mart-connect
npx supabase db push
```

## Verification

After applying migrations, verify with:

```sql
-- Check orders foreign key
SELECT 
  conname,
  conrelid::regclass AS "From Table",
  confrelid::regclass AS "To Table"
FROM pg_constraint
WHERE conname = 'orders_customer_id_fkey';

-- Check reviews foreign key
SELECT 
  conname,
  conrelid::regclass AS "From Table",
  confrelid::regclass AS "To Table"
FROM pg_constraint
WHERE conname = 'reviews_user_id_fkey';
```

Both should show `profiles` as the referenced table.

## Code Changes

### Files Modified:
1. `src/components/dashboard/RetailerFeedbackOverview.tsx`
   - Removed duplicate summary cards
   - Fixed reviews query to fetch profiles separately
   - Removed unused imports

### Files Created:
1. `supabase/migrations/20251127000000_add_orders_customer_id_to_profiles_fkey.sql`
2. `supabase/migrations/20251127000001_add_reviews_user_id_to_profiles_fkey.sql`

## Expected Results

After applying these fixes:
- ✅ No duplicate analytics on Retailer Dashboard
- ✅ Reviews load correctly with customer names
- ✅ No more PGRST200 errors in console
- ✅ Orders load correctly with customer names

