-- Analytics and Reporting System for Retailers/Wholesalers
-- Date: 2025-11-20
-- Provides SKU trends, complaint analysis, NPS metrics, and scheduled reports

-- Report types
CREATE TYPE report_type AS ENUM ('daily_snapshot', 'weekly_summary', 'monthly_summary', 'ad_hoc');

-- Report status
CREATE TYPE report_status AS ENUM ('pending', 'generating', 'completed', 'failed', 'sent');

-- Report frequency
CREATE TYPE report_frequency AS ENUM ('daily', 'weekly', 'monthly');

-- Analytics snapshots table (daily aggregations)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  snapshot_date date NOT NULL,
  
  -- Overall metrics
  total_orders int DEFAULT 0,
  total_revenue decimal(10,2) DEFAULT 0,
  total_reviews int DEFAULT 0,
  avg_rating decimal(3,2),
  
  -- NPS-like metric (% promoters - % detractors)
  nps_score decimal(5,2),
  promoters_count int DEFAULT 0, -- 5 stars
  passives_count int DEFAULT 0,  -- 3-4 stars
  detractors_count int DEFAULT 0, -- 1-2 stars
  
  -- Response metrics
  avg_response_time_hours decimal(10,2),
  response_rate decimal(5,2),
  
  -- Product metrics
  total_products int DEFAULT 0,
  active_products int DEFAULT 0,
  out_of_stock_products int DEFAULT 0,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(retailer_id, snapshot_date)
);

-- SKU-level trends table
CREATE TABLE IF NOT EXISTS sku_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  retailer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  trend_date date NOT NULL,
  
  -- Sales metrics
  units_sold int DEFAULT 0,
  revenue decimal(10,2) DEFAULT 0,
  
  -- Review metrics
  reviews_count int DEFAULT 0,
  avg_rating decimal(3,2),
  rating_trend varchar(10), -- 'up', 'down', 'stable'
  
  -- Complaint metrics
  complaints_count int DEFAULT 0,
  top_complaint_category text,
  
  -- Inventory
  current_stock int,
  stock_status text, -- 'in_stock', 'low_stock', 'out_of_stock'
  
  created_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(product_id, trend_date)
);

-- Top complaints aggregation
CREATE TABLE IF NOT EXISTS retailer_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  
  -- Complaint categories (extracted from review text)
  quality_issues int DEFAULT 0,
  delivery_issues int DEFAULT 0,
  packaging_issues int DEFAULT 0,
  price_issues int DEFAULT 0,
  service_issues int DEFAULT 0,
  other_issues int DEFAULT 0,
  
  -- Top specific complaints (JSONB array)
  top_complaints jsonb, -- [{text, count, category}, ...]
  
  created_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(retailer_id, period_start, period_end)
);

-- Scheduled reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  report_type report_type NOT NULL,
  report_frequency report_frequency NOT NULL,
  
  -- Report configuration
  include_sku_trends boolean DEFAULT true,
  include_complaints boolean DEFAULT true,
  include_nps boolean DEFAULT true,
  include_charts boolean DEFAULT true,
  
  -- Generation tracking
  last_generated_at timestamptz,
  next_generation_at timestamptz NOT NULL,
  status report_status DEFAULT 'pending',
  
  -- Output
  csv_url text,
  pdf_url text,
  error_message text,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Report subscriptions (who receives which reports)
CREATE TABLE IF NOT EXISTS report_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscriber_email text NOT NULL,
  subscriber_name text,
  
  -- Subscription preferences
  daily_reports boolean DEFAULT false,
  weekly_reports boolean DEFAULT true,
  monthly_reports boolean DEFAULT false,
  
  -- Notification preferences
  send_via_email boolean DEFAULT true,
  email_format text DEFAULT 'html', -- 'html', 'text', 'both'
  
  active boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  UNIQUE(retailer_id, subscriber_email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_retailer_date ON analytics_snapshots(retailer_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_sku_trends_product_date ON sku_trends(product_id, trend_date DESC);
CREATE INDEX IF NOT EXISTS idx_sku_trends_retailer_date ON sku_trends(retailer_id, trend_date DESC);
CREATE INDEX IF NOT EXISTS idx_retailer_complaints_retailer_period ON retailer_complaints(retailer_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_gen ON scheduled_reports(next_generation_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_report_subscriptions_active ON report_subscriptions(retailer_id) WHERE active = true;

-- RLS Policies
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_subscriptions ENABLE ROW LEVEL SECURITY;

-- Retailers can view their own analytics
CREATE POLICY analytics_snapshots_select ON analytics_snapshots
  FOR SELECT USING (retailer_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY sku_trends_select ON sku_trends
  FOR SELECT USING (retailer_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY retailer_complaints_select ON retailer_complaints
  FOR SELECT USING (retailer_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY scheduled_reports_select ON scheduled_reports
  FOR SELECT USING (retailer_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY report_subscriptions_all ON report_subscriptions
  FOR ALL USING (retailer_id = auth.uid() OR auth.role() = 'service_role');

-- Service role can insert/update analytics
CREATE POLICY analytics_snapshots_service ON analytics_snapshots
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY sku_trends_service ON sku_trends
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY retailer_complaints_service ON retailer_complaints
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY scheduled_reports_service ON scheduled_reports
  FOR ALL USING (auth.role() = 'service_role');

-- Function: Calculate NPS score
CREATE OR REPLACE FUNCTION calculate_nps_score(
  p_promoters int,
  p_passives int,
  p_detractors int
) RETURNS decimal(5,2) LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE 
    WHEN (p_promoters + p_passives + p_detractors) = 0 THEN 0
    ELSE ROUND(
      ((p_promoters::decimal / (p_promoters + p_passives + p_detractors)) - 
       (p_detractors::decimal / (p_promoters + p_passives + p_detractors))) * 100,
      2
    )
  END;
$$;

-- Function: Generate daily analytics snapshot for a retailer
CREATE OR REPLACE FUNCTION generate_daily_analytics_snapshot(
  p_retailer_id uuid,
  p_snapshot_date date DEFAULT CURRENT_DATE
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_snapshot_id uuid;
  v_promoters int;
  v_passives int;
  v_detractors int;
  v_nps_score decimal(5,2);
BEGIN
  -- Calculate review distribution
  SELECT 
    COUNT(*) FILTER (WHERE r.rating = 5),
    COUNT(*) FILTER (WHERE r.rating IN (3, 4)),
    COUNT(*) FILTER (WHERE r.rating IN (1, 2))
  INTO v_promoters, v_passives, v_detractors
  FROM reviews r
  JOIN products p ON r.product_id = p.id
  WHERE p.seller_id = p_retailer_id
    AND r.created_at::date = p_snapshot_date
    AND r.is_visible = true;
  
  v_nps_score := calculate_nps_score(v_promoters, v_passives, v_detractors);
  
  -- Insert or update snapshot
  INSERT INTO analytics_snapshots(
    retailer_id,
    snapshot_date,
    total_orders,
    total_revenue,
    total_reviews,
    avg_rating,
    nps_score,
    promoters_count,
    passives_count,
    detractors_count,
    total_products,
    active_products
  )
  SELECT
    p_retailer_id,
    p_snapshot_date,
    COUNT(DISTINCT o.id),
    COALESCE(SUM(oi.price * oi.quantity), 0),
    COUNT(DISTINCT r.id),
    ROUND(AVG(r.rating), 2),
    v_nps_score,
    v_promoters,
    v_passives,
    v_detractors,
    COUNT(DISTINCT p.id),
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active')
  FROM products p
  LEFT JOIN order_items oi ON oi.product_id = p.id
  LEFT JOIN orders o ON o.id = oi.order_id AND o.created_at::date = p_snapshot_date
  LEFT JOIN reviews r ON r.product_id = p.id AND r.created_at::date = p_snapshot_date AND r.is_visible = true
  WHERE p.seller_id = p_retailer_id
  ON CONFLICT (retailer_id, snapshot_date)
  DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    total_revenue = EXCLUDED.total_revenue,
    total_reviews = EXCLUDED.total_reviews,
    avg_rating = EXCLUDED.avg_rating,
    nps_score = EXCLUDED.nps_score,
    promoters_count = EXCLUDED.promoters_count,
    passives_count = EXCLUDED.passives_count,
    detractors_count = EXCLUDED.detractors_count,
    total_products = EXCLUDED.total_products,
    active_products = EXCLUDED.active_products,
    updated_at = now()
  RETURNING id INTO v_snapshot_id;
  
  RETURN v_snapshot_id;
END;
$$;

-- Function: Generate SKU trends for a retailer
CREATE OR REPLACE FUNCTION generate_sku_trends(
  p_retailer_id uuid,
  p_trend_date date DEFAULT CURRENT_DATE
) RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inserted_count int := 0;
BEGIN
  INSERT INTO sku_trends(
    product_id,
    retailer_id,
    trend_date,
    units_sold,
    revenue,
    reviews_count,
    avg_rating,
    rating_trend,
    complaints_count,
    current_stock
  )
  SELECT
    p.id,
    p.seller_id,
    p_trend_date,
    COALESCE(SUM(oi.quantity), 0),
    COALESCE(SUM(oi.price * oi.quantity), 0),
    COUNT(DISTINCT r.id),
    ROUND(AVG(r.rating), 2),
    CASE
      WHEN AVG(r.rating) > LAG(AVG(r.rating)) OVER (PARTITION BY p.id ORDER BY p_trend_date) THEN 'up'
      WHEN AVG(r.rating) < LAG(AVG(r.rating)) OVER (PARTITION BY p.id ORDER BY p_trend_date) THEN 'down'
      ELSE 'stable'
    END,
    COUNT(DISTINCT r.id) FILTER (WHERE r.rating <= 2),
    p.stock_quantity
  FROM products p
  LEFT JOIN order_items oi ON oi.product_id = p.id
  LEFT JOIN orders o ON o.id = oi.order_id AND o.created_at::date = p_trend_date
  LEFT JOIN reviews r ON r.product_id = p.id AND r.created_at::date = p_trend_date AND r.is_visible = true
  WHERE p.seller_id = p_retailer_id
  GROUP BY p.id, p.seller_id, p.stock_quantity
  ON CONFLICT (product_id, trend_date)
  DO UPDATE SET
    units_sold = EXCLUDED.units_sold,
    revenue = EXCLUDED.revenue,
    reviews_count = EXCLUDED.reviews_count,
    avg_rating = EXCLUDED.avg_rating,
    rating_trend = EXCLUDED.rating_trend,
    complaints_count = EXCLUDED.complaints_count,
    current_stock = EXCLUDED.current_stock;
  
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- Function: Analyze top complaints for a retailer
CREATE OR REPLACE FUNCTION analyze_retailer_complaints(
  p_retailer_id uuid,
  p_period_start date,
  p_period_end date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_complaint_id uuid;
  v_top_complaints jsonb;
BEGIN
  -- Extract top complaint keywords/phrases from low-rated reviews
  -- This is a simplified version - in production, use NLP/sentiment analysis
  WITH complaint_keywords AS (
    SELECT
      LOWER(r.comment) as comment_lower,
      r.rating,
      CASE
        WHEN LOWER(r.comment) LIKE '%quality%' OR LOWER(r.comment) LIKE '%defect%' OR LOWER(r.comment) LIKE '%broke%' THEN 'quality'
        WHEN LOWER(r.comment) LIKE '%delivery%' OR LOWER(r.comment) LIKE '%shipping%' OR LOWER(r.comment) LIKE '%late%' THEN 'delivery'
        WHEN LOWER(r.comment) LIKE '%packaging%' OR LOWER(r.comment) LIKE '%damaged%' OR LOWER(r.comment) LIKE '%box%' THEN 'packaging'
        WHEN LOWER(r.comment) LIKE '%price%' OR LOWER(r.comment) LIKE '%expensive%' OR LOWER(r.comment) LIKE '%cost%' THEN 'price'
        WHEN LOWER(r.comment) LIKE '%service%' OR LOWER(r.comment) LIKE '%support%' OR LOWER(r.comment) LIKE '%response%' THEN 'service'
        ELSE 'other'
      END as category
    FROM reviews r
    JOIN products p ON r.product_id = p.id
    WHERE p.seller_id = p_retailer_id
      AND r.rating <= 2
      AND r.created_at::date BETWEEN p_period_start AND p_period_end
      AND r.is_visible = true
      AND r.comment IS NOT NULL
  ),
  category_counts AS (
    SELECT category, COUNT(*) as count
    FROM complaint_keywords
    GROUP BY category
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'category', category,
      'count', count
    ) ORDER BY count DESC
  )
  INTO v_top_complaints
  FROM category_counts;
  
  -- Insert complaint analysis
  INSERT INTO retailer_complaints(
    retailer_id,
    period_start,
    period_end,
    quality_issues,
    delivery_issues,
    packaging_issues,
    price_issues,
    service_issues,
    other_issues,
    top_complaints
  )
  SELECT
    p_retailer_id,
    p_period_start,
    p_period_end,
    COUNT(*) FILTER (WHERE category = 'quality'),
    COUNT(*) FILTER (WHERE category = 'delivery'),
    COUNT(*) FILTER (WHERE category = 'packaging'),
    COUNT(*) FILTER (WHERE category = 'price'),
    COUNT(*) FILTER (WHERE category = 'service'),
    COUNT(*) FILTER (WHERE category = 'other'),
    v_top_complaints
  FROM complaint_keywords
  ON CONFLICT (retailer_id, period_start, period_end)
  DO UPDATE SET
    quality_issues = EXCLUDED.quality_issues,
    delivery_issues = EXCLUDED.delivery_issues,
    packaging_issues = EXCLUDED.packaging_issues,
    price_issues = EXCLUDED.price_issues,
    service_issues = EXCLUDED.service_issues,
    other_issues = EXCLUDED.other_issues,
    top_complaints = EXCLUDED.top_complaints
  RETURNING id INTO v_complaint_id;
  
  RETURN v_complaint_id;
END;
$$;

-- Function: Get retailer performance summary
CREATE OR REPLACE FUNCTION get_retailer_performance_summary(
  p_retailer_id uuid,
  p_start_date date,
  p_end_date date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_summary jsonb;
BEGIN
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date,
      'days', p_end_date - p_start_date + 1
    ),
    'overview', jsonb_build_object(
      'total_orders', SUM(total_orders),
      'total_revenue', SUM(total_revenue),
      'total_reviews', SUM(total_reviews),
      'avg_rating', ROUND(AVG(avg_rating), 2),
      'avg_nps_score', ROUND(AVG(nps_score), 2)
    ),
    'trends', jsonb_build_object(
      'revenue_trend', CASE
        WHEN SUM(total_revenue) FILTER (WHERE snapshot_date >= p_end_date - 3) > 
             SUM(total_revenue) FILTER (WHERE snapshot_date <= p_start_date + 3) THEN 'up'
        WHEN SUM(total_revenue) FILTER (WHERE snapshot_date >= p_end_date - 3) < 
             SUM(total_revenue) FILTER (WHERE snapshot_date <= p_start_date + 3) THEN 'down'
        ELSE 'stable'
      END,
      'rating_trend', CASE
        WHEN AVG(avg_rating) FILTER (WHERE snapshot_date >= p_end_date - 3) > 
             AVG(avg_rating) FILTER (WHERE snapshot_date <= p_start_date + 3) THEN 'up'
        WHEN AVG(avg_rating) FILTER (WHERE snapshot_date >= p_end_date - 3) < 
             AVG(avg_rating) FILTER (WHERE snapshot_date <= p_start_date + 3) THEN 'down'
        ELSE 'stable'
      END
    ),
    'daily_data', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', snapshot_date,
          'orders', total_orders,
          'revenue', total_revenue,
          'reviews', total_reviews,
          'rating', avg_rating,
          'nps', nps_score
        ) ORDER BY snapshot_date
      )
      FROM analytics_snapshots
      WHERE retailer_id = p_retailer_id
        AND snapshot_date BETWEEN p_start_date AND p_end_date
    )
  )
  INTO v_summary
  FROM analytics_snapshots
  WHERE retailer_id = p_retailer_id
    AND snapshot_date BETWEEN p_start_date AND p_end_date;
  
  RETURN v_summary;
END;
$$;

-- Function: Get top performing SKUs
CREATE OR REPLACE FUNCTION get_top_skus(
  p_retailer_id uuid,
  p_start_date date,
  p_end_date date,
  p_limit int DEFAULT 10,
  p_order_by text DEFAULT 'revenue' -- 'revenue', 'units_sold', 'rating'
) RETURNS TABLE(
  product_id uuid,
  product_name text,
  total_units_sold int,
  total_revenue decimal(10,2),
  avg_rating decimal(3,2),
  total_reviews int
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.product_id,
    p.name,
    SUM(st.units_sold)::int,
    SUM(st.revenue)::decimal(10,2),
    AVG(st.avg_rating)::decimal(3,2),
    SUM(st.reviews_count)::int
  FROM sku_trends st
  JOIN products p ON st.product_id = p.id
  WHERE st.retailer_id = p_retailer_id
    AND st.trend_date BETWEEN p_start_date AND p_end_date
  GROUP BY st.product_id, p.name
  ORDER BY
    CASE WHEN p_order_by = 'revenue' THEN SUM(st.revenue) END DESC,
    CASE WHEN p_order_by = 'units_sold' THEN SUM(st.units_sold) END DESC,
    CASE WHEN p_order_by = 'rating' THEN AVG(st.avg_rating) END DESC
  LIMIT p_limit;
END;
$$;

-- Function: Schedule next report generation
CREATE OR REPLACE FUNCTION schedule_next_report(p_report_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_report scheduled_reports;
  v_next_time timestamptz;
BEGIN
  SELECT * INTO v_report FROM scheduled_reports WHERE id = p_report_id;
  
  v_next_time := CASE v_report.report_frequency
    WHEN 'daily' THEN (CURRENT_DATE + 1)::timestamptz + interval '2 hours'
    WHEN 'weekly' THEN (CURRENT_DATE + 7)::timestamptz + interval '2 hours'
    WHEN 'monthly' THEN (CURRENT_DATE + 30)::timestamptz + interval '2 hours'
  END;
  
  UPDATE scheduled_reports
  SET next_generation_at = v_next_time,
      status = 'pending',
      updated_at = now()
  WHERE id = p_report_id;
  
  RETURN v_next_time;
END;
$$;
