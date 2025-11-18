-- Function to list wholesaler products for retailers/wholesalers only
CREATE OR REPLACE FUNCTION public.list_wholesaler_products(_search text DEFAULT NULL)
RETURNS SETOF public.products
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.products p
  WHERE p.is_available = true
    AND public.is_wholesaler(p.seller_id)
    AND (
      -- Only retailers or wholesalers can call this successfully
      public.has_role(auth.uid(), 'retailer'::app_role)
      OR public.has_role(auth.uid(), 'wholesaler'::app_role)
    )
    AND (_search IS NULL OR p.name ILIKE '%' || _search || '%');
$$;