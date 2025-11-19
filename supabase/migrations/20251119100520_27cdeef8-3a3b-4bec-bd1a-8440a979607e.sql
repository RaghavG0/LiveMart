-- Add inventory_added flag to orders table to track if retailer has added items to inventory
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_added BOOLEAN DEFAULT false;

-- Create a function to add retailer order items to their inventory
CREATE OR REPLACE FUNCTION add_retailer_order_to_inventory(_order_id uuid, _retailer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert or update products for the retailer based on order items
  INSERT INTO products (
    seller_id,
    name,
    description,
    price,
    stock_quantity,
    category_id,
    image_url,
    is_available
  )
  SELECT 
    _retailer_id,
    p.name,
    p.description,
    oi.price_at_purchase, -- Use the price they bought it at
    oi.quantity,
    p.category_id,
    p.image_url,
    true
  FROM order_items oi
  JOIN products p ON oi.product_id = p.id
  WHERE oi.order_id = _order_id
  ON CONFLICT (seller_id, name, category_id) 
  DO UPDATE SET 
    stock_quantity = products.stock_quantity + EXCLUDED.stock_quantity,
    updated_at = now();
  
  -- Mark the order as inventory added
  UPDATE orders 
  SET inventory_added = true 
  WHERE id = _order_id;
END;
$$;

-- Note: We'll need a unique constraint to make the ON CONFLICT work
-- First, let's create a unique index on seller_id, name, and category_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_seller_name_category 
ON products(seller_id, name, category_id) 
WHERE category_id IS NOT NULL;

-- For products without category, create a separate index
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_seller_name_no_category 
ON products(seller_id, name) 
WHERE category_id IS NULL;