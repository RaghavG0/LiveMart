-- Notifications System Migration
-- Date: 2025-11-19
-- Purpose: Provide durable notification queue, delivery logging, user preferences, templates, retry & DLQ, idempotency.

-- =============================
-- ENUM TYPES
-- =============================

CREATE TYPE notification_event_type AS ENUM (
  'ORDER_STATUS_CHANGED',
  'ORDER_DELIVERED',
  'DELIVERY_CONFIRMATION_SENT',
  'FEEDBACK_SUBMITTED',
  'FEEDBACK_REPLY',
  'FEEDBACK_APPROVED'
);

CREATE TYPE notification_channel AS ENUM (
  'email', 'sms', 'push'
);

CREATE TYPE notification_queue_status AS ENUM (
  'pending', 'processing', 'sending', 'sent', 'failed', 'dead_letter'
);

-- =============================
-- TABLES
-- =============================

-- User notification preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_opt_in boolean DEFAULT true NOT NULL,
  sms_opt_in boolean DEFAULT false NOT NULL,
  push_opt_in boolean DEFAULT true NOT NULL,
  quiet_hours_start time without time zone, -- optional (e.g., 22:00:00)
  quiet_hours_end time without time zone,   -- optional (e.g., 07:00:00)
  preferred_language text DEFAULT 'en' NOT NULL, -- ISO language code
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Durable notifications queue (acts like a job queue)
CREATE TABLE IF NOT EXISTS notifications_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type notification_event_type NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- channels planned for this event, resolved from user prefs at enqueue time
  channels notification_channel[] NOT NULL,
  event_payload jsonb NOT NULL,
  status notification_queue_status DEFAULT 'pending' NOT NULL,
  retry_count int DEFAULT 0 NOT NULL,
  max_retries int DEFAULT 5 NOT NULL,
  next_attempt_at timestamptz DEFAULT now() NOT NULL,
  dedup_key text, -- optional external idempotency key
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- For logging provider-level attempts (each channel may attempt multiple times)
CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES notifications_queue(id) ON DELETE CASCADE,
  attempt_number int NOT NULL,
  channel notification_channel NOT NULL,
  success boolean NOT NULL,
  provider_response jsonb,
  error_message text,
  attempted_at timestamptz DEFAULT now() NOT NULL
);

-- Final delivered notifications (in-app inbox + audit)
CREATE TABLE IF NOT EXISTS notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES notifications_queue(id) ON DELETE SET NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type notification_event_type NOT NULL,
  channels notification_channel[] NOT NULL,
  email_sent boolean DEFAULT false NOT NULL,
  sms_sent boolean DEFAULT false NOT NULL,
  push_sent boolean DEFAULT false NOT NULL,
  delivery_status text, -- summary (e.g., 'partial', 'success', 'failed')
  delivered_at timestamptz DEFAULT now() NOT NULL,
  payload jsonb NOT NULL,
  dedup_key text, -- identical to queue.dedup_key for idempotency
  unread boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Dead letter queue for permanently failed events
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_queue_id uuid REFERENCES notifications_queue(id) ON DELETE SET NULL,
  event_type notification_event_type NOT NULL,
  payload jsonb NOT NULL,
  failure_reason text,
  retries int NOT NULL,
  failed_at timestamptz DEFAULT now() NOT NULL
);

-- Processed events registry for idempotency & deduplication
CREATE TABLE IF NOT EXISTS processed_events (
  event_id text PRIMARY KEY, -- external or composed event identifier
  processed_at timestamptz DEFAULT now() NOT NULL
);

-- Notification templates (multi-channel + localization)
CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type notification_event_type NOT NULL,
  channel notification_channel NOT NULL,
  language_code text NOT NULL DEFAULT 'en',
  subject text,           -- for email / push
  body_html text,         -- for email
  body_text text,         -- for email & sms fallback
  push_title text,        -- for push notifications
  push_body text,         -- for push notifications
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (event_type, channel, language_code)
);

-- =============================
-- INDEXES
-- =============================

CREATE INDEX IF NOT EXISTS idx_notifications_queue_status_next_attempt ON notifications_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_notifications_queue_user ON notifications_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_queue_dedup_key ON notifications_queue(dedup_key);
CREATE INDEX IF NOT EXISTS idx_notifications_log_user_unread ON notifications_log(user_id, unread) WHERE unread = true;
CREATE INDEX IF NOT EXISTS idx_notifications_log_event_type ON notifications_log(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_attempts_queue ON notification_delivery_attempts(queue_id);
CREATE INDEX IF NOT EXISTS idx_dead_letter_queue_event_type ON dead_letter_queue(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_event_channel_lang ON notification_templates(event_type, channel, language_code);

-- =============================
-- RLS ENABLE + POLICIES
-- =============================

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Preferences: user can view/update their own; admin can view all
CREATE POLICY user_notification_preferences_select ON user_notification_preferences
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY user_notification_preferences_update ON user_notification_preferences
  FOR UPDATE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY user_notification_preferences_insert ON user_notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Queue & attempts & DLQ: service role only (processed by backend workers)
CREATE POLICY notifications_queue_service_role ON notifications_queue
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY notification_delivery_attempts_service_role ON notification_delivery_attempts
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY dead_letter_queue_service_role ON dead_letter_queue
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY processed_events_service_role ON processed_events
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY notification_templates_service_role ON notification_templates
  FOR ALL USING (auth.role() = 'service_role');

-- Notifications log: user can view their own; admin can view all; updates only for marking read
CREATE POLICY notifications_log_select ON notifications_log
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY notifications_log_update_read ON notifications_log
  FOR UPDATE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')) WITH CHECK (true);

-- =============================
-- SUPPORT FUNCTIONS
-- =============================

-- Helper: check if current time is inside quiet hours
CREATE OR REPLACE FUNCTION is_within_quiet_hours(prefs user_notification_preferences)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  now_time time without time zone := (now() AT TIME ZONE 'UTC')::time; -- Simplified; assumes UTC
BEGIN
  IF prefs.quiet_hours_start IS NULL OR prefs.quiet_hours_end IS NULL THEN
    RETURN false;
  END IF;
  -- Quiet hours may span midnight
  IF prefs.quiet_hours_start < prefs.quiet_hours_end THEN
    RETURN (now_time >= prefs.quiet_hours_start AND now_time < prefs.quiet_hours_end);
  ELSE
    RETURN (now_time >= prefs.quiet_hours_start OR now_time < prefs.quiet_hours_end);
  END IF;
END;
$$;

-- Enqueue notification with deduplication & quiet hour deferral
CREATE OR REPLACE FUNCTION enqueue_notification(
  p_event_type notification_event_type,
  p_user_id uuid,
  p_payload jsonb,
  p_dedup_key text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefs user_notification_preferences;
  v_channels notification_channel[] := ARRAY[]::notification_channel[];
  v_queue_id uuid;
  v_is_quiet boolean;
BEGIN
  -- Idempotency check via dedup_key
  IF p_dedup_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM notifications_log nl WHERE nl.dedup_key = p_dedup_key) THEN
      RETURN NULL; -- Already processed
    END IF;
    IF EXISTS (SELECT 1 FROM notifications_queue nq WHERE nq.dedup_key = p_dedup_key AND nq.status IN ('pending','processing','sending')) THEN
      RETURN NULL; -- Already enqueued
    END IF;
  END IF;

  SELECT * INTO v_prefs FROM user_notification_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    -- Create default preferences row if missing
    INSERT INTO user_notification_preferences(user_id) VALUES (p_user_id) RETURNING * INTO v_prefs;
  END IF;

  -- Determine channels from preferences
  IF v_prefs.email_opt_in THEN v_channels := array_append(v_channels, 'email'::notification_channel); END IF;
  IF v_prefs.sms_opt_in THEN v_channels := array_append(v_channels, 'sms'::notification_channel); END IF;
  IF v_prefs.push_opt_in THEN v_channels := array_append(v_channels, 'push'::notification_channel); END IF;

  IF array_length(v_channels,1) IS NULL THEN
    RETURN NULL; -- No channels opted in -> skip
  END IF;

  v_is_quiet := is_within_quiet_hours(v_prefs);

  INSERT INTO notifications_queue(event_type, user_id, channels, event_payload, dedup_key, next_attempt_at)
  VALUES (
    p_event_type, p_user_id, v_channels, p_payload, p_dedup_key,
    CASE WHEN v_is_quiet THEN (date_trunc('day', now()) + COALESCE(v_prefs.quiet_hours_end, time '07:00')) ELSE now() END
  ) RETURNING id INTO v_queue_id;

  RETURN v_queue_id;
END;
$$;

-- Select due notifications for processing (locking pattern simplified)
CREATE OR REPLACE FUNCTION process_due_notifications(p_batch_size int DEFAULT 50)
RETURNS SETOF notifications_queue LANGUAGE sql AS $$
  SELECT * FROM notifications_queue
  WHERE status = 'pending'
    AND next_attempt_at <= now()
  ORDER BY next_attempt_at ASC
  LIMIT p_batch_size;
$$;

-- Mark attempt & schedule retry or DLQ
CREATE OR REPLACE FUNCTION mark_notification_attempt(
  p_queue_id uuid,
  p_channel notification_channel,
  p_success boolean,
  p_provider_response jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_queue notifications_queue;
  v_next timestamptz;
BEGIN
  SELECT * INTO v_queue FROM notifications_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue item not found %', p_queue_id;
  END IF;

  INSERT INTO notification_delivery_attempts(queue_id, attempt_number, channel, success, provider_response, error_message)
  VALUES (p_queue_id, v_queue.retry_count + 1, p_channel, p_success, p_provider_response, p_error_message);

  IF p_success THEN
    -- If at least one channel succeeded, we keep status for finalization later; other channels may still process
    UPDATE notifications_queue SET updated_at = now() WHERE id = p_queue_id;
  ELSE
    -- Failure handling
    IF v_queue.retry_count + 1 >= v_queue.max_retries THEN
      -- Move to dead letter if all retries exhausted
      INSERT INTO dead_letter_queue(original_queue_id, event_type, payload, failure_reason, retries)
      VALUES (v_queue.id, v_queue.event_type, v_queue.event_payload, COALESCE(p_error_message,'max retries reached'), v_queue.retry_count + 1);
      UPDATE notifications_queue SET status = 'dead_letter', retry_count = v_queue.retry_count + 1, updated_at = now() WHERE id = v_queue.id;
    ELSE
      -- Exponential backoff: now + (2^retry_count) minutes
      v_next := now() + ((2 ^ (v_queue.retry_count)) || ' minutes')::interval;
      UPDATE notifications_queue SET retry_count = v_queue.retry_count + 1, next_attempt_at = v_next, updated_at = now() WHERE id = v_queue.id;
    END IF;
  END IF;
END;
$$;

-- Finalize notification delivery and log; marks queue item as sent
CREATE OR REPLACE FUNCTION finalize_notification(
  p_queue_id uuid,
  p_delivery_status text,
  p_log_payload jsonb,
  p_dedup_key text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_queue notifications_queue;
  v_log_id uuid;
BEGIN
  SELECT * INTO v_queue FROM notifications_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue item not found %', p_queue_id;
  END IF;

  -- Create log (inbox entry)
  INSERT INTO notifications_log(queue_id, user_id, event_type, channels, payload, delivery_status, dedup_key,
    email_sent, sms_sent, push_sent)
  VALUES (
    v_queue.id, v_queue.user_id, v_queue.event_type, v_queue.channels, p_log_payload, p_delivery_status, p_dedup_key,
    'email' = ANY(v_queue.channels), 'sms' = ANY(v_queue.channels), 'push' = ANY(v_queue.channels)
  ) RETURNING id INTO v_log_id;

  UPDATE notifications_queue SET status = 'sent', updated_at = now() WHERE id = v_queue.id;

  -- Mark processed for idempotency if dedup key present
  IF p_dedup_key IS NOT NULL THEN
    INSERT INTO processed_events(event_id) VALUES (p_dedup_key) ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_log_id;
END;
$$;

-- Fetch user notifications (inbox)
CREATE OR REPLACE FUNCTION get_user_notifications(
  p_user_id uuid,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
) RETURNS TABLE(
  id uuid,
  event_type notification_event_type,
  delivery_status text,
  unread boolean,
  delivered_at timestamptz,
  payload jsonb
) LANGUAGE sql AS $$
  SELECT nl.id, nl.event_type, nl.delivery_status, nl.unread, nl.delivered_at, nl.payload
  FROM notifications_log nl
  WHERE nl.user_id = p_user_id
  ORDER BY nl.delivered_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- Mark notifications read
CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_user_id uuid,
  p_notification_ids uuid[]
) RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE notifications_log
  SET unread = false
  WHERE user_id = p_user_id AND id = ANY(p_notification_ids) AND unread = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- =============================
-- INITIAL TEMPLATE SEED (OPTIONAL SAMPLE)
-- =============================
INSERT INTO notification_templates(event_type, channel, language_code, subject, body_html, body_text, push_title, push_body)
VALUES
  ('ORDER_STATUS_CHANGED','email','en','Your order status changed','<p>Your order status is now: {{status}}</p>','Your order status is now: {{status}}','Order Update','Status: {{status}}')
ON CONFLICT DO NOTHING;

-- =============================
-- END MIGRATION
-- =============================
