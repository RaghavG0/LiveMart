-- =====================================================
-- ADD FOREIGN KEY: orders.customer_id -> profiles.id
-- =====================================================
-- This enables Supabase PostgREST to join orders with profiles
-- for fetching customer names in order queries

-- Step 1: Find and drop ALL existing foreign key constraints on customer_id column
-- (There may be one pointing to auth.users, and we need to replace it)
DO $$
DECLARE
  fk_record RECORD;
BEGIN
  -- Find all foreign key constraints on customer_id
  FOR fk_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND contype = 'f'
      AND (
        -- Check if this FK constraint involves customer_id
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

-- Step 2: Add the foreign key constraint to profiles.id with the exact name needed
-- This enables PostgREST to recognize the relationship
DO $$
BEGIN
  -- Check if the constraint already exists and points to profiles
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'orders_customer_id_fkey'
    AND conrelid = 'public.orders'::regclass
    AND confrelid = 'public.profiles'::regclass
  ) THEN
    -- Add the foreign key constraint to profiles.id
    -- This works because profiles.id references auth.users(id) and contains the same user IDs
    -- We're essentially changing from referencing auth.users directly to referencing profiles
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_customer_id_fkey 
      FOREIGN KEY (customer_id) 
      REFERENCES public.profiles(id) 
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Foreign key orders_customer_id_fkey created successfully pointing to profiles';
  ELSE
    RAISE NOTICE 'Foreign key orders_customer_id_fkey already exists and points to profiles';
  END IF;
END $$;

-- Verify the constraint was created
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'orders_customer_id_fkey'
AND conrelid = 'public.orders'::regclass;

-- Add comment for documentation
COMMENT ON CONSTRAINT orders_customer_id_fkey ON public.orders IS 
'Foreign key linking orders to customer profiles. Enables PostgREST joins between orders and profiles tables.';

