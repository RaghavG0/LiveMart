-- Phase 1: Create distance calculation function using Haversine formula
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 numeric, lon1 numeric, 
  lat2 numeric, lon2 numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  radius numeric := 6371; -- Earth's radius in kilometers
  dlat numeric;
  dlon numeric;
  a numeric;
  c numeric;
BEGIN
  -- Handle NULL values
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN NULL;
  END IF;
  
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  a := sin(dlat/2) * sin(dlat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN radius * c; -- Returns distance in kilometers
END;
$$;

-- Create function to get products with distance from user location
CREATE OR REPLACE FUNCTION public.get_products_with_distance(
  user_lat numeric,
  user_lng numeric,
  max_distance numeric DEFAULT NULL,
  search_text text DEFAULT NULL,
  min_price numeric DEFAULT NULL,
  max_price numeric DEFAULT NULL,
  min_stock integer DEFAULT 0,
  in_stock_only boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price numeric,
  stock_quantity integer,
  image_url text,
  is_available boolean,
  seller_id uuid,
  category_id uuid,
  availability_date date,
  created_at timestamptz,
  updated_at timestamptz,
  seller_name text,
  seller_address text,
  distance_km numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.description,
    p.price,
    p.stock_quantity,
    p.image_url,
    p.is_available,
    p.seller_id,
    p.category_id,
    p.availability_date,
    p.created_at,
    p.updated_at,
    pr.full_name as seller_name,
    pr.location_address as seller_address,
    calculate_distance(user_lat, user_lng, pr.location_lat, pr.location_lng) as distance_km
  FROM products p
  INNER JOIN profiles pr ON p.seller_id = pr.id
  WHERE p.is_available = true
    AND pr.location_lat IS NOT NULL
    AND pr.location_lng IS NOT NULL
    AND NOT is_wholesaler(p.seller_id)
    AND (search_text IS NULL OR p.name ILIKE '%' || search_text || '%')
    AND (min_price IS NULL OR p.price >= min_price)
    AND (max_price IS NULL OR p.price <= max_price)
    AND (p.stock_quantity >= min_stock)
    AND (NOT in_stock_only OR p.stock_quantity > 0)
    AND (max_distance IS NULL OR 
         calculate_distance(user_lat, user_lng, pr.location_lat, pr.location_lng) <= max_distance)
  ORDER BY distance_km ASC;
END;
$$;