-- =====================================================
-- ADD FOREIGN KEY: orders.customer_id -> profiles.id
-- =====================================================
-- This enables Supabase PostgREST to join orders with profiles
-- for fetching customer names in order queries

-- Check if the foreign key already exists before creating it
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'orders_customer_id_fkey'
    AND conrelid = 'public.orders'::regclass
  ) THEN
    -- Add the foreign key constraint
    -- Note: Since customer_id references auth.users(id) and profiles.id also references auth.users(id),
    -- this foreign key will work correctly because both columns contain the same user IDs
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_customer_id_fkey 
      FOREIGN KEY (customer_id) 
      REFERENCES public.profiles(id) 
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Foreign key orders_customer_id_fkey created successfully';
  ELSE
    RAISE NOTICE 'Foreign key orders_customer_id_fkey already exists, skipping';
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

