# Fix Orders Foreign Key Error (PGRST200)

## Problem
The Retailer Dashboard fails to load orders with error: "Could not find a relationship between 'orders' and 'profiles'"

## Root Cause
The query in `OrderStatusManager.tsx` tries to join `orders` with `profiles` using:
```typescript
profiles!orders_customer_id_fkey(full_name)
```

But the foreign key `orders_customer_id_fkey` pointing to `profiles.id` doesn't exist. Currently, `orders.customer_id` references `auth.users(id)` directly.

## Solution

Run this SQL in your **Supabase SQL Editor**:

```sql
-- =====================================================
-- ADD FOREIGN KEY: orders.customer_id -> profiles.id
-- =====================================================

-- Step 1: Find and drop existing foreign key constraints on customer_id
DO $$
DECLARE
  fk_record RECORD;
BEGIN
  FOR fk_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND contype = 'f'
      AND (
        SELECT COUNT(*) 
        FROM pg_attribute a
        WHERE a.attrelid = conrelid 
          AND a.attnum = ANY(conkey)
          AND a.attname = 'customer_id'
      ) > 0
  LOOP
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I', fk_record.conname);
    RAISE NOTICE 'Dropped existing foreign key constraint: %', fk_record.conname;
  END LOOP;
END $$;

-- Step 2: Add foreign key constraint to profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'orders_customer_id_fkey'
    AND conrelid = 'public.orders'::regclass
    AND confrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_customer_id_fkey 
      FOREIGN KEY (customer_id) 
      REFERENCES public.profiles(id) 
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Foreign key orders_customer_id_fkey created successfully';
  ELSE
    RAISE NOTICE 'Foreign key orders_customer_id_fkey already exists';
  END IF;
END $$;

-- Step 3: Verify the constraint
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'orders_customer_id_fkey'
AND conrelid = 'public.orders'::regclass;
```

## Steps to Apply

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the SQL above
4. Click **Run** or press `Ctrl+Enter`
5. Verify the output shows the constraint was created
6. Refresh your Retailer Dashboard

## Important Notes

- This migration replaces the foreign key from `auth.users(id)` to `profiles(id)`
- This is safe because `profiles.id` references `auth.users(id)` and contains the same values
- After applying, PostgREST will be able to join orders with profiles
- The query `profiles!orders_customer_id_fkey(full_name)` will now work

## Verification

After running the migration, you can verify with:
```sql
SELECT 
  conname,
  conrelid::regclass AS "From Table",
  confrelid::regclass AS "To Table"
FROM pg_constraint
WHERE conname = 'orders_customer_id_fkey';
```

Expected result: `orders_customer_id_fkey` should reference `profiles` table.

