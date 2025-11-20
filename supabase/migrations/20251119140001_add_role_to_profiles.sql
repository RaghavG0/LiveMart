-- Add role column to profiles for easier querying
-- This is a denormalized field that mirrors the primary role from user_roles table

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text;

-- Create index for role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Create function to sync role from user_roles to profiles
CREATE OR REPLACE FUNCTION sync_profile_role() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE profiles 
    SET role = NEW.role::text 
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles 
    SET role = NULL 
    WHERE id = OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user_roles to keep profiles.role in sync
DROP TRIGGER IF EXISTS sync_profile_role_trigger ON user_roles;
CREATE TRIGGER sync_profile_role_trigger
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_role();

-- Backfill existing roles
UPDATE profiles p
SET role = ur.role::text
FROM user_roles ur
WHERE p.id = ur.user_id;

-- Add comment
COMMENT ON COLUMN profiles.role IS 'Denormalized role field synced from user_roles table';
