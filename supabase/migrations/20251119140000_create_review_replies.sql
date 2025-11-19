-- Create review_replies table for retailer responses
CREATE TABLE IF NOT EXISTS public.review_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reply_text TEXT NOT NULL CHECK (char_length(reply_text) >= 10 AND char_length(reply_text) <= 2000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  edited_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(review_id) -- One reply per review
);

-- Create index for faster queries
CREATE INDEX idx_review_replies_review_id ON public.review_replies(review_id);
CREATE INDEX idx_review_replies_seller_id ON public.review_replies(seller_id);

-- Enable RLS
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view replies
CREATE POLICY "Anyone can view replies"
  ON public.review_replies FOR SELECT
  USING (true);

-- Policy: Sellers can insert replies for their products' reviews
CREATE POLICY "Sellers can insert replies for their products"
  ON public.review_replies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r
      JOIN public.products p ON r.product_id = p.id
      WHERE r.id = review_id 
      AND p.seller_id = auth.uid()
    )
  );

-- Policy: Sellers can update their own replies
CREATE POLICY "Sellers can update own replies"
  ON public.review_replies FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Policy: Sellers can delete their own replies
CREATE POLICY "Sellers can delete own replies"
  ON public.review_replies FOR DELETE
  USING (seller_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE public.review_replies IS 'Stores retailer/wholesaler replies to customer product reviews';
COMMENT ON COLUMN public.review_replies.reply_text IS 'Reply text between 10-2000 characters';
COMMENT ON COLUMN public.review_replies.edited_at IS 'Timestamp of last edit, replies can be edited within 24 hours';
