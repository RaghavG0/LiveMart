-- Update the existing trigger function to also handle customer orders
CREATE OR REPLACE FUNCTION public.update_stock_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Decrease stock when order status changes to 'delivered' or 'confirmed'
  -- Works for both customer and retailer orders
  IF (NEW.status IN ('delivered', 'confirmed') 
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

-- Drop the old trigger if it exists
DROP TRIGGER IF EXISTS update_stock_on_retailer_order_trigger ON orders;

-- Create new trigger for all order types
CREATE TRIGGER update_stock_on_order_trigger
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_order();