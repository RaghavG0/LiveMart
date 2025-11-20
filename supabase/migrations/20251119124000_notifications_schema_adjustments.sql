-- Notifications Schema Adjustments
-- Date: 2025-11-19
-- Adds channel-specific tracking and last attempt timestamp.

ALTER TABLE notifications_queue
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS channel_status jsonb; -- {"email": {"attempts":1,"last_attempt_at":"...","success":false}, ... }

-- Update function mark_notification_attempt to record last_attempt_at and channel_status
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
  v_status jsonb;
  v_channel_key text := p_channel::text;
  v_channel_entry jsonb;
BEGIN
  SELECT * INTO v_queue FROM notifications_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue item not found %', p_queue_id;
  END IF;

  INSERT INTO notification_delivery_attempts(queue_id, attempt_number, channel, success, provider_response, error_message)
  VALUES (p_queue_id, v_queue.retry_count + 1, p_channel, p_success, p_provider_response, p_error_message);

  v_status := COALESCE(v_queue.channel_status, '{}'::jsonb);
  v_channel_entry := COALESCE(v_status -> v_channel_key, '{}'::jsonb);
  v_channel_entry := jsonb_set(v_channel_entry, '{attempts}', to_jsonb( (COALESCE( (v_channel_entry->>'attempts')::int, 0) + 1) ) , true);
  v_channel_entry := jsonb_set(v_channel_entry, '{last_attempt_at}', to_jsonb(now()), true);
  v_channel_entry := jsonb_set(v_channel_entry, '{success}', to_jsonb(p_success), true);
  IF p_error_message IS NOT NULL THEN
    v_channel_entry := jsonb_set(v_channel_entry, '{last_error}', to_jsonb(p_error_message), true);
  END IF;
  v_status := jsonb_set(v_status, ARRAY[v_channel_key], v_channel_entry, true);

  IF p_success THEN
    UPDATE notifications_queue
      SET updated_at = now(), last_attempt_at = now(), channel_status = v_status
      WHERE id = p_queue_id;
  ELSE
    IF v_queue.retry_count + 1 >= v_queue.max_retries THEN
      INSERT INTO dead_letter_queue(original_queue_id, event_type, payload, failure_reason, retries)
      VALUES (v_queue.id, v_queue.event_type, v_queue.event_payload, COALESCE(p_error_message,'max retries reached'), v_queue.retry_count + 1);
      UPDATE notifications_queue SET status = 'dead_letter', retry_count = v_queue.retry_count + 1, updated_at = now(), last_attempt_at = now(), channel_status = v_status WHERE id = v_queue.id;
    ELSE
      v_next := now() + ((2 ^ (v_queue.retry_count)) || ' minutes')::interval;
      UPDATE notifications_queue SET retry_count = v_queue.retry_count + 1, next_attempt_at = v_next, updated_at = now(), last_attempt_at = now(), channel_status = v_status WHERE id = v_queue.id;
    END IF;
  END IF;
END;
$$;

-- Update finalize_notification to stamp channel_status success states if missing.
CREATE OR REPLACE FUNCTION finalize_notification(
  p_queue_id uuid,
  p_delivery_status text,
  p_log_payload jsonb,
  p_dedup_key text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_queue notifications_queue;
  v_log_id uuid;
  v_status jsonb;
  v_channel text;
  v_entry jsonb;
BEGIN
  SELECT * INTO v_queue FROM notifications_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue item not found %', p_queue_id;
  END IF;

  v_status := COALESCE(v_queue.channel_status, '{}'::jsonb);
  FOREACH v_channel IN ARRAY v_queue.channels LOOP
    IF (v_status -> v_channel) IS NULL THEN
      v_entry := jsonb_build_object('attempts', 0, 'last_attempt_at', to_jsonb(now()), 'success', p_delivery_status = 'success');
      v_status := jsonb_set(v_status, ARRAY[v_channel], v_entry, true);
    END IF;
  END LOOP;

  INSERT INTO notifications_log(queue_id, user_id, event_type, channels, payload, delivery_status, dedup_key,
    email_sent, sms_sent, push_sent)
  VALUES (
    v_queue.id, v_queue.user_id, v_queue.event_type, v_queue.channels, p_log_payload, p_delivery_status, p_dedup_key,
    'email' = ANY(v_queue.channels), 'sms' = ANY(v_queue.channels), 'push' = ANY(v_queue.channels)
  ) RETURNING id INTO v_log_id;

  UPDATE notifications_queue SET status = 'sent', updated_at = now(), channel_status = v_status WHERE id = v_queue.id;

  IF p_dedup_key IS NOT NULL THEN
    INSERT INTO processed_events(event_id) VALUES (p_dedup_key) ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_log_id;
END;
$$;

-- Index on last_attempt_at to analyze retry cadence
CREATE INDEX IF NOT EXISTS idx_notifications_queue_last_attempt ON notifications_queue(last_attempt_at);
