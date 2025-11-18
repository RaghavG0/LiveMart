-- Create a security definer function to check if user is seller for an order
CREATE OR REPLACE FUNCTION public.is_seller_for_order(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = _order_id
      AND p.seller_id = _user_id
  );
$$;

-- Drop the problematic policies
DROP POLICY IF EXISTS "Sellers can view orders for their products" ON orders;
DROP POLICY IF EXISTS "Sellers can update order status" ON orders;

-- Recreate policies using the security definer function
CREATE POLICY "Sellers can view orders for their products"
ON orders
FOR SELECT
USING (
  auth.uid() = customer_id 
  OR public.is_seller_for_order(auth.uid(), id)
);

CREATE POLICY "Sellers can update order status"
ON orders
FOR UPDATE
USING (public.is_seller_for_order(auth.uid(), id));