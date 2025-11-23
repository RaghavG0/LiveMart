-- Add new order statuses for pickup orders
-- PostgreSQL doesn't allow ALTER TYPE ... ADD VALUE in a transaction, so we'll use DO block

DO $$ 
BEGIN
  -- Add 'ready_for_pickup' status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'ready_for_pickup' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
  ) THEN
    ALTER TYPE public.order_status ADD VALUE 'ready_for_pickup';
  END IF;

  -- Add 'picked_up' status if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'picked_up' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
  ) THEN
    ALTER TYPE public.order_status ADD VALUE 'picked_up';
  END IF;
END $$;

-- Create function to decrement product stock
CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  product_uuid UUID,
  quantity_to_decrement INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  -- Get current stock
  SELECT stock_quantity INTO current_stock
  FROM products
  WHERE id = product_uuid;

  -- Check if stock is sufficient
  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF current_stock < quantity_to_decrement THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', current_stock, quantity_to_decrement;
  END IF;

  -- Decrement stock
  UPDATE products
  SET stock_quantity = stock_quantity - quantity_to_decrement,
      updated_at = NOW()
  WHERE id = product_uuid;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.decrement_product_stock IS 'Decrements product stock quantity by specified amount';
