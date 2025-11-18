-- Drop the old policy that allowed anyone to view products
DROP POLICY IF EXISTS "Anyone can view available products" ON public.products;

-- Create a function to check if a user is a seller (retailer or customer with products)
CREATE OR REPLACE FUNCTION public.is_wholesaler(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = 'wholesaler'
  );
$$;

-- New policy: Products are visible based on user role
-- Customers can only see products from retailers/customers (not wholesalers)
-- Retailers can see all products (including wholesalers)
-- Everyone can see their own products
CREATE POLICY "Products visibility by role"
ON public.products
FOR SELECT
USING (
  (is_available = true) AND
  (
    -- User can always see their own products
    (seller_id = auth.uid()) OR
    
    -- If current user is a retailer or wholesaler, they can see all products
    (has_role(auth.uid(), 'retailer'::app_role)) OR
    (has_role(auth.uid(), 'wholesaler'::app_role)) OR
    
    -- If current user is a customer, they can only see products NOT from wholesalers
    (has_role(auth.uid(), 'customer'::app_role) AND NOT is_wholesaler(seller_id))
  )
);