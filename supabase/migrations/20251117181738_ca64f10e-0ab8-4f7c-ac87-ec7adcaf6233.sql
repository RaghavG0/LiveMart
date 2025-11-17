-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true);

-- RLS policies for product images bucket
CREATE POLICY "Anyone can view product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Retailers and wholesalers can upload product images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND (
    public.has_role(auth.uid(), 'retailer'::app_role) 
    OR public.has_role(auth.uid(), 'wholesaler'::app_role)
  )
);

CREATE POLICY "Sellers can update own product images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Sellers can delete own product images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);