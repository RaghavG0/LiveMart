-- Add admin and moderator roles to app_role enum
-- This migration must run before the A/B experiment and other admin-dependent migrations

-- Add new enum values
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'moderator';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'analyst';

COMMENT ON TYPE app_role IS 'User roles: customer, retailer, wholesaler, admin, moderator, analyst';
