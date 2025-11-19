-- Drop the existing trigger on orders table
DROP TRIGGER IF EXISTS trigger_update_stock_on_order ON orders;

-- Create a new function to update stock when order items are inserted
CREATE OR REPLACE FUNCTION update_stock_on_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if this is a customer order
  IF EXISTS (
    SELECT 1 FROM orders 
    WHERE id = NEW.order_id 
    AND order_type = 'customer'
  ) THEN
    -- Decrease stock immediately for customer orders
    UPDATE products
    SET stock_quantity = stock_quantity - NEW.quantity
    WHERE id = NEW.product_id
    AND stock_quantity >= NEW.quantity;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on order_items table instead
CREATE TRIGGER trigger_update_stock_on_order_item
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_order_item();

-- Keep the existing update trigger for retailer orders
CREATE TRIGGER trigger_update_stock_on_order_update
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_order();