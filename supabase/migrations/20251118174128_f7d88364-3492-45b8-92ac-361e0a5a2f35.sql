-- Update trigger to decrease stock immediately when order is created (pending status)
CREATE OR REPLACE FUNCTION public.update_stock_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- For new orders (INSERT), decrease stock immediately when order is placed
  IF TG_OP = 'INSERT' AND NEW.order_type = 'customer' THEN
    UPDATE products p
    SET stock_quantity = p.stock_quantity - oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id
      AND p.stock_quantity >= oi.quantity;
      
  -- For retailer orders, decrease stock when status changes to 'delivered' or 'confirmed'
  ELSIF TG_OP = 'UPDATE' AND NEW.order_type = 'retailer' 
      AND NEW.status IN ('delivered', 'confirmed') 
      AND (OLD.status IS NULL OR OLD.status NOT IN ('delivered', 'confirmed')) THEN
    
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