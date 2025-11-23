-- =====================================================
-- ADD FOREIGN KEY: reviews.user_id -> profiles.id
-- =====================================================
-- This enables Supabase PostgREST to join reviews with profiles
-- for fetching customer names in review queries

-- Step 1: Find and drop existing foreign key constraints on user_id that point to auth.users
DO $$
DECLARE
  fk_record RECORD;
BEGIN
  -- Find all foreign key constraints on user_id that point to auth.users
  FOR fk_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.reviews'::regclass
      AND contype = 'f'
      AND confrelid = 'auth.users'::regclass
      AND (
        -- Check if this FK constraint involves user_id
        SELECT COUNT(*) 
        FROM pg_attribute a
        WHERE a.attrelid = conrelid 
          AND a.attnum = ANY(conkey)
          AND a.attname = 'user_id'
      ) > 0
  LOOP
    EXECUTE format('ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS %I', fk_record.conname);
    RAISE NOTICE 'Dropped existing foreign key constraint: %', fk_record.conname;
  END LOOP;
END $$;

-- Step 2: Add foreign key constraint to profiles.id (optional, for PostgREST joins)
-- Note: We keep the auth.users reference via profiles.id
-- This allows PostgREST to recognize the relationship for joins
DO $$
BEGIN
  -- Check if the constraint already exists and points to profiles
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'reviews_user_id_fkey'
    AND conrelid = 'public.reviews'::regclass
    AND confrelid = 'public.profiles'::regclass
  ) THEN
    -- Add the foreign key constraint to profiles.id
    -- This works because profiles.id references auth.users(id) and contains the same user IDs
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_user_id_fkey 
      FOREIGN KEY (user_id) 
      REFERENCES public.profiles(id) 
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Foreign key reviews_user_id_fkey created successfully pointing to profiles';
  ELSE
    RAISE NOTICE 'Foreign key reviews_user_id_fkey already exists and points to profiles';
  END IF;
END $$;

-- Verify the constraint was created
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS referenced_table,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'reviews_user_id_fkey'
AND conrelid = 'public.reviews'::regclass;

-- Add comment for documentation
COMMENT ON CONSTRAINT reviews_user_id_fkey ON public.reviews IS 
'Foreign key linking reviews to user profiles. Enables PostgREST joins between reviews and profiles tables.';

