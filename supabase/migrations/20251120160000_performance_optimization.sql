-- Performance Optimization: Materialized Views & Caching

-- Product rating summary (fast lookups without aggregating on every request)
CREATE MATERIALIZED VIEW product_rating_summary AS
SELECT 
  r.product_id,
  COUNT(*) as total_reviews,
  ROUND(AVG(r.rating)::numeric, 2) as avg_rating,
  COUNT(*) FILTER (WHERE r.rating = 5) as five_star_count,
  COUNT(*) FILTER (WHERE r.rating = 4) as four_star_count,
  COUNT(*) FILTER (WHERE r.rating = 3) as three_star_count,
  COUNT(*) FILTER (WHERE r.rating = 2) as two_star_count,
  COUNT(*) FILTER (WHERE r.rating = 1) as one_star_count,
  COUNT(*) FILTER (WHERE r.media_urls IS NOT NULL AND jsonb_array_length(r.media_urls) > 0) as reviews_with_images,
  COUNT(*) FILTER (WHERE r.is_verified_purchase = true) as verified_purchases,
  MAX(r.created_at) as last_review_date,
  MIN(r.created_at) as first_review_date
FROM reviews r
WHERE r.is_visible = true 
  AND r.is_approved = true
  AND r.moderation_status = 'approved'
GROUP BY r.product_id;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_product_rating_summary_product 
  ON product_rating_summary(product_id);

-- Retailer performance summary
CREATE MATERIALIZED VIEW retailer_performance_summary AS
SELECT 
  p.seller_id as retailer_id,
  COUNT(DISTINCT r.id) as total_reviews,
  ROUND(AVG(r.rating)::numeric, 2) as avg_rating,
  COUNT(*) FILTER (WHERE r.rating >= 4) as positive_reviews,
  COUNT(*) FILTER (WHERE r.rating <= 2) as negative_reviews,
  COUNT(DISTINCT p.id) as products_with_reviews,
  COUNT(*) FILTER (WHERE rr.id IS NOT NULL) as responded_reviews,
  ROUND(
    (COUNT(*) FILTER (WHERE rr.id IS NOT NULL)::decimal / NULLIF(COUNT(*), 0)) * 100,
    2
  ) as response_rate,
  AVG(EXTRACT(EPOCH FROM (rr.created_at - r.created_at)) / 3600) as avg_response_time_hours,
  MAX(r.created_at) as last_review_date
FROM products p
LEFT JOIN reviews r ON r.product_id = p.id 
  AND r.is_visible = true 
  AND r.is_approved = true
LEFT JOIN review_replies rr ON rr.review_id = r.id
WHERE p.status = 'active'
GROUP BY p.seller_id;

CREATE UNIQUE INDEX idx_retailer_performance_summary_retailer
  ON retailer_performance_summary(retailer_id);

-- Trending products (based on recent review activity)
CREATE MATERIALIZED VIEW trending_products AS
SELECT 
  r.product_id,
  p.name as product_name,
  p.seller_id as retailer_id,
  COUNT(*) as recent_review_count,
  ROUND(AVG(r.rating)::numeric, 2) as avg_rating,
  COUNT(*) FILTER (WHERE r.created_at >= now() - interval '7 days') as reviews_last_7_days,
  COUNT(*) FILTER (WHERE r.created_at >= now() - interval '30 days') as reviews_last_30_days,
  -- Trending score: weighted by recency and volume
  (
    COUNT(*) FILTER (WHERE r.created_at >= now() - interval '7 days') * 3 +
    COUNT(*) FILTER (WHERE r.created_at >= now() - interval '30 days')
  ) as trending_score
FROM reviews r
JOIN products p ON p.id = r.product_id
WHERE r.is_visible = true
  AND r.is_approved = true
  AND r.created_at >= now() - interval '90 days'
  AND p.status = 'active'
GROUP BY r.product_id, p.name, p.seller_id
HAVING COUNT(*) >= 5;

CREATE INDEX idx_trending_products_score 
  ON trending_products(trending_score DESC);
CREATE INDEX idx_trending_products_retailer 
  ON trending_products(retailer_id);

-- Function: Refresh materialized views
CREATE OR REPLACE FUNCTION refresh_rating_summaries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY product_rating_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY retailer_performance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY trending_products;
  
  RAISE NOTICE 'Rating summaries refreshed at %', now();
END;
$$;

-- Function: Get product rating (uses materialized view)
CREATE OR REPLACE FUNCTION get_product_rating(p_product_id uuid)
RETURNS TABLE(
  avg_rating decimal,
  total_reviews int,
  five_star int,
  four_star int,
  three_star int,
  two_star int,
  one_star int,
  reviews_with_images int,
  verified_purchases int
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    prs.avg_rating,
    prs.total_reviews,
    prs.five_star_count,
    prs.four_star_count,
    prs.three_star_count,
    prs.two_star_count,
    prs.one_star_count,
    prs.reviews_with_images,
    prs.verified_purchases
  FROM product_rating_summary prs
  WHERE prs.product_id = p_product_id;
END;
$$;

-- Incremental view refresh trigger (update on review changes)
CREATE OR REPLACE FUNCTION trigger_rating_summary_refresh()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- For production, queue this for async processing
  -- For now, just mark that refresh is needed
  -- You can use a flag table or notification
  PERFORM pg_notify('rating_summary_refresh_needed', NEW.product_id::text);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER rating_summary_refresh_trigger
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION trigger_rating_summary_refresh();

-- Cache table for frequently accessed data
CREATE TABLE cache_entries (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  accessed_count int DEFAULT 0,
  last_accessed_at timestamptz DEFAULT now()
);

CREATE INDEX idx_cache_expires ON cache_entries(expires_at);

-- Function: Get cached value
CREATE OR REPLACE FUNCTION cache_get(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_value jsonb;
BEGIN
  SELECT value INTO v_value
  FROM cache_entries
  WHERE key = p_key
    AND expires_at > now();
  
  IF v_value IS NOT NULL THEN
    UPDATE cache_entries
    SET accessed_count = accessed_count + 1,
        last_accessed_at = now()
    WHERE key = p_key;
  END IF;
  
  RETURN v_value;
END;
$$;

-- Function: Set cached value
CREATE OR REPLACE FUNCTION cache_set(
  p_key text,
  p_value jsonb,
  p_ttl_seconds int DEFAULT 300
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO cache_entries(key, value, expires_at)
  VALUES (p_key, p_value, now() + (p_ttl_seconds || ' seconds')::interval)
  ON CONFLICT (key) 
  DO UPDATE SET 
    value = p_value,
    expires_at = now() + (p_ttl_seconds || ' seconds')::interval,
    created_at = now();
END;
$$;

-- Function: Clear expired cache
CREATE OR REPLACE FUNCTION cache_clear_expired()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM cache_entries
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Pagination helper function
CREATE OR REPLACE FUNCTION paginate_reviews(
  p_product_id uuid DEFAULT NULL,
  p_seller_id uuid DEFAULT NULL,
  p_cursor timestamptz DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_sort_by text DEFAULT 'recent', -- recent, helpful, rating_high, rating_low
  p_filter_rating int DEFAULT NULL,
  p_images_only boolean DEFAULT false
)
RETURNS TABLE(
  review_id uuid,
  user_name text,
  rating int,
  comment text,
  media_urls jsonb,
  helpful_count int,
  is_verified_purchase boolean,
  created_at timestamptz,
  next_cursor timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    prof.full_name,
    r.rating,
    r.comment,
    r.media_urls,
    r.helpful_count,
    r.is_verified_purchase,
    r.created_at,
    r.created_at as next_cursor
  FROM reviews r
  JOIN profiles prof ON prof.id = r.user_id
  WHERE r.is_visible = true
    AND r.is_approved = true
    AND r.moderation_status = 'approved'
    AND (p_product_id IS NULL OR r.product_id = p_product_id)
    AND (p_seller_id IS NULL OR r.product_id IN (SELECT id FROM products WHERE seller_id = p_seller_id))
    AND (p_cursor IS NULL OR r.created_at < p_cursor)
    AND (p_filter_rating IS NULL OR r.rating = p_filter_rating)
    AND (NOT p_images_only OR (r.media_urls IS NOT NULL AND jsonb_array_length(r.media_urls) > 0))
  ORDER BY 
    CASE WHEN p_sort_by = 'recent' THEN r.created_at END DESC,
    CASE WHEN p_sort_by = 'helpful' THEN r.helpful_count END DESC,
    CASE WHEN p_sort_by = 'rating_high' THEN r.rating END DESC,
    CASE WHEN p_sort_by = 'rating_low' THEN r.rating END ASC,
    r.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON MATERIALIZED VIEW product_rating_summary IS 'Pre-computed product ratings for fast lookups';
COMMENT ON MATERIALIZED VIEW retailer_performance_summary IS 'Retailer performance metrics';
COMMENT ON MATERIALIZED VIEW trending_products IS 'Trending products based on recent review activity';
COMMENT ON TABLE cache_entries IS 'Application-level cache for frequently accessed data';
