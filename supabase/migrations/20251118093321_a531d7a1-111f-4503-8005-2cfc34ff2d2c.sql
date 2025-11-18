-- Update the handle_new_user function to include location data from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    phone,
    location_address,
    location_lat,
    location_lng
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'location_address',
    (NEW.raw_user_meta_data->>'location_lat')::numeric,
    (NEW.raw_user_meta_data->>'location_lng')::numeric
  );
  
  -- Insert user role if provided in metadata
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role);
  END IF;
  
  RETURN NEW;
END;
$$;