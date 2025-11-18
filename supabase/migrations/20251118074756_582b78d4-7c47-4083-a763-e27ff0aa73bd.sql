-- Add order type to distinguish customer vs retailer orders
CREATE TYPE public.order_type AS ENUM ('customer', 'retailer');

ALTER TABLE public.orders 
ADD COLUMN order_type order_type NOT NULL DEFAULT 'customer',
ADD COLUMN seller_id uuid REFERENCES auth.users(id);

-- Create index for seller queries
CREATE INDEX idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX idx_orders_order_type ON public.orders(order_type);

-- Add RLS policy for wholesalers to view retailer orders
CREATE POLICY "Wholesalers can view retailer orders for their products"
ON public.orders
FOR SELECT
USING (
  (order_type = 'retailer' AND seller_id = auth.uid() AND has_role(auth.uid(), 'wholesaler'::app_role))
  OR auth.uid() = customer_id 
  OR public.is_seller_for_order(auth.uid(), id)
);

-- Allow retailers to create orders from wholesalers
CREATE POLICY "Retailers can create orders from wholesalers"
ON public.orders
FOR INSERT
WITH CHECK (
  order_type = 'retailer' 
  AND auth.uid() = customer_id 
  AND has_role(auth.uid(), 'retailer'::app_role)
);

-- Create function to update stock when retailer order is completed
CREATE OR REPLACE FUNCTION public.update_stock_on_retailer_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update stock when order status changes to 'delivered' or 'confirmed'
  IF (NEW.order_type = 'retailer' AND NEW.status IN ('delivered', 'confirmed') 
      AND (OLD.status IS NULL OR OLD.status NOT IN ('delivered', 'confirmed'))) THEN
    
    -- Decrease stock for all products in the order
    UPDATE products p
    SET stock_quantity = p.stock_quantity - oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id
      AND p.stock_quantity >= oi.quantity;
      
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update stock
CREATE TRIGGER trigger_update_stock_on_retailer_order
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_stock_on_retailer_order();