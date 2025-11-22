-- Add address component fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location_area TEXT,
ADD COLUMN IF NOT EXISTS location_city TEXT,
ADD COLUMN IF NOT EXISTS location_district TEXT,
ADD COLUMN IF NOT EXISTS location_state TEXT,
ADD COLUMN IF NOT EXISTS location_country TEXT,
ADD COLUMN IF NOT EXISTS location_pincode TEXT;

-- Add index for faster location-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_location_state ON public.profiles(location_state);
CREATE INDEX IF NOT EXISTS idx_profiles_location_city ON public.profiles(location_city);
CREATE INDEX IF NOT EXISTS idx_profiles_location_pincode ON public.profiles(location_pincode);

