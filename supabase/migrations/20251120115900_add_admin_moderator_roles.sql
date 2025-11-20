-- Add admin and moderator roles to app_role enum
-- This migration must run before the A/B experiment and other admin-dependent migrations
-- NOTE: ALTER TYPE ADD VALUE cannot run in a transaction with other enum-using statements

-- Check and add 'admin' if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'admin' AND enumtypid = 'app_role'::regtype) THEN
        EXECUTE 'ALTER TYPE app_role ADD VALUE ''admin''';
    END IF;
END $$;

-- Check and add 'moderator' if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'moderator' AND enumtypid = 'app_role'::regtype) THEN
        EXECUTE 'ALTER TYPE app_role ADD VALUE ''moderator''';
    END IF;
END $$;

-- Check and add 'analyst' if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'analyst' AND enumtypid = 'app_role'::regtype) THEN
        EXECUTE 'ALTER TYPE app_role ADD VALUE ''analyst''';
    END IF;
END $$;

COMMENT ON TYPE app_role IS 'User roles: customer, retailer, wholesaler, admin, moderator, analyst';
