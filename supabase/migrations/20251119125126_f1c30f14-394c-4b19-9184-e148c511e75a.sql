-- Fix function search path security warning
-- Add search_path to functions that don't have it

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