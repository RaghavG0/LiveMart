-- Privacy, GDPR & Data Retention System
-- Provides user data deletion, anonymization, consent tracking, and retention policies

-- Data retention policy enum
CREATE TYPE retention_policy AS ENUM ('delete', 'anonymize', 'archive', 'keep');

-- Consent type enum
CREATE TYPE consent_type AS ENUM (
  'analytics',
  'marketing',
  'feedback_usage',
  'data_processing',
  'third_party_sharing',
  'profiling'
);

-- Deletion request status
CREATE TYPE deletion_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- Consent log
CREATE TABLE consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Consent details
  consent_type consent_type NOT NULL,
  consented boolean NOT NULL,
  consent_text text NOT NULL,
  version text DEFAULT '1.0',
  
  -- Context
  ip_address inet,
  user_agent text,
  page_url text,
  
  -- Timestamps
  consented_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  
  created_at timestamptz DEFAULT now()
);

-- Data retention configurations
CREATE TABLE data_retention_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type text NOT NULL UNIQUE, -- reviews, images, logs, audit_trail, etc.
  
  -- Retention policy
  retention_days int NOT NULL,
  policy retention_policy NOT NULL,
  
  -- Anonymization config
  anonymize_fields jsonb, -- Fields to anonymize: ["user_id", "email", "ip_address"]
  
  -- Archive location
  archive_location text, -- S3 bucket, cold storage path
  
  -- Metadata
  description text,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User deletion requests
CREATE TABLE user_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Request details
  reason text,
  deletion_type text DEFAULT 'full', -- full, partial, anonymize
  specific_data jsonb, -- Specific data to delete if partial
  
  -- Status tracking
  status deletion_status DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Execution details
  data_deleted jsonb, -- Record what was deleted
  errors jsonb, -- Any errors encountered
  processed_by uuid REFERENCES profiles(id),
  
  -- Compliance
  confirmation_token text UNIQUE,
  confirmed_at timestamptz,
  ip_address inet,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Audit log for data access and modifications
CREATE TABLE data_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_ip inet,
  actor_user_agent text,
  
  -- Action
  action text NOT NULL, -- access, create, update, delete, export, anonymize
  resource_type text NOT NULL, -- review, user, order, etc.
  resource_id uuid,
  
  -- Details
  data_accessed jsonb, -- What data was accessed/modified
  changes jsonb, -- Before/after for updates
  reason text, -- Why the action was performed
  
  -- Legal basis (GDPR)
  legal_basis text, -- consent, contract, legitimate_interest, legal_obligation
  
  -- Metadata
  accessed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Anonymized user records (preserve analytics without PII)
CREATE TABLE anonymized_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id uuid NOT NULL, -- Hash of original ID
  
  -- Anonymized data
  user_segment text, -- General segment (e.g., "high_value", "new_user")
  registration_month date, -- Month only, not exact date
  total_orders int,
  total_reviews int,
  avg_rating decimal(3,2),
  
  -- Timestamps
  anonymized_at timestamptz DEFAULT now(),
  original_created_at timestamptz
);

-- Indexes
CREATE INDEX idx_consent_log_user ON consent_log(user_id);
CREATE INDEX idx_consent_log_type ON consent_log(consent_type, consented);
CREATE INDEX idx_consent_log_expires ON consent_log(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_deletion_requests_status ON user_deletion_requests(status);
CREATE INDEX idx_deletion_requests_user ON user_deletion_requests(user_id);
CREATE INDEX idx_deletion_requests_scheduled ON user_deletion_requests(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_data_access_audit_user ON data_access_audit(user_id);
CREATE INDEX idx_data_access_audit_resource ON data_access_audit(resource_type, resource_id);
CREATE INDEX idx_data_access_audit_accessed_at ON data_access_audit(accessed_at);

-- Function: Log data access
CREATE OR REPLACE FUNCTION log_data_access(
  p_user_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_data_accessed jsonb DEFAULT '{}'::jsonb,
  p_legal_basis text DEFAULT 'legitimate_interest'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_id uuid;
BEGIN
  INSERT INTO data_access_audit(
    user_id,
    action,
    resource_type,
    resource_id,
    data_accessed,
    legal_basis
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_data_accessed,
    p_legal_basis
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Function: Check user consent
CREATE OR REPLACE FUNCTION check_user_consent(
  p_user_id uuid,
  p_consent_type consent_type
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_consented boolean;
BEGIN
  SELECT consented INTO v_consented
  FROM consent_log
  WHERE user_id = p_user_id
    AND consent_type = p_consent_type
    AND revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY consented_at DESC
  LIMIT 1;
  
  RETURN COALESCE(v_consented, false);
END;
$$;

-- Function: Anonymize user data
CREATE OR REPLACE FUNCTION anonymize_user_data(
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_data record;
  v_result jsonb := '{}'::jsonb;
BEGIN
  -- Get user data for anonymized record
  SELECT 
    id,
    created_at,
    (SELECT COUNT(*) FROM orders WHERE customer_id = p_user_id) as total_orders,
    (SELECT COUNT(*) FROM reviews WHERE user_id = p_user_id) as total_reviews,
    (SELECT AVG(rating) FROM reviews WHERE user_id = p_user_id) as avg_rating
  INTO v_user_data
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_user_data IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  -- Create anonymized record
  INSERT INTO anonymized_users(
    original_user_id,
    user_segment,
    registration_month,
    total_orders,
    total_reviews,
    avg_rating,
    original_created_at
  ) VALUES (
    encode(digest(p_user_id::text, 'sha256'), 'hex')::uuid,
    CASE 
      WHEN v_user_data.total_orders >= 10 THEN 'high_value'
      WHEN v_user_data.total_orders >= 3 THEN 'regular'
      ELSE 'new_user'
    END,
    date_trunc('month', v_user_data.created_at)::date,
    v_user_data.total_orders,
    v_user_data.total_reviews,
    v_user_data.avg_rating,
    v_user_data.created_at
  );
  
  -- Anonymize reviews (keep for analytics but remove PII)
  UPDATE reviews
  SET 
    comment = '[Deleted by user]',
    is_visible = false,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING jsonb_agg(id) INTO v_result;
  
  -- Delete media uploads
  DELETE FROM image_uploads WHERE user_id = p_user_id;
  
  -- Anonymize profile
  UPDATE profiles
  SET 
    email = 'deleted_' || encode(digest(id::text, 'sha256'), 'hex') || '@deleted.local',
    full_name = 'Deleted User',
    phone_number = NULL,
    avatar_url = NULL,
    updated_at = now()
  WHERE id = p_user_id;
  
  -- Log the anonymization
  INSERT INTO data_access_audit(
    user_id,
    action,
    resource_type,
    resource_id,
    data_accessed,
    legal_basis
  ) VALUES (
    p_user_id,
    'anonymize',
    'user',
    p_user_id,
    v_result,
    'user_request'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'reviews_anonymized', jsonb_array_length(COALESCE(v_result, '[]'::jsonb)),
    'anonymized_at', now()
  );
END;
$$;

-- Function: Delete user data permanently
CREATE OR REPLACE FUNCTION delete_user_data(
  p_user_id uuid,
  p_deletion_type text DEFAULT 'full'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_deleted_data jsonb := '{}'::jsonb;
BEGIN
  -- First, create anonymized record if needed
  IF p_deletion_type = 'full' THEN
    v_deleted_data := anonymize_user_data(p_user_id);
  END IF;
  
  -- Delete user-specific data
  DELETE FROM reviews WHERE user_id = p_user_id
  RETURNING jsonb_agg(id) INTO v_deleted_data;
  
  DELETE FROM image_uploads WHERE user_id = p_user_id;
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM experiment_assignments WHERE user_id = p_user_id;
  DELETE FROM user_reputation WHERE user_id = p_user_id;
  DELETE FROM consent_log WHERE user_id = p_user_id;
  
  -- Delete profile (cascades to other tables with ON DELETE CASCADE)
  DELETE FROM profiles WHERE id = p_user_id;
  
  -- Log deletion
  INSERT INTO data_access_audit(
    user_id,
    action,
    resource_type,
    resource_id,
    data_accessed,
    legal_basis
  ) VALUES (
    p_user_id,
    'delete',
    'user',
    p_user_id,
    v_deleted_data,
    'user_request'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'deletion_type', p_deletion_type,
    'data_deleted', v_deleted_data,
    'deleted_at', now()
  );
END;
$$;

-- Function: Export user data (GDPR data portability)
CREATE OR REPLACE FUNCTION export_user_data(
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile jsonb;
  v_reviews jsonb;
  v_orders jsonb;
  v_consents jsonb;
  v_result jsonb;
BEGIN
  -- Get profile
  SELECT to_jsonb(profiles.*) INTO v_profile
  FROM profiles WHERE id = p_user_id;
  
  -- Get reviews
  SELECT jsonb_agg(to_jsonb(reviews.*)) INTO v_reviews
  FROM reviews WHERE user_id = p_user_id;
  
  -- Get orders
  SELECT jsonb_agg(to_jsonb(orders.*)) INTO v_orders
  FROM orders WHERE customer_id = p_user_id;
  
  -- Get consents
  SELECT jsonb_agg(to_jsonb(consent_log.*)) INTO v_consents
  FROM consent_log WHERE user_id = p_user_id;
  
  v_result := jsonb_build_object(
    'profile', v_profile,
    'reviews', COALESCE(v_reviews, '[]'::jsonb),
    'orders', COALESCE(v_orders, '[]'::jsonb),
    'consents', COALESCE(v_consents, '[]'::jsonb),
    'exported_at', now(),
    'format_version', '1.0'
  );
  
  -- Log export
  PERFORM log_data_access(
    p_user_id,
    'export',
    'user',
    p_user_id,
    jsonb_build_object('size_kb', length(v_result::text) / 1024),
    'user_request'
  );
  
  RETURN v_result;
END;
$$;

-- Function: Process deletion request
CREATE OR REPLACE FUNCTION process_deletion_request(
  p_request_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request record;
  v_result jsonb;
BEGIN
  -- Get request
  SELECT * INTO v_request
  FROM user_deletion_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Deletion request not found or not pending: %', p_request_id;
  END IF;
  
  -- Update status to processing
  UPDATE user_deletion_requests
  SET status = 'processing', started_at = now()
  WHERE id = p_request_id;
  
  -- Perform deletion
  BEGIN
    IF v_request.deletion_type = 'anonymize' THEN
      v_result := anonymize_user_data(v_request.user_id);
    ELSE
      v_result := delete_user_data(v_request.user_id, v_request.deletion_type);
    END IF;
    
    -- Mark as completed
    UPDATE user_deletion_requests
    SET 
      status = 'completed',
      completed_at = now(),
      data_deleted = v_result
    WHERE id = p_request_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Mark as failed
    UPDATE user_deletion_requests
    SET 
      status = 'failed',
      errors = jsonb_build_object(
        'error', SQLERRM,
        'detail', SQLSTATE
      )
    WHERE id = p_request_id;
    
    RAISE;
  END;
END;
$$;

-- RLS Policies
ALTER TABLE consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_retention_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymized_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own consents
CREATE POLICY "Users view own consents"
  ON consent_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own consents
CREATE POLICY "Users insert own consents"
  ON consent_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins manage retention configs
CREATE POLICY "Admins manage retention configs"
  ON data_retention_configs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Users can view own deletion requests
CREATE POLICY "Users view own deletion requests"
  ON user_deletion_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can create deletion requests
CREATE POLICY "Users create deletion requests"
  ON user_deletion_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admins manage deletion requests
CREATE POLICY "Admins manage deletion requests"
  ON user_deletion_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Users can view their own audit logs
CREATE POLICY "Users view own audit logs"
  ON data_access_audit FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins view all audit logs
CREATE POLICY "Admins view all audit logs"
  ON data_access_audit FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Service role manages all
CREATE POLICY "Service role manages audit"
  ON data_access_audit FOR ALL TO service_role
  USING (true);

-- Admins can view anonymized data for analytics
CREATE POLICY "Admins view anonymized data"
  ON anonymized_users FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'analyst')));

-- Default retention policies
INSERT INTO data_retention_configs(data_type, retention_days, policy, anonymize_fields, description)
VALUES 
  ('reviews', 730, 'keep', NULL, 'Keep reviews for 2 years, then archive'),
  ('review_images', 730, 'archive', NULL, 'Archive images after 2 years'),
  ('audit_logs', 2555, 'keep', NULL, 'Keep audit logs for 7 years (compliance)'),
  ('activity_logs', 90, 'delete', NULL, 'Delete activity logs after 90 days'),
  ('deleted_users', 30, 'anonymize', '["email", "phone_number", "ip_address"]', 'Anonymize deleted users after 30 days'),
  ('notification_logs', 90, 'delete', NULL, 'Delete notification logs after 90 days'),
  ('rate_limit_violations', 30, 'delete', NULL, 'Delete rate limit logs after 30 days');

COMMENT ON TABLE consent_log IS 'User consent tracking for GDPR compliance';
COMMENT ON TABLE data_retention_configs IS 'Data retention policies for different data types';
COMMENT ON TABLE user_deletion_requests IS 'User requests for data deletion or anonymization';
COMMENT ON TABLE data_access_audit IS 'Audit trail of data access and modifications';
COMMENT ON TABLE anonymized_users IS 'Anonymized user records for analytics';
