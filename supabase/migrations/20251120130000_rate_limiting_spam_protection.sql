-- Rate Limiting, Spam Protection & Abuse Mitigation System

-- Rate limit configuration types
CREATE TYPE rate_limit_type AS ENUM ('per_user', 'per_ip', 'per_endpoint', 'global');
CREATE TYPE rate_limit_window AS ENUM ('second', 'minute', 'hour', 'day');

-- Abuse report status
CREATE TYPE abuse_report_status AS ENUM ('pending', 'investigating', 'confirmed', 'dismissed', 'actioned');

-- Rate limit configurations
CREATE TABLE rate_limit_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_pattern text NOT NULL, -- e.g., '/submit-feedback', '/create-review'
  limit_type rate_limit_type NOT NULL,
  max_requests int NOT NULL,
  window_size int NOT NULL,
  window_unit rate_limit_window NOT NULL,
  
  -- Burst protection
  burst_limit int, -- Allow N requests in burst, then enforce rate
  burst_window_seconds int DEFAULT 10,
  
  -- Actions
  block_duration_minutes int DEFAULT 15,
  require_captcha_after int, -- Require CAPTCHA after N violations
  
  -- Metadata
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(endpoint_pattern, limit_type)
);

-- Rate limit violations log
CREATE TABLE rate_limit_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES rate_limit_configs(id),
  
  -- Identifier
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ip_address inet,
  endpoint text NOT NULL,
  
  -- Context
  user_agent text,
  request_body jsonb,
  headers jsonb,
  
  -- Violation details
  requests_in_window int,
  window_start timestamptz,
  window_end timestamptz,
  
  -- Actions taken
  blocked boolean DEFAULT false,
  captcha_required boolean DEFAULT false,
  blocked_until timestamptz,
  
  violated_at timestamptz DEFAULT now()
);

-- CAPTCHA challenges
CREATE TABLE captcha_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address inet NOT NULL,
  
  -- Challenge details
  challenge_token text NOT NULL UNIQUE,
  challenge_type text DEFAULT 'recaptcha_v3', -- recaptcha_v3, hcaptcha, turnstile
  endpoint text,
  
  -- Status
  required_at timestamptz DEFAULT now(),
  solved_at timestamptz,
  is_solved boolean DEFAULT false,
  score decimal(3,2), -- For reCAPTCHA v3 (0.0 - 1.0)
  
  -- Expiry
  expires_at timestamptz DEFAULT (now() + interval '10 minutes'),
  
  created_at timestamptz DEFAULT now()
);

-- Duplicate content detection (fingerprints)
CREATE TABLE content_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content_hash text NOT NULL, -- SHA256 hash of review text
  
  -- Content context
  content_type text DEFAULT 'review', -- review, reply, message
  reference_id uuid, -- ID of the review/reply
  
  -- Detection
  first_seen_at timestamptz DEFAULT now(),
  duplicate_count int DEFAULT 1,
  last_duplicate_at timestamptz DEFAULT now(),
  
  -- Status
  is_spam boolean DEFAULT false,
  is_blocked boolean DEFAULT false,
  
  UNIQUE(user_id, content_hash)
);

-- Abuse reports queue
CREATE TABLE abuse_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reporter
  reporter_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reporter_type text, -- customer, retailer, system
  
  -- Target
  reported_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reported_content_type text NOT NULL, -- review, reply, product, message
  reported_content_id uuid NOT NULL,
  
  -- Reason
  abuse_type text NOT NULL, -- spam, offensive, fake, inappropriate, harassment, other
  description text,
  evidence jsonb, -- Screenshots, URLs, additional context
  
  -- Status
  status abuse_report_status DEFAULT 'pending',
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Investigation
  investigated_at timestamptz,
  resolution_notes text,
  action_taken text, -- content_removed, user_warned, user_suspended, no_action
  
  -- Timestamps
  reported_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User reputation scores (for spam detection)
CREATE TABLE user_reputation (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Scores (0-100, higher is better)
  trust_score int DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  content_quality_score int DEFAULT 50 CHECK (content_quality_score BETWEEN 0 AND 100),
  behavior_score int DEFAULT 50 CHECK (behavior_score BETWEEN 0 AND 100),
  
  -- Factors
  total_reviews int DEFAULT 0,
  helpful_reviews int DEFAULT 0,
  flagged_reviews int DEFAULT 0,
  verified_purchases int DEFAULT 0,
  
  -- Violations
  spam_violations int DEFAULT 0,
  abuse_reports_received int DEFAULT 0,
  rate_limit_violations int DEFAULT 0,
  
  -- Status
  is_trusted boolean DEFAULT false,
  is_suspended boolean DEFAULT false,
  suspended_until timestamptz,
  suspension_reason text,
  
  -- Timestamps
  first_review_at timestamptz,
  last_review_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Suspicious patterns detection (automated)
CREATE TABLE suspicious_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address inet,
  
  -- Pattern type
  pattern_type text NOT NULL, -- rapid_posting, duplicate_content, abnormal_rating_pattern, coordinated_attack
  severity text DEFAULT 'low', -- low, medium, high, critical
  
  -- Details
  detection_rule text,
  pattern_details jsonb,
  confidence_score decimal(3,2), -- 0.0 - 1.0
  
  -- Actions
  auto_flagged boolean DEFAULT false,
  requires_review boolean DEFAULT true,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  
  detected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_rate_limit_violations_user ON rate_limit_violations(user_id);
CREATE INDEX idx_rate_limit_violations_ip ON rate_limit_violations(ip_address);
CREATE INDEX idx_rate_limit_violations_endpoint ON rate_limit_violations(endpoint);
CREATE INDEX idx_rate_limit_violations_timestamp ON rate_limit_violations(violated_at);
CREATE INDEX idx_captcha_challenges_user ON captcha_challenges(user_id);
CREATE INDEX idx_captcha_challenges_token ON captcha_challenges(challenge_token);
CREATE INDEX idx_captcha_challenges_expires ON captcha_challenges(expires_at) WHERE NOT is_solved;
CREATE INDEX idx_content_fingerprints_hash ON content_fingerprints(content_hash);
CREATE INDEX idx_content_fingerprints_user ON content_fingerprints(user_id);
CREATE INDEX idx_abuse_reports_status ON abuse_reports(status);
CREATE INDEX idx_abuse_reports_content ON abuse_reports(reported_content_type, reported_content_id);
CREATE INDEX idx_abuse_reports_reporter ON abuse_reports(reporter_id);
CREATE INDEX idx_user_reputation_scores ON user_reputation(trust_score, is_suspended);
CREATE INDEX idx_suspicious_activity_user ON suspicious_activity_log(user_id);
CREATE INDEX idx_suspicious_activity_pattern ON suspicious_activity_log(pattern_type, severity);

-- Function: Check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id uuid,
  p_ip_address inet,
  p_endpoint text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config record;
  v_window_start timestamptz;
  v_request_count int;
  v_is_allowed boolean := true;
  v_message text := 'OK';
  v_retry_after int := 0;
BEGIN
  -- Check per-user limit
  SELECT * INTO v_config
  FROM rate_limit_configs
  WHERE endpoint_pattern = p_endpoint 
    AND limit_type = 'per_user'
    AND enabled = true
  LIMIT 1;
  
  IF v_config IS NOT NULL THEN
    -- Calculate window start based on window unit
    v_window_start := CASE v_config.window_unit
      WHEN 'second' THEN now() - (v_config.window_size || ' seconds')::interval
      WHEN 'minute' THEN now() - (v_config.window_size || ' minutes')::interval
      WHEN 'hour' THEN now() - (v_config.window_size || ' hours')::interval
      WHEN 'day' THEN now() - (v_config.window_size || ' days')::interval
    END;
    
    -- Count requests in window
    SELECT COUNT(*) INTO v_request_count
    FROM rate_limit_violations
    WHERE user_id = p_user_id
      AND endpoint = p_endpoint
      AND violated_at >= v_window_start;
    
    -- Check if limit exceeded
    IF v_request_count >= v_config.max_requests THEN
      v_is_allowed := false;
      v_message := 'Rate limit exceeded for user';
      v_retry_after := EXTRACT(EPOCH FROM (v_window_start + (v_config.window_size || ' ' || v_config.window_unit)::interval - now()))::int;
      
      -- Log violation
      INSERT INTO rate_limit_violations(
        config_id, user_id, ip_address, endpoint, requests_in_window, 
        window_start, window_end, blocked, blocked_until
      ) VALUES (
        v_config.id, p_user_id, p_ip_address, p_endpoint, v_request_count,
        v_window_start, v_window_start + (v_config.window_size || ' ' || v_config.window_unit)::interval,
        true, now() + (v_config.block_duration_minutes || ' minutes')::interval
      );
      
      -- Check if CAPTCHA required
      IF v_config.require_captcha_after IS NOT NULL THEN
        SELECT COUNT(*) INTO v_request_count
        FROM rate_limit_violations
        WHERE user_id = p_user_id AND violated_at >= now() - interval '1 hour';
        
        IF v_request_count >= v_config.require_captcha_after THEN
          INSERT INTO captcha_challenges(user_id, ip_address, endpoint, challenge_token)
          VALUES (p_user_id, p_ip_address, p_endpoint, encode(gen_random_bytes(32), 'hex'))
          ON CONFLICT (user_id) DO NOTHING;
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- Check per-IP limit (similar logic)
  -- ... (abbreviated for brevity)
  
  RETURN jsonb_build_object(
    'allowed', v_is_allowed,
    'message', v_message,
    'retry_after', v_retry_after,
    'requests_remaining', GREATEST(0, v_config.max_requests - v_request_count)
  );
END;
$$;

-- Function: Detect duplicate content
CREATE OR REPLACE FUNCTION detect_duplicate_content(
  p_user_id uuid,
  p_content text,
  p_content_type text DEFAULT 'review'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_content_hash text;
  v_existing record;
  v_is_duplicate boolean := false;
BEGIN
  -- Generate content hash (SHA256)
  v_content_hash := encode(digest(lower(trim(p_content)), 'sha256'), 'hex');
  
  -- Check for existing fingerprint
  SELECT * INTO v_existing
  FROM content_fingerprints
  WHERE user_id = p_user_id AND content_hash = v_content_hash;
  
  IF v_existing IS NOT NULL THEN
    v_is_duplicate := true;
    
    -- Update duplicate count
    UPDATE content_fingerprints
    SET duplicate_count = duplicate_count + 1,
        last_duplicate_at = now()
    WHERE id = v_existing.id;
    
    -- Mark as spam if threshold exceeded
    IF v_existing.duplicate_count >= 3 THEN
      UPDATE content_fingerprints
      SET is_spam = true, is_blocked = true
      WHERE id = v_existing.id;
      
      -- Log suspicious activity
      INSERT INTO suspicious_activity_log(
        user_id, pattern_type, severity, detection_rule, pattern_details
      ) VALUES (
        p_user_id, 'duplicate_content', 'medium', 
        'same_content_repeated', 
        jsonb_build_object('hash', v_content_hash, 'count', v_existing.duplicate_count + 1)
      );
    END IF;
  ELSE
    -- Create new fingerprint
    INSERT INTO content_fingerprints(user_id, content_hash, content_type)
    VALUES (p_user_id, v_content_hash, p_content_type);
  END IF;
  
  RETURN jsonb_build_object(
    'is_duplicate', v_is_duplicate,
    'duplicate_count', COALESCE(v_existing.duplicate_count, 0),
    'is_blocked', COALESCE(v_existing.is_blocked, false)
  );
END;
$$;

-- Function: Update user reputation
CREATE OR REPLACE FUNCTION update_user_reputation(
  p_user_id uuid,
  p_event_type text, -- review_submitted, review_flagged, helpful_vote, etc.
  p_event_data jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rep record;
  v_trust_delta int := 0;
  v_quality_delta int := 0;
  v_behavior_delta int := 0;
BEGIN
  -- Get or create reputation record
  SELECT * INTO v_rep FROM user_reputation WHERE user_id = p_user_id;
  
  IF v_rep IS NULL THEN
    INSERT INTO user_reputation(user_id) VALUES (p_user_id)
    RETURNING * INTO v_rep;
  END IF;
  
  -- Calculate deltas based on event type
  CASE p_event_type
    WHEN 'review_submitted' THEN
      v_quality_delta := 1;
      UPDATE user_reputation SET total_reviews = total_reviews + 1 WHERE user_id = p_user_id;
      
    WHEN 'review_helpful' THEN
      v_trust_delta := 2;
      v_quality_delta := 2;
      UPDATE user_reputation SET helpful_reviews = helpful_reviews + 1 WHERE user_id = p_user_id;
      
    WHEN 'review_flagged' THEN
      v_trust_delta := -5;
      v_quality_delta := -5;
      UPDATE user_reputation SET flagged_reviews = flagged_reviews + 1 WHERE user_id = p_user_id;
      
    WHEN 'spam_detected' THEN
      v_behavior_delta := -10;
      UPDATE user_reputation SET spam_violations = spam_violations + 1 WHERE user_id = p_user_id;
      
    WHEN 'abuse_report' THEN
      v_trust_delta := -8;
      v_behavior_delta := -8;
      UPDATE user_reputation SET abuse_reports_received = abuse_reports_received + 1 WHERE user_id = p_user_id;
      
    WHEN 'verified_purchase' THEN
      v_trust_delta := 5;
      UPDATE user_reputation SET verified_purchases = verified_purchases + 1 WHERE user_id = p_user_id;
  END CASE;
  
  -- Update scores (bounded 0-100)
  UPDATE user_reputation
  SET 
    trust_score = LEAST(100, GREATEST(0, trust_score + v_trust_delta)),
    content_quality_score = LEAST(100, GREATEST(0, content_quality_score + v_quality_delta)),
    behavior_score = LEAST(100, GREATEST(0, behavior_score + v_behavior_delta)),
    is_trusted = (trust_score + v_trust_delta >= 80 AND behavior_score + v_behavior_delta >= 70),
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Auto-suspend if scores drop too low
  IF (v_rep.trust_score + v_trust_delta < 20) OR (v_rep.behavior_score + v_behavior_delta < 20) THEN
    UPDATE user_reputation
    SET 
      is_suspended = true,
      suspended_until = now() + interval '7 days',
      suspension_reason = 'Automatic suspension due to low reputation scores'
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- RLS Policies
ALTER TABLE rate_limit_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE captcha_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_activity_log ENABLE ROW LEVEL SECURITY;

-- Admins can manage all rate limit configs
CREATE POLICY "Admins manage rate limit configs"
  ON rate_limit_configs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Users can view own violations
CREATE POLICY "Users view own violations"
  ON rate_limit_violations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins view all violations
CREATE POLICY "Admins view all violations"
  ON rate_limit_violations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Users can view own CAPTCHA challenges
CREATE POLICY "Users view own captcha"
  ON captcha_challenges FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role can manage CAPTCHA
CREATE POLICY "Service role manage captcha"
  ON captcha_challenges FOR ALL TO service_role
  USING (true);

-- Users can submit abuse reports
CREATE POLICY "Users submit abuse reports"
  ON abuse_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Users can view own reports
CREATE POLICY "Users view own reports"
  ON abuse_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR reported_user_id = auth.uid());

-- Admins/moderators manage reports
CREATE POLICY "Admins manage abuse reports"
  ON abuse_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'moderator')));

-- Users can view own reputation
CREATE POLICY "Users view own reputation"
  ON user_reputation FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role manages reputation
CREATE POLICY "Service role manage reputation"
  ON user_reputation FOR ALL TO service_role
  USING (true);

-- Default rate limit configurations
INSERT INTO rate_limit_configs(endpoint_pattern, limit_type, max_requests, window_size, window_unit, burst_limit, require_captcha_after)
VALUES 
  ('/submit-feedback', 'per_user', 10, 1, 'minute', 3, 5),
  ('/submit-feedback', 'per_ip', 50, 1, 'minute', 10, 3),
  ('/create-review', 'per_user', 5, 1, 'hour', 2, 3),
  ('/moderate-review', 'per_user', 100, 1, 'minute', 20, NULL),
  ('/flag-content', 'per_user', 20, 1, 'hour', 5, 5);

COMMENT ON TABLE rate_limit_configs IS 'Rate limiting rules for API endpoints';
COMMENT ON TABLE rate_limit_violations IS 'Log of rate limit violations';
COMMENT ON TABLE captcha_challenges IS 'CAPTCHA challenges for suspicious users';
COMMENT ON TABLE content_fingerprints IS 'Duplicate content detection via hashing';
COMMENT ON TABLE abuse_reports IS 'User-reported abuse and spam queue';
COMMENT ON TABLE user_reputation IS 'User trust and behavior scores';
COMMENT ON TABLE suspicious_activity_log IS 'Automated detection of suspicious patterns';
