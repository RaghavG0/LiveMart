-- A/B Experiment System for Review Request Optimization
-- Supports multiple experiment types with variant tracking and metrics

-- Experiment status enum
CREATE TYPE experiment_status AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');

-- Experiment type enum
CREATE TYPE experiment_type AS ENUM ('review_timing', 'cta_copy', 'notification_channel', 'ui_layout', 'other');

-- Experiments table
CREATE TABLE experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  experiment_type experiment_type NOT NULL,
  status experiment_status DEFAULT 'draft',
  
  -- Traffic allocation
  traffic_percentage int DEFAULT 100 CHECK (traffic_percentage BETWEEN 0 AND 100),
  
  -- Targeting
  target_user_segments jsonb DEFAULT '[]'::jsonb, -- e.g., ["new_users", "high_value"]
  target_regions jsonb DEFAULT '[]'::jsonb, -- e.g., ["US", "UK"]
  
  -- Timeline
  start_date timestamptz,
  end_date timestamptz,
  
  -- Success criteria
  primary_metric text NOT NULL, -- e.g., "review_submission_rate"
  secondary_metrics jsonb DEFAULT '[]'::jsonb,
  success_threshold decimal(5,2), -- e.g., 5.0 for 5% lift
  minimum_sample_size int DEFAULT 1000,
  
  -- Statistical config
  confidence_level decimal(3,2) DEFAULT 0.95,
  statistical_power decimal(3,2) DEFAULT 0.80,
  
  -- Metadata
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Experiment variants table
CREATE TABLE experiment_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  name text NOT NULL, -- e.g., "Control", "24h_delay", "3day_delay"
  description text,
  
  -- Configuration (variant-specific settings)
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  /* Example configs:
     Review timing: {"delay_hours": 24, "reminder_enabled": true}
     CTA copy: {"text": "Rate now", "style": "short", "emoji": "⭐"}
  */
  
  -- Traffic allocation within experiment
  traffic_weight int DEFAULT 1 CHECK (traffic_weight > 0),
  is_control boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(experiment_id, name)
);

-- User assignments to experiment variants
CREATE TABLE experiment_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Assignment context
  assigned_at timestamptz DEFAULT now(),
  session_id text,
  device_type text,
  user_agent text,
  
  UNIQUE(experiment_id, user_id)
);

-- Experiment events (tracking conversions and metrics)
CREATE TABLE experiment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES experiment_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Event details
  event_type text NOT NULL, -- e.g., "review_submitted", "notification_opened", "cta_clicked"
  event_properties jsonb DEFAULT '{}'::jsonb,
  /* Example properties:
     {
       "review_id": "uuid",
       "review_length": 150,
       "has_images": true,
       "rating": 5,
       "time_to_action_seconds": 3600
     }
  */
  
  -- Timing
  event_timestamp timestamptz DEFAULT now(),
  time_since_assignment_seconds int,
  
  created_at timestamptz DEFAULT now()
);

-- Experiment results (pre-computed aggregations)
CREATE TABLE experiment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES experiment_variants(id) ON DELETE CASCADE,
  
  -- Sample size
  unique_users int DEFAULT 0,
  total_events int DEFAULT 0,
  
  -- Primary metric
  primary_metric_value decimal(10,4),
  
  -- Secondary metrics (stored as JSONB)
  secondary_metrics jsonb DEFAULT '{}'::jsonb,
  /* Example:
     {
       "review_quality_score": 4.2,
       "avg_review_length": 145,
       "image_attach_rate": 0.35,
       "nps_lift": 12.5
     }
  */
  
  -- Statistical significance
  is_statistically_significant boolean DEFAULT false,
  p_value decimal(5,4),
  confidence_interval jsonb, -- {"lower": 0.15, "upper": 0.25}
  
  -- Comparison to control
  lift_percentage decimal(10,4),
  is_winner boolean DEFAULT false,
  
  -- Computed at
  computed_at timestamptz DEFAULT now(),
  
  UNIQUE(experiment_id, variant_id, computed_at)
);

-- Indexes for performance
CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_experiments_dates ON experiments(start_date, end_date) WHERE status = 'active';
CREATE INDEX idx_experiment_variants_experiment ON experiment_variants(experiment_id);
CREATE INDEX idx_experiment_assignments_user ON experiment_assignments(user_id);
CREATE INDEX idx_experiment_assignments_experiment ON experiment_assignments(experiment_id);
CREATE INDEX idx_experiment_events_assignment ON experiment_events(assignment_id);
CREATE INDEX idx_experiment_events_type ON experiment_events(event_type);
CREATE INDEX idx_experiment_events_timestamp ON experiment_events(event_timestamp);
CREATE INDEX idx_experiment_results_experiment ON experiment_results(experiment_id);

-- Function: Assign user to experiment variant (weighted random assignment)
CREATE OR REPLACE FUNCTION assign_user_to_experiment(
  p_experiment_id uuid,
  p_user_id uuid,
  p_session_id text DEFAULT NULL,
  p_device_type text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment_id uuid;
  v_variant_id uuid;
  v_total_weight int;
  v_random_value int;
  v_current_weight int := 0;
  v_variant record;
BEGIN
  -- Check if user already assigned
  SELECT id, variant_id INTO v_assignment_id, v_variant_id
  FROM experiment_assignments
  WHERE experiment_id = p_experiment_id AND user_id = p_user_id;
  
  IF v_assignment_id IS NOT NULL THEN
    RETURN v_assignment_id;
  END IF;
  
  -- Calculate total weight
  SELECT SUM(traffic_weight) INTO v_total_weight
  FROM experiment_variants
  WHERE experiment_id = p_experiment_id;
  
  IF v_total_weight IS NULL OR v_total_weight = 0 THEN
    RAISE EXCEPTION 'No variants found for experiment %', p_experiment_id;
  END IF;
  
  -- Generate random value
  v_random_value := floor(random() * v_total_weight)::int;
  
  -- Weighted random selection
  FOR v_variant IN 
    SELECT id, traffic_weight 
    FROM experiment_variants 
    WHERE experiment_id = p_experiment_id
    ORDER BY id
  LOOP
    v_current_weight := v_current_weight + v_variant.traffic_weight;
    IF v_random_value < v_current_weight THEN
      v_variant_id := v_variant.id;
      EXIT;
    END IF;
  END LOOP;
  
  -- Create assignment
  INSERT INTO experiment_assignments(
    experiment_id,
    variant_id,
    user_id,
    session_id,
    device_type,
    user_agent
  ) VALUES (
    p_experiment_id,
    v_variant_id,
    p_user_id,
    p_session_id,
    p_device_type,
    p_user_agent
  )
  RETURNING id INTO v_assignment_id;
  
  RETURN v_assignment_id;
END;
$$;

-- Function: Track experiment event
CREATE OR REPLACE FUNCTION track_experiment_event(
  p_experiment_id uuid,
  p_user_id uuid,
  p_event_type text,
  p_event_properties jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment_id uuid;
  v_variant_id uuid;
  v_event_id uuid;
  v_time_since_assignment int;
BEGIN
  -- Get user's assignment
  SELECT id, variant_id, EXTRACT(EPOCH FROM (now() - assigned_at))::int
  INTO v_assignment_id, v_variant_id, v_time_since_assignment
  FROM experiment_assignments
  WHERE experiment_id = p_experiment_id AND user_id = p_user_id;
  
  IF v_assignment_id IS NULL THEN
    RAISE EXCEPTION 'User % not assigned to experiment %', p_user_id, p_experiment_id;
  END IF;
  
  -- Insert event
  INSERT INTO experiment_events(
    experiment_id,
    variant_id,
    assignment_id,
    user_id,
    event_type,
    event_properties,
    time_since_assignment_seconds
  ) VALUES (
    p_experiment_id,
    v_variant_id,
    v_assignment_id,
    p_user_id,
    p_event_type,
    p_event_properties,
    v_time_since_assignment
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Function: Calculate experiment results
CREATE OR REPLACE FUNCTION calculate_experiment_results(
  p_experiment_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_variant record;
  v_control_rate decimal(10,4);
  v_control_variant_id uuid;
BEGIN
  -- Get control variant
  SELECT id INTO v_control_variant_id
  FROM experiment_variants
  WHERE experiment_id = p_experiment_id AND is_control = true
  LIMIT 1;
  
  -- Calculate control conversion rate (for lift calculation)
  IF v_control_variant_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN COUNT(DISTINCT ea.user_id) > 0 
        THEN COUNT(DISTINCT ee.user_id)::decimal / COUNT(DISTINCT ea.user_id)
        ELSE 0
      END
    INTO v_control_rate
    FROM experiment_assignments ea
    LEFT JOIN experiment_events ee 
      ON ea.id = ee.assignment_id AND ee.event_type = 'review_submitted'
    WHERE ea.variant_id = v_control_variant_id;
  END IF;
  
  -- Calculate results for each variant
  FOR v_variant IN 
    SELECT id FROM experiment_variants WHERE experiment_id = p_experiment_id
  LOOP
    INSERT INTO experiment_results(
      experiment_id,
      variant_id,
      unique_users,
      total_events,
      primary_metric_value,
      secondary_metrics,
      lift_percentage,
      computed_at
    )
    SELECT 
      p_experiment_id,
      v_variant.id,
      COUNT(DISTINCT ea.user_id),
      COUNT(ee.id),
      -- Primary metric: review submission rate
      CASE 
        WHEN COUNT(DISTINCT ea.user_id) > 0 
        THEN COUNT(DISTINCT CASE WHEN ee.event_type = 'review_submitted' THEN ee.user_id END)::decimal / COUNT(DISTINCT ea.user_id)
        ELSE 0
      END,
      -- Secondary metrics
      jsonb_build_object(
        'avg_review_length', COALESCE(AVG((ee.event_properties->>'review_length')::int) FILTER (WHERE ee.event_type = 'review_submitted'), 0),
        'image_attach_rate', COALESCE(COUNT(*) FILTER (WHERE ee.event_type = 'review_submitted' AND (ee.event_properties->>'has_images')::boolean = true)::decimal / NULLIF(COUNT(*) FILTER (WHERE ee.event_type = 'review_submitted'), 0), 0),
        'avg_rating', COALESCE(AVG((ee.event_properties->>'rating')::decimal) FILTER (WHERE ee.event_type = 'review_submitted'), 0),
        'avg_time_to_submit_hours', COALESCE(AVG(ee.time_since_assignment_seconds) FILTER (WHERE ee.event_type = 'review_submitted') / 3600, 0)
      ),
      -- Lift percentage (vs control)
      CASE 
        WHEN v_control_rate > 0 AND COUNT(DISTINCT ea.user_id) > 0
        THEN ((COUNT(DISTINCT CASE WHEN ee.event_type = 'review_submitted' THEN ee.user_id END)::decimal / COUNT(DISTINCT ea.user_id) - v_control_rate) / v_control_rate) * 100
        ELSE 0
      END,
      now()
    FROM experiment_assignments ea
    LEFT JOIN experiment_events ee ON ea.id = ee.assignment_id
    WHERE ea.variant_id = v_variant.id
    ON CONFLICT (experiment_id, variant_id, computed_at) DO NOTHING;
  END LOOP;
END;
$$;

-- Function: Get user's experiment variant
CREATE OR REPLACE FUNCTION get_user_experiment_variant(
  p_experiment_id uuid,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'variant_id', ev.id,
    'variant_name', ev.name,
    'config', ev.config,
    'assigned_at', ea.assigned_at
  )
  INTO v_result
  FROM experiment_assignments ea
  JOIN experiment_variants ev ON ea.variant_id = ev.id
  WHERE ea.experiment_id = p_experiment_id AND ea.user_id = p_user_id;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- RLS Policies
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_results ENABLE ROW LEVEL SECURITY;

-- Admins can manage experiments
CREATE POLICY "Admins full access to experiments"
  ON experiments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins full access to variants"
  ON experiment_variants
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can view their own assignments
CREATE POLICY "Users view own assignments"
  ON experiment_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can create assignments and track events
CREATE POLICY "Service role full access to assignments"
  ON experiment_assignments
  FOR ALL
  TO service_role
  USING (true);

CREATE POLICY "Service role full access to events"
  ON experiment_events
  FOR ALL
  TO service_role
  USING (true);

-- Admins can view results
CREATE POLICY "Admins view experiment results"
  ON experiment_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger to update experiment results when events are added
CREATE OR REPLACE FUNCTION trigger_recalculate_experiment_results()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only recalculate for active experiments
  IF EXISTS (
    SELECT 1 FROM experiments 
    WHERE id = NEW.experiment_id AND status = 'active'
  ) THEN
    PERFORM calculate_experiment_results(NEW.experiment_id);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER recalculate_results_on_event
AFTER INSERT ON experiment_events
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_experiment_results();

-- Sample experiment data for review timing optimization
INSERT INTO experiments(
  name,
  description,
  experiment_type,
  status,
  primary_metric,
  secondary_metrics,
  success_threshold,
  minimum_sample_size,
  traffic_percentage
) VALUES (
  'Review Request Timing Optimization',
  'Test optimal timing for review requests: immediate vs 24h vs 3 days after delivery',
  'review_timing',
  'draft',
  'review_submission_rate',
  '["avg_review_length", "image_attach_rate", "avg_rating", "nps_lift"]',
  5.0, -- 5% lift to be considered success
  1500, -- 500 per variant
  100
);

-- Insert variants for timing experiment
WITH timing_exp AS (
  SELECT id FROM experiments WHERE name = 'Review Request Timing Optimization'
)
INSERT INTO experiment_variants(experiment_id, name, description, config, traffic_weight, is_control)
SELECT 
  id,
  'Control - Immediate',
  'Request review immediately after delivery confirmation',
  '{"delay_hours": 0, "reminder_enabled": false}'::jsonb,
  1,
  true
FROM timing_exp
UNION ALL
SELECT 
  id,
  'Variant A - 24 Hour Delay',
  'Request review 24 hours after delivery',
  '{"delay_hours": 24, "reminder_enabled": true, "reminder_delay_hours": 72}'::jsonb,
  1,
  false
FROM timing_exp
UNION ALL
SELECT 
  id,
  'Variant B - 3 Day Delay',
  'Request review 3 days after delivery',
  '{"delay_hours": 72, "reminder_enabled": true, "reminder_delay_hours": 168}'::jsonb,
  1,
  false
FROM timing_exp;

-- Sample experiment for CTA copy optimization
INSERT INTO experiments(
  name,
  description,
  experiment_type,
  status,
  primary_metric,
  secondary_metrics,
  success_threshold,
  minimum_sample_size
) VALUES (
  'Review CTA Copy Optimization',
  'Test different CTA copy styles: short vs long form',
  'cta_copy',
  'draft',
  'review_submission_rate',
  '["cta_click_rate", "avg_review_length", "completion_rate"]',
  3.0,
  1200
);

-- Insert CTA copy variants
WITH cta_exp AS (
  SELECT id FROM experiments WHERE name = 'Review CTA Copy Optimization'
)
INSERT INTO experiment_variants(experiment_id, name, description, config, traffic_weight, is_control)
SELECT 
  id,
  'Control - Short CTA',
  'Simple "Rate now" button',
  '{"cta_text": "Rate now", "cta_style": "short", "emoji": "⭐"}'::jsonb,
  1,
  true
FROM cta_exp
UNION ALL
SELECT 
  id,
  'Variant A - Long Helpful',
  'Help others decide CTA',
  '{"cta_text": "Tell us what you think — help others", "cta_style": "long", "emoji": "💬"}'::jsonb,
  1,
  false
FROM cta_exp
UNION ALL
SELECT 
  id,
  'Variant B - Community Focus',
  'Share your experience CTA',
  '{"cta_text": "Share your experience with our community", "cta_style": "long", "emoji": "🤝"}'::jsonb,
  1,
  false
FROM cta_exp;

COMMENT ON TABLE experiments IS 'A/B experiments for optimizing review requests and user engagement';
COMMENT ON TABLE experiment_variants IS 'Variants within each experiment with specific configurations';
COMMENT ON TABLE experiment_assignments IS 'User assignments to experiment variants';
COMMENT ON TABLE experiment_events IS 'Tracked events and conversions for experiments';
COMMENT ON TABLE experiment_results IS 'Pre-computed results and statistical analysis';
