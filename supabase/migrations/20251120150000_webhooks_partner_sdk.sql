-- Webhooks & Partner SDK System
-- Enable partners to receive real-time events via webhooks with HMAC signing

-- Webhook event types
CREATE TYPE webhook_event_type AS ENUM (
  'SKU_ALERT',
  'FEEDBACK_SUBMITTED',
  'FEEDBACK_APPROVED',
  'FEEDBACK_FLAGGED',
  'FEEDBACK_REPLIED',
  'ORDER_STATUS_CHANGED',
  'PRODUCT_RATING_UPDATED',
  'STOCK_LOW',
  'STOCK_OUT',
  'REVIEW_MILESTONE'
);

-- Webhook subscription status
CREATE TYPE webhook_status AS ENUM ('active', 'paused', 'failed', 'disabled');

-- Webhook subscriptions
CREATE TABLE webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Owner
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  
  -- Endpoint
  url text NOT NULL,
  secret_key text NOT NULL, -- For HMAC signing
  
  -- Event filters
  events webhook_event_type[] NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb, -- Additional filters like {"product_ids": [...], "min_rating": 4}
  
  -- Configuration
  retry_policy jsonb DEFAULT '{"max_attempts": 3, "backoff_multiplier": 2, "initial_delay_seconds": 5}'::jsonb,
  timeout_seconds int DEFAULT 30,
  
  -- Headers to include
  custom_headers jsonb DEFAULT '{}'::jsonb,
  
  -- Status
  status webhook_status DEFAULT 'active',
  last_triggered_at timestamptz,
  total_deliveries int DEFAULT 0,
  successful_deliveries int DEFAULT 0,
  failed_deliveries int DEFAULT 0,
  
  -- Health
  consecutive_failures int DEFAULT 0,
  last_failure_at timestamptz,
  last_error text,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, name)
);

-- Webhook delivery log
CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  
  -- Event
  event_type webhook_event_type NOT NULL,
  event_id uuid NOT NULL, -- ID of the triggering event
  payload jsonb NOT NULL,
  
  -- Delivery
  attempt_number int DEFAULT 1,
  response_status int,
  response_body text,
  response_time_ms int,
  
  -- Status
  success boolean DEFAULT false,
  error_message text,
  
  -- Timing
  triggered_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  next_retry_at timestamptz,
  
  created_at timestamptz DEFAULT now()
);

-- Webhook events queue (pending deliveries)
CREATE TABLE webhook_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  
  -- Event
  event_type webhook_event_type NOT NULL,
  event_data jsonb NOT NULL,
  
  -- Processing
  status text DEFAULT 'pending', -- pending, processing, completed, failed
  attempts int DEFAULT 0,
  max_attempts int DEFAULT 3,
  next_attempt_at timestamptz DEFAULT now(),
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Partner API keys (for SDK authentication)
CREATE TABLE partner_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Key details
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE, -- SHA256 hash of the actual key
  key_prefix text NOT NULL, -- First 8 chars for identification (e.g., "pk_live_")
  
  -- Permissions
  scopes text[] DEFAULT ARRAY['read:reviews', 'write:replies'], -- read:*, write:*, admin:*
  rate_limit_per_minute int DEFAULT 60,
  
  -- Status
  is_active boolean DEFAULT true,
  last_used_at timestamptz,
  usage_count int DEFAULT 0,
  
  -- Expiry
  expires_at timestamptz,
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text,
  
  UNIQUE(user_id, name)
);

-- Indexes
CREATE INDEX idx_webhook_subscriptions_user ON webhook_subscriptions(user_id);
CREATE INDEX idx_webhook_subscriptions_status ON webhook_subscriptions(status) WHERE status = 'active';
CREATE INDEX idx_webhook_deliveries_subscription ON webhook_deliveries(subscription_id);
CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries(event_type, event_id);
CREATE INDEX idx_webhook_deliveries_triggered ON webhook_deliveries(triggered_at);
CREATE INDEX idx_webhook_queue_subscription ON webhook_queue(subscription_id);
CREATE INDEX idx_webhook_queue_next_attempt ON webhook_queue(next_attempt_at) WHERE status = 'pending';
CREATE INDEX idx_partner_api_keys_user ON partner_api_keys(user_id);
CREATE INDEX idx_partner_api_keys_hash ON partner_api_keys(key_hash) WHERE is_active = true;

-- Function: Generate HMAC signature
CREATE OR REPLACE FUNCTION generate_webhook_signature(
  p_payload text,
  p_secret text
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN encode(hmac(p_payload, p_secret, 'sha256'), 'hex');
END;
$$;

-- Function: Verify webhook signature
CREATE OR REPLACE FUNCTION verify_webhook_signature(
  p_payload text,
  p_signature text,
  p_secret text
) RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_signature = generate_webhook_signature(p_payload, p_secret);
END;
$$;

-- Function: Queue webhook event
CREATE OR REPLACE FUNCTION queue_webhook_event(
  p_event_type webhook_event_type,
  p_event_data jsonb,
  p_filters jsonb DEFAULT '{}'::jsonb
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription record;
  v_queued_count int := 0;
  v_matches boolean;
BEGIN
  -- Find matching subscriptions
  FOR v_subscription IN 
    SELECT * FROM webhook_subscriptions
    WHERE status = 'active'
      AND p_event_type = ANY(events)
  LOOP
    v_matches := true;
    
    -- Apply filters
    IF v_subscription.filters ? 'product_ids' THEN
      IF NOT (p_event_data->>'product_id')::uuid = ANY(
        SELECT jsonb_array_elements_text(v_subscription.filters->'product_ids')::uuid
      ) THEN
        v_matches := false;
      END IF;
    END IF;
    
    IF v_subscription.filters ? 'min_rating' THEN
      IF (p_event_data->>'rating')::int < (v_subscription.filters->>'min_rating')::int THEN
        v_matches := false;
      END IF;
    END IF;
    
    -- Queue if matches
    IF v_matches THEN
      INSERT INTO webhook_queue(subscription_id, event_type, event_data)
      VALUES (v_subscription.id, p_event_type, p_event_data);
      
      v_queued_count := v_queued_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_queued_count;
END;
$$;

-- Function: Process webhook queue (called by worker)
CREATE OR REPLACE FUNCTION process_webhook_queue(
  p_batch_size int DEFAULT 10
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queue_item record;
  v_subscription record;
  v_processed int := 0;
BEGIN
  FOR v_queue_item IN 
    SELECT * FROM webhook_queue
    WHERE status = 'pending'
      AND next_attempt_at <= now()
      AND attempts < max_attempts
    ORDER BY created_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Get subscription
    SELECT * INTO v_subscription
    FROM webhook_subscriptions
    WHERE id = v_queue_item.subscription_id;
    
    IF v_subscription IS NULL OR v_subscription.status != 'active' THEN
      -- Delete queue item if subscription gone or inactive
      DELETE FROM webhook_queue WHERE id = v_queue_item.id;
      CONTINUE;
    END IF;
    
    -- Mark as processing
    UPDATE webhook_queue
    SET status = 'processing', attempts = attempts + 1
    WHERE id = v_queue_item.id;
    
    -- Note: Actual HTTP delivery happens in the worker
    -- This function just prepares the queue
    
    v_processed := v_processed + 1;
  END LOOP;
  
  RETURN v_processed;
END;
$$;

-- Function: Record webhook delivery
CREATE OR REPLACE FUNCTION record_webhook_delivery(
  p_subscription_id uuid,
  p_queue_id uuid,
  p_event_type webhook_event_type,
  p_event_id uuid,
  p_payload jsonb,
  p_attempt_number int,
  p_success boolean,
  p_response_status int DEFAULT NULL,
  p_response_body text DEFAULT NULL,
  p_response_time_ms int DEFAULT NULL,
  p_error_message text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retry_policy jsonb;
  v_next_retry timestamptz;
BEGIN
  -- Insert delivery log
  INSERT INTO webhook_deliveries(
    subscription_id,
    event_type,
    event_id,
    payload,
    attempt_number,
    success,
    response_status,
    response_body,
    response_time_ms,
    error_message,
    delivered_at
  ) VALUES (
    p_subscription_id,
    p_event_type,
    p_event_id,
    p_payload,
    p_attempt_number,
    p_success,
    p_response_status,
    p_response_body,
    p_response_time_ms,
    p_error_message,
    now()
  );
  
  -- Update subscription stats
  UPDATE webhook_subscriptions
  SET 
    total_deliveries = total_deliveries + 1,
    successful_deliveries = successful_deliveries + CASE WHEN p_success THEN 1 ELSE 0 END,
    failed_deliveries = failed_deliveries + CASE WHEN NOT p_success THEN 1 ELSE 0 END,
    consecutive_failures = CASE WHEN p_success THEN 0 ELSE consecutive_failures + 1 END,
    last_triggered_at = now(),
    last_failure_at = CASE WHEN NOT p_success THEN now() ELSE last_failure_at END,
    last_error = CASE WHEN NOT p_success THEN p_error_message ELSE NULL END,
    status = CASE 
      WHEN p_success THEN 'active'
      WHEN consecutive_failures + 1 >= 10 THEN 'failed'
      ELSE status
    END
  WHERE id = p_subscription_id;
  
  IF p_success THEN
    -- Remove from queue
    DELETE FROM webhook_queue WHERE id = p_queue_id;
  ELSE
    -- Get retry policy
    SELECT retry_policy INTO v_retry_policy
    FROM webhook_subscriptions
    WHERE id = p_subscription_id;
    
    -- Calculate next retry time with exponential backoff
    v_next_retry := now() + (
      (v_retry_policy->>'initial_delay_seconds')::int * 
      power((v_retry_policy->>'backoff_multiplier')::int, p_attempt_number - 1) || ' seconds'
    )::interval;
    
    -- Update queue
    UPDATE webhook_queue
    SET 
      status = CASE 
        WHEN attempts >= max_attempts THEN 'failed'
        ELSE 'pending'
      END,
      next_retry_at = v_next_retry,
      processed_at = now()
    WHERE id = p_queue_id;
  END IF;
END;
$$;

-- Function: Get active webhooks for event
CREATE OR REPLACE FUNCTION get_webhooks_for_event(
  p_event_type webhook_event_type,
  p_user_id uuid DEFAULT NULL
) RETURNS TABLE(
  subscription_id uuid,
  url text,
  secret_key text,
  custom_headers jsonb,
  timeout_seconds int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ws.id,
    ws.url,
    ws.secret_key,
    ws.custom_headers,
    ws.timeout_seconds
  FROM webhook_subscriptions ws
  WHERE ws.status = 'active'
    AND p_event_type = ANY(ws.events)
    AND (p_user_id IS NULL OR ws.user_id = p_user_id);
END;
$$;

-- RLS Policies
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_api_keys ENABLE ROW LEVEL SECURITY;

-- Users manage own subscriptions
CREATE POLICY "Users manage own webhooks"
  ON webhook_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Users view own deliveries
CREATE POLICY "Users view own deliveries"
  ON webhook_deliveries FOR SELECT TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM webhook_subscriptions WHERE user_id = auth.uid()
    )
  );

-- Service role manages queue
CREATE POLICY "Service role manages queue"
  ON webhook_queue FOR ALL TO service_role
  USING (true);

-- Users manage own API keys
CREATE POLICY "Users manage own api keys"
  ON partner_api_keys FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Trigger: Queue webhook on review events
CREATE OR REPLACE FUNCTION trigger_review_webhooks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM queue_webhook_event(
      'FEEDBACK_SUBMITTED',
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.moderation_status = 'approved' AND OLD.moderation_status != 'approved' THEN
      PERFORM queue_webhook_event(
        'FEEDBACK_APPROVED',
        to_jsonb(NEW)
      );
    END IF;
    
    IF NEW.is_flagged = true AND OLD.is_flagged != true THEN
      PERFORM queue_webhook_event(
        'FEEDBACK_FLAGGED',
        to_jsonb(NEW)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER webhook_on_review_change
AFTER INSERT OR UPDATE ON reviews
FOR EACH ROW
EXECUTE FUNCTION trigger_review_webhooks();

COMMENT ON TABLE webhook_subscriptions IS 'Partner webhook subscriptions for event notifications';
COMMENT ON TABLE webhook_deliveries IS 'Log of webhook delivery attempts and responses';
COMMENT ON TABLE webhook_queue IS 'Queue of pending webhook deliveries';
COMMENT ON TABLE partner_api_keys IS 'API keys for partner SDK authentication';
