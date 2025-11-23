-- =====================================================
-- COMPREHENSIVE FEEDBACK & REVIEW SYSTEM
-- Open Review Policy + Threaded Discussions + Delivery Feedback
-- =====================================================

-- 1. UPDATE REVIEWS TABLE FOR OPEN REVIEW POLICY
-- Make order_id optional and add verified_buyer flag
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS unique_user_product_order_review,
  ALTER COLUMN order_id DROP NOT NULL;

-- Add verified_buyer flag to distinguish verified buyers from general reviewers
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS verified_buyer BOOLEAN DEFAULT false NOT NULL;

-- Add index for verified buyer queries
CREATE INDEX IF NOT EXISTS idx_reviews_verified_buyer ON public.reviews(verified_buyer) WHERE verified_buyer = true;

-- Update unique constraint: one review per (user, product) when order_id is null
-- OR one review per (user, product, order) when order_id is provided
-- Use unique indexes to handle both cases (PostgreSQL treats NULL as distinct in unique indexes)

-- Drop any existing unique constraint/index on these columns
DROP INDEX IF EXISTS idx_unique_user_product_review;
DROP INDEX IF EXISTS idx_unique_user_product_review_with_order;
DROP INDEX IF EXISTS idx_unique_user_product_review_no_order;

-- Unique index for reviews WITH order_id (one review per user, product, order)
CREATE UNIQUE INDEX idx_unique_user_product_review_with_order 
  ON public.reviews(user_id, product_id, order_id)
  WHERE order_id IS NOT NULL;

-- Unique index for reviews WITHOUT order_id (one review per user, product, open review)
CREATE UNIQUE INDEX idx_unique_user_product_review_no_order 
  ON public.reviews(user_id, product_id)
  WHERE order_id IS NULL;

-- 2. UPDATE RLS POLICIES FOR OPEN REVIEW POLICY
-- Drop old restrictive policy
DROP POLICY IF EXISTS "Users can create reviews for delivered orders" ON public.reviews;
DROP POLICY IF EXISTS "Users can create reviews for purchased products" ON public.reviews;

-- New policy: Anyone authenticated can create reviews (open policy)
CREATE POLICY "Anyone authenticated can create reviews"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Anyone can view reviews
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Anyone can view reviews"
  ON public.reviews
  FOR SELECT
  USING (true);

-- Policy: Users can update their own reviews
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
CREATE POLICY "Users can update own reviews"
  ON public.reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own reviews
DROP POLICY IF EXISTS "Users can delete own reviews" ON public.reviews;
CREATE POLICY "Users can delete own reviews"
  ON public.reviews
  FOR DELETE
  USING (auth.uid() = user_id);

-- 3. CREATE THREADED REPLY SYSTEM
-- Ensure review_replies table exists first (create if it doesn't exist from previous migration)
CREATE TABLE IF NOT EXISTS public.review_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reply_text TEXT NOT NULL CHECK (char_length(reply_text) >= 10 AND char_length(reply_text) <= 2000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  edited_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS if not already enabled
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;

-- Drop existing unique constraints that limit replies
ALTER TABLE public.review_replies
  DROP CONSTRAINT IF EXISTS review_replies_review_id_key,
  DROP CONSTRAINT IF EXISTS review_replies_review_id_seller_id_key;

-- Add columns for threading support (if they don't exist)
ALTER TABLE public.review_replies
  ADD COLUMN IF NOT EXISTS parent_reply_id UUID,
  ADD COLUMN IF NOT EXISTS reply_type TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Make seller_id nullable (only required for vendor replies)
DO $$
BEGIN
  -- Only alter if column is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'review_replies' 
    AND column_name = 'seller_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.review_replies ALTER COLUMN seller_id DROP NOT NULL;
  END IF;
END $$;

-- Add foreign key for parent_reply_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'review_replies_parent_reply_id_fkey'
  ) THEN
    ALTER TABLE public.review_replies
      ADD CONSTRAINT review_replies_parent_reply_id_fkey 
      FOREIGN KEY (parent_reply_id) REFERENCES public.review_replies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Set default value for reply_type on existing rows
UPDATE public.review_replies
SET reply_type = 'vendor'
WHERE reply_type IS NULL;

-- Add default value and check constraint for reply_type
DO $$
BEGIN
  -- Set default value for reply_type column
  ALTER TABLE public.review_replies
    ALTER COLUMN reply_type SET DEFAULT 'vendor';
  
  -- Add check constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'review_replies_reply_type_check'
  ) THEN
    ALTER TABLE public.review_replies
      ADD CONSTRAINT review_replies_reply_type_check 
      CHECK (reply_type IN ('vendor', 'user'));
  END IF;
END $$;

-- Add constraint: Either seller_id or user_id must be set (drop and recreate to avoid conflicts)
ALTER TABLE public.review_replies
  DROP CONSTRAINT IF EXISTS check_reply_author;

ALTER TABLE public.review_replies
  ADD CONSTRAINT check_reply_author 
  CHECK (
    (reply_type = 'vendor' AND seller_id IS NOT NULL AND user_id IS NULL) OR
    (reply_type = 'user' AND user_id IS NOT NULL AND seller_id IS NULL)
  );

-- Add indexes for threaded replies
CREATE INDEX IF NOT EXISTS idx_review_replies_parent ON public.review_replies(parent_reply_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_user_id ON public.review_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_type ON public.review_replies(reply_type);

-- 4. UPDATE REVIEW_REPLIES RLS POLICIES
-- Drop old policies
DROP POLICY IF EXISTS "Anyone can view replies" ON public.review_replies;
DROP POLICY IF EXISTS "Sellers can insert replies for their products" ON public.review_replies;
DROP POLICY IF EXISTS "Sellers can update own replies" ON public.review_replies;
DROP POLICY IF EXISTS "Sellers can delete own replies" ON public.review_replies;

-- New policy: Anyone can view replies
CREATE POLICY "Anyone can view replies"
  ON public.review_replies
  FOR SELECT
  USING (true);

-- Policy: Vendors can reply to reviews for their products
CREATE POLICY "Vendors can reply to their product reviews"
  ON public.review_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reply_type = 'vendor' AND
    seller_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.reviews r
      JOIN public.products p ON r.product_id = p.id
      WHERE r.id = review_id 
      AND p.seller_id = auth.uid()
    )
  );

-- Policy: Users can reply to any review
CREATE POLICY "Users can reply to reviews"
  ON public.review_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reply_type = 'user' AND
    user_id = auth.uid()
  );

-- Policy: Users can update their own replies
CREATE POLICY "Users can update own replies"
  ON public.review_replies
  FOR UPDATE
  USING (
    (reply_type = 'vendor' AND seller_id = auth.uid()) OR
    (reply_type = 'user' AND user_id = auth.uid())
  )
  WITH CHECK (
    (reply_type = 'vendor' AND seller_id = auth.uid()) OR
    (reply_type = 'user' AND user_id = auth.uid())
  );

-- Policy: Users can delete their own replies
CREATE POLICY "Users can delete own replies"
  ON public.review_replies
  FOR DELETE
  USING (
    (reply_type = 'vendor' AND seller_id = auth.uid()) OR
    (reply_type = 'user' AND user_id = auth.uid())
  );

-- 5. CREATE DELIVERY FEEDBACK TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.delivery_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_quality_rating INTEGER CHECK (product_quality_rating >= 1 AND product_quality_rating <= 5),
  delivery_service_rating INTEGER CHECK (delivery_service_rating >= 1 AND delivery_service_rating <= 5),
  product_feedback TEXT,
  delivery_feedback TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(order_id, user_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_delivery_feedback_order_id ON public.delivery_feedback(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_feedback_user_id ON public.delivery_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_feedback_submitted ON public.delivery_feedback(submitted_at);

-- Enable RLS
ALTER TABLE public.delivery_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own delivery feedback
CREATE POLICY "Users can view own delivery feedback"
  ON public.delivery_feedback
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can create delivery feedback for their orders
CREATE POLICY "Users can create delivery feedback"
  ON public.delivery_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
      AND o.customer_id = auth.uid()
      AND o.status = 'delivered'
    )
  );

-- Policy: Sellers can view delivery feedback for their orders
CREATE POLICY "Sellers can view delivery feedback for their orders"
  ON public.delivery_feedback
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = delivery_feedback.order_id
      AND is_seller_for_order(auth.uid(), o.id)
    )
  );

-- 6. CREATE MANDATORY FEEDBACK TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.pending_delivery_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(order_id, user_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_pending_feedback_order_id ON public.pending_delivery_feedback(order_id);
CREATE INDEX IF NOT EXISTS idx_pending_feedback_user_id ON public.pending_delivery_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_feedback_active ON public.pending_delivery_feedback(user_id, completed_at) 
  WHERE completed_at IS NULL;

-- Enable RLS
ALTER TABLE public.pending_delivery_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their pending feedback
CREATE POLICY "Users can view own pending feedback"
  ON public.pending_delivery_feedback
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: System can create pending feedback (via service role)
CREATE POLICY "Service role can manage pending feedback"
  ON public.pending_delivery_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 7. CREATE FUNCTION TO AUTO-CREATE PENDING FEEDBACK ON DELIVERY
CREATE OR REPLACE FUNCTION create_pending_delivery_feedback()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- When order status changes to 'delivered', create pending feedback entry
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    INSERT INTO public.pending_delivery_feedback (order_id, user_id)
    VALUES (NEW.id, NEW.customer_id)
    ON CONFLICT (order_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_create_pending_feedback ON public.orders;
CREATE TRIGGER trigger_create_pending_feedback
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered'))
  EXECUTE FUNCTION create_pending_delivery_feedback();

-- 8. CREATE FUNCTION TO MARK FEEDBACK AS COMPLETED
CREATE OR REPLACE FUNCTION mark_delivery_feedback_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- When delivery feedback is submitted, mark pending feedback as completed
  UPDATE public.pending_delivery_feedback
  SET completed_at = NOW()
  WHERE order_id = NEW.order_id
    AND user_id = NEW.user_id
    AND completed_at IS NULL;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_mark_feedback_completed ON public.delivery_feedback;
CREATE TRIGGER trigger_mark_feedback_completed
  AFTER INSERT ON public.delivery_feedback
  FOR EACH ROW
  EXECUTE FUNCTION mark_delivery_feedback_completed();

-- 9. CREATE HELPER FUNCTION TO CHECK IF USER HAS PENDING FEEDBACK
CREATE OR REPLACE FUNCTION get_pending_delivery_feedback(user_uuid UUID)
RETURNS TABLE(
  order_id UUID,
  order_total DECIMAL,
  order_date TIMESTAMP WITH TIME ZONE,
  delivery_address TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    o.id,
    o.total_amount,
    o.created_at,
    o.delivery_address
  FROM public.pending_delivery_feedback pdf
  JOIN public.orders o ON pdf.order_id = o.id
  WHERE pdf.user_id = user_uuid
    AND pdf.completed_at IS NULL
    AND pdf.dismissed_at IS NULL
  ORDER BY o.created_at DESC
  LIMIT 10;
$$;

-- 10. UPDATE REVIEWS TO AUTO-SET verified_buyer FLAG
CREATE OR REPLACE FUNCTION set_verified_buyer_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If order_id is provided, check if user actually purchased the product
  IF NEW.order_id IS NOT NULL THEN
    NEW.verified_buyer := EXISTS (
      SELECT 1
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = NEW.product_id
        AND o.id = NEW.order_id
        AND o.customer_id = NEW.user_id
        AND o.status = 'delivered'
    );
  ELSE
    -- No order_id means it's an open review (not verified buyer)
    NEW.verified_buyer := false;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_verified_buyer ON public.reviews;
CREATE TRIGGER trigger_set_verified_buyer
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION set_verified_buyer_flag();

-- Add comments for documentation
COMMENT ON TABLE public.reviews IS 'Product reviews with open policy - anyone can review, verified_buyer flag distinguishes purchasers';
COMMENT ON COLUMN public.reviews.verified_buyer IS 'True if reviewer purchased the product (order_id provided and order is delivered)';
COMMENT ON TABLE public.review_replies IS 'Threaded reply system - vendors and users can reply to reviews and to each other';
COMMENT ON COLUMN public.review_replies.reply_type IS 'Type of reply: vendor (from seller) or user (from other users)';
COMMENT ON TABLE public.delivery_feedback IS 'Mandatory feedback for product quality and delivery service when order is delivered';
COMMENT ON TABLE public.pending_delivery_feedback IS 'Tracks which users need to provide mandatory delivery feedback';

