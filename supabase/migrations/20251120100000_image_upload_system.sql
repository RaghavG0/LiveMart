-- Image Upload and Optimization System
-- Date: 2025-11-20
-- Tracks uploaded images, optimization jobs, and enables lifecycle management

-- Image upload types
CREATE TYPE image_upload_type AS ENUM ('feedback_image', 'product_image', 'profile_avatar');

-- Image processing status
CREATE TYPE image_processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Main image uploads table
CREATE TABLE IF NOT EXISTS image_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  upload_type image_upload_type NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  
  -- Storage paths
  original_url text NOT NULL,
  thumbnail_url text,
  compressed_url text,
  webp_url text,
  
  -- Image dimensions
  width int,
  height int,
  
  -- Processing tracking
  processing_status image_processing_status DEFAULT 'pending' NOT NULL,
  optimized boolean DEFAULT false NOT NULL,
  optimization_attempted_at timestamptz,
  optimization_completed_at timestamptz,
  optimization_error text,
  
  -- Reference tracking (for cleanup)
  referenced_by_table text, -- e.g., 'reviews', 'products'
  referenced_by_id uuid,
  is_referenced boolean DEFAULT false NOT NULL,
  last_referenced_at timestamptz,
  
  -- Metadata
  metadata jsonb,
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Image optimization queue
CREATE TABLE IF NOT EXISTS image_optimization_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id uuid REFERENCES image_uploads(id) ON DELETE CASCADE NOT NULL,
  priority int DEFAULT 5 NOT NULL, -- 1=highest, 10=lowest
  retry_count int DEFAULT 0 NOT NULL,
  max_retries int DEFAULT 3 NOT NULL,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  next_attempt_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_image_uploads_uploader ON image_uploads(uploader_id);
CREATE INDEX IF NOT EXISTS idx_image_uploads_type ON image_uploads(upload_type);
CREATE INDEX IF NOT EXISTS idx_image_uploads_status ON image_uploads(processing_status);
CREATE INDEX IF NOT EXISTS idx_image_uploads_referenced ON image_uploads(is_referenced, created_at);
CREATE INDEX IF NOT EXISTS idx_image_uploads_unreferenced_old ON image_uploads(created_at) WHERE is_referenced = false;
CREATE INDEX IF NOT EXISTS idx_image_optimization_queue_next_attempt ON image_optimization_queue(next_attempt_at, priority);

-- RLS Policies
ALTER TABLE image_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_optimization_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own uploads; service role has full access
CREATE POLICY image_uploads_select ON image_uploads
  FOR SELECT USING (
    uploader_id = auth.uid() OR 
    auth.role() = 'service_role'
  );

CREATE POLICY image_uploads_insert ON image_uploads
  FOR INSERT WITH CHECK (
    uploader_id = auth.uid() OR 
    auth.role() = 'service_role'
  );

CREATE POLICY image_uploads_update ON image_uploads
  FOR UPDATE USING (
    uploader_id = auth.uid() OR 
    auth.role() = 'service_role'
  );

-- Optimization queue is service role only
CREATE POLICY image_optimization_queue_service ON image_optimization_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Function to enqueue image for optimization
CREATE OR REPLACE FUNCTION enqueue_image_optimization(p_image_id uuid, p_priority int DEFAULT 5)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_queue_id uuid;
BEGIN
  INSERT INTO image_optimization_queue(image_id, priority)
  VALUES (p_image_id, p_priority)
  RETURNING id INTO v_queue_id;
  
  UPDATE image_uploads 
  SET processing_status = 'pending'
  WHERE id = p_image_id;
  
  RETURN v_queue_id;
END;
$$;

-- Function to mark image as referenced
CREATE OR REPLACE FUNCTION mark_image_referenced(
  p_image_id uuid,
  p_table_name text,
  p_record_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE image_uploads
  SET 
    is_referenced = true,
    referenced_by_table = p_table_name,
    referenced_by_id = p_record_id,
    last_referenced_at = now(),
    updated_at = now()
  WHERE id = p_image_id;
END;
$$;

-- Function to get unreferenced images older than threshold
CREATE OR REPLACE FUNCTION get_unreferenced_images(p_days_old int DEFAULT 7)
RETURNS TABLE(
  id uuid,
  original_url text,
  thumbnail_url text,
  compressed_url text,
  webp_url text,
  created_at timestamptz
) LANGUAGE sql AS $$
  SELECT 
    id, 
    original_url, 
    thumbnail_url, 
    compressed_url, 
    webp_url, 
    created_at
  FROM image_uploads
  WHERE 
    is_referenced = false 
    AND created_at < (now() - (p_days_old || ' days')::interval)
  ORDER BY created_at ASC;
$$;

-- Function to delete image record and return URLs for storage deletion
CREATE OR REPLACE FUNCTION delete_image_upload(p_image_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_urls jsonb;
BEGIN
  SELECT jsonb_build_object(
    'original_url', original_url,
    'thumbnail_url', thumbnail_url,
    'compressed_url', compressed_url,
    'webp_url', webp_url
  ) INTO v_urls
  FROM image_uploads
  WHERE id = p_image_id;
  
  DELETE FROM image_uploads WHERE id = p_image_id;
  
  RETURN v_urls;
END;
$$;

-- Function to get pending optimization jobs
CREATE OR REPLACE FUNCTION get_pending_optimization_jobs(p_limit int DEFAULT 10)
RETURNS TABLE(
  queue_id uuid,
  image_id uuid,
  original_url text,
  mime_type text,
  width int,
  height int,
  retry_count int
) LANGUAGE sql AS $$
  SELECT 
    q.id as queue_id,
    i.id as image_id,
    i.original_url,
    i.mime_type,
    i.width,
    i.height,
    q.retry_count
  FROM image_optimization_queue q
  JOIN image_uploads i ON q.image_id = i.id
  WHERE q.next_attempt_at <= now()
  ORDER BY q.priority ASC, q.created_at ASC
  LIMIT p_limit;
$$;

-- Function to mark optimization job result
CREATE OR REPLACE FUNCTION mark_optimization_result(
  p_queue_id uuid,
  p_success boolean,
  p_thumbnail_url text DEFAULT NULL,
  p_compressed_url text DEFAULT NULL,
  p_webp_url text DEFAULT NULL,
  p_error_message text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_queue_record image_optimization_queue;
  v_image_id uuid;
BEGIN
  SELECT * INTO v_queue_record FROM image_optimization_queue WHERE id = p_queue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue item not found: %', p_queue_id;
  END IF;
  
  v_image_id := v_queue_record.image_id;
  
  IF p_success THEN
    UPDATE image_uploads
    SET 
      thumbnail_url = COALESCE(p_thumbnail_url, thumbnail_url),
      compressed_url = COALESCE(p_compressed_url, compressed_url),
      webp_url = COALESCE(p_webp_url, webp_url),
      processing_status = 'completed',
      optimized = true,
      optimization_completed_at = now(),
      updated_at = now()
    WHERE id = v_image_id;
    
    DELETE FROM image_optimization_queue WHERE id = p_queue_id;
  ELSE
    IF v_queue_record.retry_count + 1 >= v_queue_record.max_retries THEN
      UPDATE image_uploads
      SET 
        processing_status = 'failed',
        optimization_attempted_at = now(),
        optimization_error = p_error_message,
        updated_at = now()
      WHERE id = v_image_id;
      
      DELETE FROM image_optimization_queue WHERE id = p_queue_id;
    ELSE
      UPDATE image_optimization_queue
      SET 
        retry_count = retry_count + 1,
        error_message = p_error_message,
        next_attempt_at = now() + ((2 ^ retry_count) || ' minutes')::interval
      WHERE id = p_queue_id;
      
      UPDATE image_uploads
      SET 
        processing_status = 'pending',
        optimization_attempted_at = now(),
        updated_at = now()
      WHERE id = v_image_id;
    END IF;
  END IF;
END;
$$;

-- Trigger to auto-enqueue new images for optimization
CREATE OR REPLACE FUNCTION trigger_enqueue_optimization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO image_optimization_queue(image_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_image_uploads_enqueue ON image_uploads;
CREATE TRIGGER trg_image_uploads_enqueue
  AFTER INSERT ON image_uploads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_enqueue_optimization();

-- Add configuration table for image upload settings
CREATE TABLE IF NOT EXISTS image_upload_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Insert default configurations
INSERT INTO image_upload_config(key, value) VALUES
  ('max_file_size_mb', '5'::jsonb),
  ('max_images_per_review', '3'::jsonb),
  ('allowed_mime_types', '["image/jpeg", "image/png", "image/webp", "image/heic"]'::jsonb),
  ('thumbnail_dimensions', '{"width": 200, "height": 200}'::jsonb),
  ('compressed_quality', '80'::jsonb),
  ('cleanup_days_threshold', '7'::jsonb),
  ('signed_url_expiry_minutes', '15'::jsonb)
ON CONFLICT (key) DO NOTHING;
