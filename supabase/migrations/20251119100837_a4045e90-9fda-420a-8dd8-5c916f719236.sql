-- Drop the partial indexes that don't work with ON CONFLICT
DROP INDEX IF EXISTS idx_products_seller_name_category;
DROP INDEX IF EXISTS idx_products_seller_name_no_category;

-- Recreate the function with a different approach that checks for existing products first
CREATE OR REPLACE FUNCTION add_retailer_order_to_inventory(_order_id uuid, _retailer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  order_item RECORD;
  existing_product_id uuid;
BEGIN
  -- Loop through each order item
  FOR order_item IN 
    SELECT 
      oi.quantity,
      oi.price_at_purchase,
      p.name,
      p.description,
      p.category_id,
      p.image_url
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = _order_id
  LOOP
    -- Check if product already exists for this retailer
    SELECT id INTO existing_product_id
    FROM products
    WHERE seller_id = _retailer_id
      AND name = order_item.name
      AND (
        (category_id = order_item.category_id) OR 
        (category_id IS NULL AND order_item.category_id IS NULL)
      )
    LIMIT 1;
    
    IF existing_product_id IS NOT NULL THEN
      -- Update existing product stock
      UPDATE products
      SET 
        stock_quantity = stock_quantity + order_item.quantity,
        updated_at = now()
      WHERE id = existing_product_id;
    ELSE
      -- Insert new product
      INSERT INTO products (
        seller_id,
        name,
        description,
        price,
        stock_quantity,
        category_id,
        image_url,
        is_available
      ) VALUES (
        _retailer_id,
        order_item.name,
        order_item.description,
        order_item.price_at_purchase,
        order_item.quantity,
        order_item.category_id,
        order_item.image_url,
        true
      );
    END IF;
  END LOOP;
  
  -- Mark the order as inventory added
  UPDATE orders 
  SET inventory_added = true 
  WHERE id = _order_id;
END;
$$;