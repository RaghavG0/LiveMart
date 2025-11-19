-- Migration for Wholesaler Performance Tracking & Alerts
-- Creates tables and functions for SKU performance monitoring across retailers

-- ============================================
-- 1. SKU Performance Alerts Table
-- ============================================
-- Tracks alerts when SKUs fall below performance thresholds
CREATE TABLE public.sku_performance_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  wholesaler_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_rating', 'negative_spike', 'complaint_threshold')),
  threshold_value DECIMAL(3, 2), -- e.g., 3.0 for rating threshold
  current_value DECIMAL(5, 2), -- Current metric value
  affected_retailers_count INTEGER DEFAULT 0,
  alert_status TEXT NOT NULL DEFAULT 'active' CHECK (alert_status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
  alert_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb, -- Store additional context
  UNIQUE(product_id, alert_type, alert_status) -- Prevent duplicate active alerts
);

-- ============================================
-- 2. Wholesaler Alert Configurations Table
-- ============================================
-- Stores configurable thresholds per wholesaler
CREATE TABLE public.wholesaler_alert_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wholesaler_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  min_rating_threshold DECIMAL(2, 1) DEFAULT 3.0 CHECK (min_rating_threshold >= 1.0 AND min_rating_threshold <= 5.0),
  negative_review_spike_threshold INTEGER DEFAULT 5, -- Number of 1-2 star reviews in time window
  spike_time_window_days INTEGER DEFAULT 7, -- Days to check for spike
  complaint_threshold INTEGER DEFAULT 3, -- Number of complaints before alert
  email_notifications_enabled BOOLEAN DEFAULT true,
  notification_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wholesaler_id)
);

-- ============================================
-- 3. Retailer Issue Reports Table
-- ============================================
-- Tracks recurring issues reported by retailers for specific SKUs
CREATE TABLE public.retailer_issue_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  wholesaler_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  retailer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('quality', 'delivery', 'packaging', 'quantity', 'other')),
  issue_description TEXT CHECK (LENGTH(issue_description) >= 10 AND LENGTH(issue_description) <= 1000),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'resolved', 'closed')),
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- 4. Order Status History Table
-- ============================================
-- Tracks complete history of order status changes for visibility
CREATE TABLE public.order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  previous_status order_status,
  new_status order_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. Indexes for Performance
-- ============================================
CREATE INDEX idx_sku_alerts_wholesaler_status ON public.sku_performance_alerts(wholesaler_id, alert_status);
CREATE INDEX idx_sku_alerts_product ON public.sku_performance_alerts(product_id);
CREATE INDEX idx_sku_alerts_created_at ON public.sku_performance_alerts(created_at DESC);

CREATE INDEX idx_retailer_issues_wholesaler ON public.retailer_issue_reports(wholesaler_id, status);
CREATE INDEX idx_retailer_issues_retailer ON public.retailer_issue_reports(retailer_id);
CREATE INDEX idx_retailer_issues_product ON public.retailer_issue_reports(product_id);
CREATE INDEX idx_retailer_issues_created_at ON public.retailer_issue_reports(created_at DESC);

CREATE INDEX idx_order_history_order_id ON public.order_status_history(order_id, created_at DESC);

-- ============================================
-- 6. Enable Row Level Security
-- ============================================
ALTER TABLE public.sku_performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_alert_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_issue_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. RLS Policies
-- ============================================

-- SKU Performance Alerts: Wholesalers see their own alerts
CREATE POLICY "Wholesalers can view own alerts"
  ON public.sku_performance_alerts FOR SELECT
  USING (auth.uid() = wholesaler_id);

CREATE POLICY "Wholesalers can update own alerts"
  ON public.sku_performance_alerts FOR UPDATE
  USING (auth.uid() = wholesaler_id);

-- Alert Configuration: Wholesalers manage their own config
CREATE POLICY "Wholesalers can view own config"
  ON public.wholesaler_alert_config FOR SELECT
  USING (auth.uid() = wholesaler_id);

CREATE POLICY "Wholesalers can insert own config"
  ON public.wholesaler_alert_config FOR INSERT
  WITH CHECK (auth.uid() = wholesaler_id);

CREATE POLICY "Wholesalers can update own config"
  ON public.wholesaler_alert_config FOR UPDATE
  USING (auth.uid() = wholesaler_id);

-- Retailer Issue Reports: Wholesalers and retailers can view relevant reports
CREATE POLICY "Wholesalers can view reports for their products"
  ON public.retailer_issue_reports FOR SELECT
  USING (auth.uid() = wholesaler_id OR auth.uid() = retailer_id);

CREATE POLICY "Retailers can insert issue reports"
  ON public.retailer_issue_reports FOR INSERT
  WITH CHECK (auth.uid() = retailer_id AND has_role(auth.uid(), 'retailer'::app_role));

CREATE POLICY "Wholesalers can update issue reports"
  ON public.retailer_issue_reports FOR UPDATE
  USING (auth.uid() = wholesaler_id);

-- Order Status History: Viewable by order participants
CREATE POLICY "Order participants can view status history"
  ON public.order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id
      AND (customer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

-- ============================================
-- 8. Trigger Functions
-- ============================================

-- Function to log order status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.order_status_history (
      order_id,
      previous_status,
      new_status,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for order status changes
CREATE TRIGGER trigger_log_order_status
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION log_order_status_change();

-- Function to check SKU performance and create alerts
CREATE OR REPLACE FUNCTION check_sku_performance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_record RECORD;
  config_record RECORD;
  avg_rating DECIMAL(3, 2);
  negative_reviews_count INTEGER;
  retailer_count INTEGER;
BEGIN
  -- Loop through all wholesaler products
  FOR product_record IN
    SELECT DISTINCT p.id, p.seller_id, p.name
    FROM public.products p
    INNER JOIN public.user_roles ur ON ur.user_id = p.seller_id
    WHERE ur.role = 'wholesaler' AND p.is_available = true
  LOOP
    -- Get alert config for this wholesaler
    SELECT * INTO config_record
    FROM public.wholesaler_alert_config
    WHERE wholesaler_id = product_record.seller_id;

    -- Skip if no config exists
    CONTINUE WHEN config_record IS NULL;

    -- Calculate average rating across all retailers selling this product
    SELECT 
      COALESCE(AVG(r.rating), 0),
      COUNT(DISTINCT CASE WHEN r.rating <= 2 THEN r.id END),
      COUNT(DISTINCT rp.seller_id)
    INTO avg_rating, negative_reviews_count, retailer_count
    FROM public.order_items oi
    INNER JOIN public.orders o ON o.id = oi.order_id
    INNER JOIN public.products rp ON rp.seller_id = o.customer_id AND rp.name = (
      SELECT name FROM public.products WHERE id = oi.product_id
    )
    LEFT JOIN public.reviews r ON r.product_id = rp.id
    WHERE oi.product_id = product_record.id
      AND o.order_type = 'retailer'
      AND o.status = 'delivered'
      AND r.created_at >= NOW() - INTERVAL '30 days';

    -- Check low rating threshold
    IF avg_rating > 0 AND avg_rating < config_record.min_rating_threshold THEN
      INSERT INTO public.sku_performance_alerts (
        product_id,
        wholesaler_id,
        alert_type,
        threshold_value,
        current_value,
        affected_retailers_count,
        alert_message
      ) VALUES (
        product_record.id,
        product_record.seller_id,
        'low_rating',
        config_record.min_rating_threshold,
        avg_rating,
        retailer_count,
        format('Product "%s" has fallen below rating threshold (%.2f < %.2f)', 
               product_record.name, avg_rating, config_record.min_rating_threshold)
      )
      ON CONFLICT (product_id, alert_type, alert_status) 
      WHERE alert_status = 'active'
      DO UPDATE SET
        current_value = EXCLUDED.current_value,
        affected_retailers_count = EXCLUDED.affected_retailers_count,
        created_at = NOW();
    END IF;

    -- Check negative review spike
    IF negative_reviews_count >= config_record.negative_review_spike_threshold THEN
      INSERT INTO public.sku_performance_alerts (
        product_id,
        wholesaler_id,
        alert_type,
        threshold_value,
        current_value,
        affected_retailers_count,
        alert_message
      ) VALUES (
        product_record.id,
        product_record.seller_id,
        'negative_spike',
        config_record.negative_review_spike_threshold,
        negative_reviews_count,
        retailer_count,
        format('Product "%s" has %s negative reviews in the last %s days',
               product_record.name, negative_reviews_count, config_record.spike_time_window_days)
      )
      ON CONFLICT (product_id, alert_type, alert_status)
      WHERE alert_status = 'active'
      DO UPDATE SET
        current_value = EXCLUDED.current_value,
        affected_retailers_count = EXCLUDED.affected_retailers_count,
        created_at = NOW();
    END IF;
  END LOOP;
END;
$$;

-- Function to get retailer feedback aggregated by SKU
CREATE OR REPLACE FUNCTION get_wholesaler_sku_feedback(
  _wholesaler_id UUID,
  _time_period_days INTEGER DEFAULT 90
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  product_image_url TEXT,
  avg_rating DECIMAL(3, 2),
  total_reviews INTEGER,
  positive_reviews INTEGER,
  negative_reviews INTEGER,
  retailers_count INTEGER,
  top_complaint_retailers JSONB,
  recent_issues_count INTEGER,
  trend TEXT -- 'improving', 'stable', 'declining'
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH wholesaler_products AS (
    SELECT p.id, p.name, p.image_url
    FROM public.products p
    WHERE p.seller_id = _wholesaler_id
      AND p.is_available = true
  ),
  retailer_orders AS (
    SELECT DISTINCT 
      wp.id as product_id,
      o.customer_id as retailer_id
    FROM wholesaler_products wp
    INNER JOIN public.order_items oi ON oi.product_id = wp.id
    INNER JOIN public.orders o ON o.id = oi.order_id
    WHERE o.order_type = 'retailer'
      AND o.status = 'delivered'
  ),
  retailer_products AS (
    SELECT DISTINCT
      ro.product_id as original_product_id,
      rp.id as retailer_product_id,
      rp.seller_id as retailer_id,
      rp.name
    FROM retailer_orders ro
    INNER JOIN public.products rp ON rp.seller_id = ro.retailer_id
    INNER JOIN wholesaler_products wp ON wp.name = rp.name AND wp.id = ro.product_id
  ),
  review_data AS (
    SELECT
      rp.original_product_id,
      r.rating,
      r.created_at,
      rp.retailer_id
    FROM retailer_products rp
    INNER JOIN public.reviews r ON r.product_id = rp.retailer_product_id
    WHERE r.created_at >= NOW() - (_time_period_days || ' days')::INTERVAL
  ),
  issue_data AS (
    SELECT
      rir.product_id,
      rir.retailer_id,
      COUNT(*) as issue_count
    FROM public.retailer_issue_reports rir
    WHERE rir.wholesaler_id = _wholesaler_id
      AND rir.created_at >= NOW() - (_time_period_days || ' days')::INTERVAL
      AND rir.status IN ('reported', 'investigating')
    GROUP BY rir.product_id, rir.retailer_id
  )
  SELECT
    wp.id,
    wp.name,
    wp.image_url,
    COALESCE(ROUND(AVG(rd.rating), 2), 0)::DECIMAL(3, 2),
    COALESCE(COUNT(rd.rating)::INTEGER, 0),
    COALESCE(COUNT(rd.rating) FILTER (WHERE rd.rating >= 4)::INTEGER, 0),
    COALESCE(COUNT(rd.rating) FILTER (WHERE rd.rating <= 2)::INTEGER, 0),
    COALESCE(COUNT(DISTINCT ro.retailer_id)::INTEGER, 0),
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'retailer_id', id.retailer_id,
          'issue_count', id.issue_count
        ) ORDER BY id.issue_count DESC
      ) FILTER (WHERE id.issue_count > 0),
      '[]'::jsonb
    ),
    COALESCE((
      SELECT COUNT(*)::INTEGER
      FROM public.retailer_issue_reports rir
      WHERE rir.product_id = wp.id
        AND rir.created_at >= NOW() - INTERVAL '30 days'
        AND rir.status IN ('reported', 'investigating')
    ), 0),
    CASE
      WHEN COUNT(rd.rating) < 5 THEN 'stable'
      ELSE
        CASE
          WHEN AVG(rd.rating) FILTER (WHERE rd.created_at >= NOW() - INTERVAL '30 days') >
               AVG(rd.rating) FILTER (WHERE rd.created_at < NOW() - INTERVAL '30 days') + 0.3
          THEN 'improving'
          WHEN AVG(rd.rating) FILTER (WHERE rd.created_at >= NOW() - INTERVAL '30 days') <
               AVG(rd.rating) FILTER (WHERE rd.created_at < NOW() - INTERVAL '30 days') - 0.3
          THEN 'declining'
          ELSE 'stable'
        END
    END
  FROM wholesaler_products wp
  LEFT JOIN retailer_orders ro ON ro.product_id = wp.id
  LEFT JOIN review_data rd ON rd.original_product_id = wp.id
  LEFT JOIN issue_data id ON id.product_id = wp.id
  GROUP BY wp.id, wp.name, wp.image_url
  HAVING COUNT(rd.rating) > 0 -- Only show products with reviews
  ORDER BY COALESCE(AVG(rd.rating), 0) ASC, COUNT(rd.rating) DESC;
END;
$$;

-- ============================================
-- 9. Insert Default Alert Configurations
-- ============================================
-- Create default alert config for existing wholesalers
INSERT INTO public.wholesaler_alert_config (
  wholesaler_id,
  min_rating_threshold,
  negative_review_spike_threshold,
  spike_time_window_days,
  complaint_threshold
)
SELECT 
  ur.user_id,
  3.0, -- Default minimum rating threshold
  5,   -- Default spike threshold
  7,   -- Default time window (days)
  3    -- Default complaint threshold
FROM public.user_roles ur
WHERE ur.role = 'wholesaler'
ON CONFLICT (wholesaler_id) DO NOTHING;

-- ============================================
-- 10. Comments for Documentation
-- ============================================
COMMENT ON TABLE public.sku_performance_alerts IS 'Tracks alerts when SKU performance falls below configured thresholds';
COMMENT ON TABLE public.wholesaler_alert_config IS 'Configurable alert thresholds per wholesaler';
COMMENT ON TABLE public.retailer_issue_reports IS 'Tracks recurring quality/delivery issues reported by retailers';
COMMENT ON TABLE public.order_status_history IS 'Complete audit trail of order status changes';
COMMENT ON FUNCTION check_sku_performance() IS 'Scans all wholesaler products and creates alerts when thresholds are breached';
COMMENT ON FUNCTION get_wholesaler_sku_feedback(_wholesaler_id UUID, _time_period_days INTEGER) IS 'Returns aggregated SKU feedback data with retailer insights';
