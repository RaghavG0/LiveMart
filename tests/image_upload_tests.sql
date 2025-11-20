-- Image Upload System Tests
-- Tests validation, optimization workflow, cleanup logic, and reference tracking

BEGIN;

CREATE TEMP TABLE test_results(name text, passed boolean, details text);

DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  test_image_id uuid;
  test_queue_id uuid;
  v_count int;
  v_record record;
BEGIN
  -- TEST 1: Image upload insertion and auto-enqueue
  INSERT INTO image_uploads(
    id, uploader_id, upload_type, original_filename, mime_type, 
    file_size_bytes, original_url
  ) VALUES (
    gen_random_uuid(), test_user_id, 'feedback_image', 'test.jpg', 
    'image/jpeg', 1024000, 'https://example.com/test.jpg'
  ) RETURNING id INTO test_image_id;
  
  -- Check if optimization queue entry was created
  SELECT COUNT(*) INTO v_count FROM image_optimization_queue WHERE image_id = test_image_id;
  IF v_count = 1 THEN
    INSERT INTO test_results VALUES ('auto_enqueue_on_insert', true, 'Optimization queued automatically');
  ELSE
    INSERT INTO test_results VALUES ('auto_enqueue_on_insert', false, 'Queue entry not created');
  END IF;

  -- TEST 2: Configuration retrieval
  SELECT COUNT(*) INTO v_count FROM image_upload_config WHERE key IN ('max_file_size_mb', 'allowed_mime_types');
  IF v_count >= 2 THEN
    INSERT INTO test_results VALUES ('config_exists', true, 'Configuration present');
  ELSE
    INSERT INTO test_results VALUES ('config_exists', false, 'Missing config entries');
  END IF;

  -- TEST 3: Mark image as referenced
  PERFORM mark_image_referenced(test_image_id, 'reviews', gen_random_uuid());
  SELECT is_referenced INTO v_count FROM image_uploads WHERE id = test_image_id;
  IF v_count THEN
    INSERT INTO test_results VALUES ('mark_referenced', true, 'Image marked as referenced');
  ELSE
    INSERT INTO test_results VALUES ('mark_referenced', false, 'Failed to mark referenced');
  END IF;

  -- TEST 4: Optimization result handling (success)
  SELECT id INTO test_queue_id FROM image_optimization_queue WHERE image_id = test_image_id;
  PERFORM mark_optimization_result(
    test_queue_id, 
    true, 
    'https://example.com/thumb.jpg',
    'https://example.com/compressed.jpg',
    'https://example.com/test.webp'
  );
  
  SELECT processing_status, optimized, thumbnail_url 
  INTO v_record 
  FROM image_uploads WHERE id = test_image_id;
  
  IF v_record.processing_status = 'completed' AND v_record.optimized AND v_record.thumbnail_url IS NOT NULL THEN
    INSERT INTO test_results VALUES ('optimization_success', true, 'Optimization marked successful');
  ELSE
    INSERT INTO test_results VALUES ('optimization_success', false, 'Optimization state incorrect');
  END IF;

  -- TEST 5: Queue deletion after success
  SELECT COUNT(*) INTO v_count FROM image_optimization_queue WHERE id = test_queue_id;
  IF v_count = 0 THEN
    INSERT INTO test_results VALUES ('queue_cleanup', true, 'Queue entry removed after success');
  ELSE
    INSERT INTO test_results VALUES ('queue_cleanup', false, 'Queue entry not removed');
  END IF;

  -- TEST 6: Unreferenced images query
  -- Create an old unreferenced image
  INSERT INTO image_uploads(
    uploader_id, upload_type, original_filename, mime_type, 
    file_size_bytes, original_url, is_referenced, created_at
  ) VALUES (
    test_user_id, 'feedback_image', 'old.jpg', 'image/jpeg',
    500000, 'https://example.com/old.jpg', false, now() - interval '10 days'
  );
  
  SELECT COUNT(*) INTO v_count FROM get_unreferenced_images(7);
  IF v_count >= 1 THEN
    INSERT INTO test_results VALUES ('unreferenced_query', true, CONCAT('Found ', v_count, ' unreferenced images'));
  ELSE
    INSERT INTO test_results VALUES ('unreferenced_query', false, 'Failed to find old unreferenced images');
  END IF;

  -- TEST 7: Optimization retry logic
  INSERT INTO image_uploads(
    id, uploader_id, upload_type, original_filename, mime_type,
    file_size_bytes, original_url
  ) VALUES (
    gen_random_uuid(), test_user_id, 'feedback_image', 'retry.jpg',
    'image/png', 800000, 'https://example.com/retry.jpg'
  ) RETURNING id INTO test_image_id;
  
  SELECT id INTO test_queue_id FROM image_optimization_queue WHERE image_id = test_image_id;
  
  -- Simulate failure (should retry)
  PERFORM mark_optimization_result(test_queue_id, false, NULL, NULL, NULL, 'Test error');
  
  SELECT retry_count INTO v_count FROM image_optimization_queue WHERE image_id = test_image_id;
  IF v_count = 1 THEN
    INSERT INTO test_results VALUES ('optimization_retry', true, 'Retry count incremented');
  ELSE
    INSERT INTO test_results VALUES ('optimization_retry', false, 'Retry logic failed');
  END IF;

  -- TEST 8: Max retries handling
  UPDATE image_optimization_queue SET retry_count = 2, max_retries = 3 WHERE image_id = test_image_id;
  SELECT id INTO test_queue_id FROM image_optimization_queue WHERE image_id = test_image_id;
  
  PERFORM mark_optimization_result(test_queue_id, false, NULL, NULL, NULL, 'Final failure');
  
  SELECT processing_status, COUNT(*) OVER() as queue_count
  INTO v_record
  FROM image_uploads 
  LEFT JOIN image_optimization_queue ON image_optimization_queue.image_id = image_uploads.id
  WHERE image_uploads.id = test_image_id;
  
  IF v_record.processing_status = 'failed' THEN
    INSERT INTO test_results VALUES ('max_retries_handling', true, 'Failed status set after max retries');
  ELSE
    INSERT INTO test_results VALUES ('max_retries_handling', false, 'Max retry handling incorrect');
  END IF;

  -- TEST 9: Delete image function returns URLs
  INSERT INTO image_uploads(
    id, uploader_id, upload_type, original_filename, mime_type,
    file_size_bytes, original_url, thumbnail_url, webp_url
  ) VALUES (
    gen_random_uuid(), test_user_id, 'feedback_image', 'delete.jpg',
    'image/jpeg', 600000, 'https://example.com/orig.jpg',
    'https://example.com/thumb.jpg', 'https://example.com/test.webp'
  ) RETURNING id INTO test_image_id;
  
  SELECT delete_image_upload(test_image_id) INTO v_record;
  
  IF v_record::jsonb ? 'original_url' AND v_record::jsonb ? 'thumbnail_url' THEN
    INSERT INTO test_results VALUES ('delete_returns_urls', true, 'Deletion returns all URLs for cleanup');
  ELSE
    INSERT INTO test_results VALUES ('delete_returns_urls', false, 'URLs not returned on deletion');
  END IF;

END$$;

-- Display results
SELECT name, 
       CASE WHEN passed THEN '✓ PASSED' ELSE '✗ FAILED' END as result,
       details
FROM test_results
ORDER BY name;

-- Summary
SELECT 
  COUNT(*) as total_tests,
  SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed,
  SUM(CASE WHEN NOT passed THEN 1 ELSE 0 END) as failed
FROM test_results;

ROLLBACK;
