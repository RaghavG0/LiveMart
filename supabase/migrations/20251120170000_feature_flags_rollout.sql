-- Feature Flags & Rollout System
-- Manage feature rollouts with gradual percentage-based deployment

-- Feature flag status
CREATE TYPE feature_status AS ENUM ('disabled', 'development', 'staging', 'canary', 'enabled', 'deprecated');

-- Targeting strategy
CREATE TYPE targeting_strategy AS ENUM ('all', 'percentage', 'user_list', 'user_segment', 'conditional');

-- Feature flags
CREATE TABLE feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Flag details
  flag_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  
  -- Status & rollout
  status feature_status DEFAULT 'disabled',
  rollout_percentage int DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  
  -- Targeting
  targeting_strategy targeting_strategy DEFAULT 'all',
  target_user_ids uuid[], -- Specific users
  target_segments text[], -- User segments: ["premium", "beta_testers"]
  target_conditions jsonb, -- Complex conditions: {"min_orders": 5, "region": "US"}
  
  -- Dependencies
  depends_on text[], -- Other feature flags that must be enabled
  
  -- Metadata
  owner_team text,
  tags text[],
  
  -- Lifecycle
  enabled_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Feature flag overrides (per-user)
CREATE TABLE feature_flag_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL REFERENCES feature_flags(flag_key) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Override
  enabled boolean NOT NULL,
  reason text,
  
  -- Metadata
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  
  UNIQUE(flag_key, user_id)
);

-- Feature flag evaluation log
CREATE TABLE feature_flag_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL,
  user_id uuid,
  
  -- Evaluation result
  enabled boolean NOT NULL,
  reason text, -- percentage, override, targeting, etc.
  
  -- Context
  user_segment text,
  rollout_percentage int,
  
  evaluated_at timestamptz DEFAULT now()
);

-- Deployment stages
CREATE TABLE deployment_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Deployment details
  name text NOT NULL,
  description text,
  version text,
  
  -- Feature flags in this deployment
  feature_flags jsonb NOT NULL, -- {"feedback_api": true, "new_ui": false}
  
  -- Stage info
  environment text DEFAULT 'production', -- staging, production
  rollout_percentage int DEFAULT 0,
  
  -- Health metrics
  error_rate decimal(5,4),
  response_time_p95 int, -- milliseconds
  success_rate decimal(5,4),
  
  -- Status
  is_active boolean DEFAULT false,
  deployed_at timestamptz,
  rolled_back_at timestamptz,
  rollback_reason text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_feature_flags_status ON feature_flags(status);
CREATE INDEX idx_feature_flag_overrides_user ON feature_flag_overrides(user_id);
CREATE INDEX idx_feature_flag_evaluations_flag ON feature_flag_evaluations(flag_key);
CREATE INDEX idx_feature_flag_evaluations_user ON feature_flag_evaluations(user_id);
CREATE INDEX idx_deployment_stages_active ON deployment_stages(is_active) WHERE is_active = true;

-- Function: Check if feature enabled for user
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_flag_key text,
  p_user_id uuid DEFAULT NULL,
  p_user_segment text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_flag record;
  v_override boolean;
  v_hash int;
  v_enabled boolean := false;
  v_reason text := 'disabled';
BEGIN
  -- Get feature flag
  SELECT * INTO v_flag
  FROM feature_flags
  WHERE flag_key = p_flag_key;
  
  IF v_flag IS NULL THEN
    RAISE NOTICE 'Feature flag not found: %', p_flag_key;
    RETURN false;
  END IF;
  
  -- Check status
  IF v_flag.status = 'disabled' THEN
    v_reason := 'flag_disabled';
    v_enabled := false;
  ELSIF v_flag.status = 'enabled' THEN
    v_reason := 'flag_enabled';
    v_enabled := true;
  ELSE
    -- Check override first
    IF p_user_id IS NOT NULL THEN
      SELECT enabled INTO v_override
      FROM feature_flag_overrides
      WHERE flag_key = p_flag_key
        AND user_id = p_user_id
        AND (expires_at IS NULL OR expires_at > now());
      
      IF v_override IS NOT NULL THEN
        v_enabled := v_override;
        v_reason := 'user_override';
        -- Log and return
        INSERT INTO feature_flag_evaluations(flag_key, user_id, enabled, reason)
        VALUES (p_flag_key, p_user_id, v_enabled, v_reason);
        RETURN v_enabled;
      END IF;
    END IF;
    
    -- Check targeting strategy
    CASE v_flag.targeting_strategy
      WHEN 'all' THEN
        v_enabled := (v_flag.status IN ('canary', 'enabled'));
        v_reason := 'all_users';
        
      WHEN 'percentage' THEN
        IF p_user_id IS NOT NULL THEN
          -- Consistent hashing for percentage rollout
          v_hash := abs(hashtext(p_user_id::text || p_flag_key)) % 100;
          v_enabled := v_hash < v_flag.rollout_percentage;
          v_reason := 'percentage_' || v_flag.rollout_percentage::text;
        ELSE
          v_enabled := false;
          v_reason := 'no_user_id';
        END IF;
        
      WHEN 'user_list' THEN
        IF p_user_id IS NOT NULL AND p_user_id = ANY(v_flag.target_user_ids) THEN
          v_enabled := true;
          v_reason := 'user_list';
        END IF;
        
      WHEN 'user_segment' THEN
        IF p_user_segment IS NOT NULL AND p_user_segment = ANY(v_flag.target_segments) THEN
          v_enabled := true;
          v_reason := 'user_segment_' || p_user_segment;
        END IF;
        
      WHEN 'conditional' THEN
        -- Complex conditional logic (simplified)
        v_enabled := false;
        v_reason := 'conditional_not_met';
        
      ELSE
        v_enabled := false;
        v_reason := 'unknown_strategy';
    END CASE;
  END IF;
  
  -- Check dependencies
  IF v_enabled AND v_flag.depends_on IS NOT NULL THEN
    FOR i IN 1..array_length(v_flag.depends_on, 1) LOOP
      IF NOT is_feature_enabled(v_flag.depends_on[i], p_user_id, p_user_segment) THEN
        v_enabled := false;
        v_reason := 'dependency_not_met_' || v_flag.depends_on[i];
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- Log evaluation (sample 10%)
  IF random() < 0.1 THEN
    INSERT INTO feature_flag_evaluations(
      flag_key,
      user_id,
      enabled,
      reason,
      user_segment,
      rollout_percentage
    ) VALUES (
      p_flag_key,
      p_user_id,
      v_enabled,
      v_reason,
      p_user_segment,
      v_flag.rollout_percentage
    );
  END IF;
  
  RETURN v_enabled;
END;
$$;

-- Function: Get all enabled features for user
CREATE OR REPLACE FUNCTION get_user_features(
  p_user_id uuid,
  p_user_segment text DEFAULT NULL
)
RETURNS TABLE(flag_key text, enabled boolean)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ff.flag_key,
    is_feature_enabled(ff.flag_key, p_user_id, p_user_segment)
  FROM feature_flags ff
  WHERE ff.status != 'disabled';
END;
$$;

-- Function: Gradually increase rollout percentage
CREATE OR REPLACE FUNCTION increase_rollout(
  p_flag_key text,
  p_increment int DEFAULT 10,
  p_max_percentage int DEFAULT 100
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_percentage int;
BEGIN
  UPDATE feature_flags
  SET 
    rollout_percentage = LEAST(rollout_percentage + p_increment, p_max_percentage),
    updated_at = now()
  WHERE flag_key = p_flag_key
  RETURNING rollout_percentage INTO v_new_percentage;
  
  RAISE NOTICE 'Rollout increased to % for flag %', v_new_percentage, p_flag_key;
  RETURN v_new_percentage;
END;
$$;

-- RLS Policies
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_stages ENABLE ROW LEVEL SECURITY;

-- Admins manage feature flags
CREATE POLICY "Admins manage feature flags"
  ON feature_flags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Users can view their own overrides
CREATE POLICY "Users view own overrides"
  ON feature_flag_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role manages all
CREATE POLICY "Service role manages flags"
  ON feature_flags FOR ALL TO service_role
  USING (true);

CREATE POLICY "Service role manages overrides"
  ON feature_flag_overrides FOR ALL TO service_role
  USING (true);

-- Insert default feature flags
INSERT INTO feature_flags(flag_key, name, description, status, targeting_strategy)
VALUES 
  ('feedback_api', 'Feedback API', 'Enable feedback submission API endpoints', 'enabled', 'all'),
  ('feedback_ui', 'Feedback UI', 'Enable feedback submission UI', 'enabled', 'all'),
  ('realtime_updates', 'Realtime Updates', 'Enable realtime review updates', 'canary', 'percentage'),
  ('notifications', 'Notifications', 'Enable review notification system', 'enabled', 'all'),
  ('ab_experiments', 'A/B Experiments', 'Enable A/B experiment system', 'development', 'user_list'),
  ('rate_limiting', 'Rate Limiting', 'Enable rate limiting', 'enabled', 'all'),
  ('spam_detection', 'Spam Detection', 'Enable spam detection', 'enabled', 'all'),
  ('webhooks', 'Webhooks', 'Enable webhook deliveries', 'canary', 'percentage'),
  ('analytics_dashboard', 'Analytics Dashboard', 'Enable analytics dashboard', 'staging', 'user_segment'),
  ('image_uploads', 'Image Uploads', 'Enable image uploads in reviews', 'enabled', 'all');

-- Set initial rollout percentages
UPDATE feature_flags SET rollout_percentage = 10 WHERE flag_key = 'realtime_updates';
UPDATE feature_flags SET rollout_percentage = 25 WHERE flag_key = 'webhooks';
UPDATE feature_flags SET target_segments = ARRAY['retailers', 'wholesalers'] WHERE flag_key = 'analytics_dashboard';

COMMENT ON TABLE feature_flags IS 'Feature flag configuration for gradual rollouts';
COMMENT ON TABLE feature_flag_overrides IS 'Per-user feature flag overrides';
COMMENT ON TABLE feature_flag_evaluations IS 'Log of feature flag evaluations';
COMMENT ON TABLE deployment_stages IS 'Deployment stage tracking';
