-- =====================================================
-- MODULE 5: FEEDBACK & DASHBOARD UPDATES - DATA MODEL
-- =====================================================

-- 1. EXTEND REVIEWS TABLE
-- Add order_id to tie feedback to specific orders
-- Add edited tracking
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;

-- Create unique constraint: one review per (user, product, order)
-- Drop existing constraint if any and recreate
ALTER TABLE public.reviews
DROP CONSTRAINT IF EXISTS unique_user_product_order_review;

ALTER TABLE public.reviews
ADD CONSTRAINT unique_user_product_order_review 
UNIQUE (user_id, product_id, order_id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON public.reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);

-- Update RLS policy to enforce order_id requirement and delivered status
DROP POLICY IF EXISTS "Users can create reviews for purchased products" ON public.reviews;

CREATE POLICY "Users can create reviews for delivered orders"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_id = reviews.product_id
      AND o.customer_id = auth.uid()
      AND o.status = 'delivered'
      AND oi.order_id = reviews.order_id
  )
);

-- 2. CREATE ORDER STATUS HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status order_status,
  new_status order_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role app_role,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id 
ON public.order_status_history(order_id);

CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at 
ON public.order_status_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_status_history
CREATE POLICY "Users can view status history for their orders"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_status_history.order_id
      AND (
        o.customer_id = auth.uid()
        OR is_seller_for_order(auth.uid(), o.id)
      )
  )
);

CREATE POLICY "Sellers can insert status history"
ON public.order_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_status_history.order_id
      AND is_seller_for_order(auth.uid(), o.id)
  )
);

-- 3. CREATE DELIVERY CONFIRMATION TOKENS TABLE
CREATE TABLE IF NOT EXISTS public.delivery_confirmation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_delivery_tokens_order_id 
ON public.delivery_confirmation_tokens(order_id);

CREATE INDEX IF NOT EXISTS idx_delivery_tokens_token 
ON public.delivery_confirmation_tokens(token) 
WHERE NOT used;

-- Enable RLS
ALTER TABLE public.delivery_confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_confirmation_tokens
CREATE POLICY "Customers can view their delivery tokens"
ON public.delivery_confirmation_tokens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = delivery_confirmation_tokens.order_id
      AND o.customer_id = auth.uid()
  )
);

-- Allow public access for token verification (used by edge function)
CREATE POLICY "Public can verify delivery tokens"
ON public.delivery_confirmation_tokens
FOR SELECT
TO anon
USING (NOT used AND expires_at > now());

-- 4. CREATE TRIGGER TO AUTO-LOG STATUS CHANGES
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get user role if authenticated
    IF auth.uid() IS NOT NULL THEN
      SELECT role INTO user_role
      FROM user_roles
      WHERE user_id = auth.uid()
      LIMIT 1;
    END IF;
    
    -- Insert status history
    INSERT INTO order_status_history (
      order_id,
      old_status,
      new_status,
      changed_by,
      changed_by_role
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      user_role
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to orders table
DROP TRIGGER IF EXISTS trigger_log_order_status_change ON public.orders;

CREATE TRIGGER trigger_log_order_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION log_order_status_change();

-- 5. CREATE HELPER FUNCTION: Get average rating for product
CREATE OR REPLACE FUNCTION get_product_rating(product_uuid uuid)
RETURNS TABLE(
  average_rating numeric,
  total_reviews bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    ROUND(AVG(rating)::numeric, 2) as average_rating,
    COUNT(*) as total_reviews
  FROM reviews
  WHERE product_id = product_uuid;
$$;

-- 6. CREATE HELPER FUNCTION: Get retailer feedback summary
CREATE OR REPLACE FUNCTION get_retailer_feedback_summary(retailer_uuid uuid)
RETURNS TABLE(
  total_reviews bigint,
  average_rating numeric,
  rating_distribution jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    COUNT(*) as total_reviews,
    ROUND(AVG(r.rating)::numeric, 2) as average_rating,
    jsonb_object_agg(
      r.rating::text, 
      count_per_rating
    ) as rating_distribution
  FROM reviews r
  JOIN products p ON r.product_id = p.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count_per_rating
    FROM reviews r2
    JOIN products p2 ON r2.product_id = p2.id
    WHERE p2.seller_id = retailer_uuid
      AND r2.rating = r.rating
  ) counts ON true
  WHERE p.seller_id = retailer_uuid
  GROUP BY retailer_uuid;
$$;