-- Add admin and moderator roles to app_role enum
-- This migration must run before the A/B experiment and other admin-dependent migrations

-- Add new enum values (checking if they don't already exist)
DO $$ 
BEGIN
    -- Add 'admin' if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'admin' AND enumtypid = 'app_role'::regtype) THEN
        ALTER TYPE app_role ADD VALUE 'admin';
    END IF;
    
    -- Add 'moderator' if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'moderator' AND enumtypid = 'app_role'::regtype) THEN
        ALTER TYPE app_role ADD VALUE 'moderator';
    END IF;
    
    -- Add 'analyst' if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'analyst' AND enumtypid = 'app_role'::regtype) THEN
        ALTER TYPE app_role ADD VALUE 'analyst';
    END IF;
END $$;

COMMENT ON TYPE app_role IS 'User roles: customer, retailer, wholesaler, admin, moderator, analyst';
