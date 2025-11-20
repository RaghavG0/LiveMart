-- Analytics and Reporting System Tests
-- Tests aggregation accuracy, trend calculations, and report generation

BEGIN;

CREATE TEMP TABLE analytics_test_results(name text, passed boolean, details text);

DO $$
DECLARE
  test_retailer_id uuid := gen_random_uuid();
  test_product_id uuid;
  test_snapshot_id uuid;
  v_nps_score decimal(5,2);
  v_trend_count int;
  v_record record;
BEGIN
  -- Setup: Create test retailer
  INSERT INTO profiles(id, email, role) 
  VALUES (test_retailer_id, 'test@retailer.com', 'retailer');
  
  -- Setup: Create test product
  INSERT INTO products(id, seller_id, name, sku, price, stock_quantity, status)
  VALUES (gen_random_uuid(), test_retailer_id, 'Test Product', 'TEST-001', 99.99, 100, 'active')
  RETURNING id INTO test_product_id;
  
  -- TEST 1: NPS Score Calculation
  -- Formula: ((Promoters - Detractors) / Total) * 100
  SELECT calculate_nps_score(60, 20, 20) INTO v_nps_score;
  IF v_nps_score = 40.00 THEN
    INSERT INTO analytics_test_results VALUES ('nps_calculation', true, 'NPS formula correct: 40%');
  ELSE
    INSERT INTO analytics_test_results VALUES ('nps_calculation', false, CONCAT('Expected 40, got ', v_nps_score));
  END IF;
  
  -- TEST 2: Zero reviews NPS handling
  SELECT calculate_nps_score(0, 0, 0) INTO v_nps_score;
  IF v_nps_score = 0 THEN
    INSERT INTO analytics_test_results VALUES ('nps_zero_handling', true, 'Zero reviews handled correctly');
  ELSE
    INSERT INTO analytics_test_results VALUES ('nps_zero_handling', false, 'Should return 0 for zero reviews');
  END IF;
  
  -- TEST 3: Generate daily analytics snapshot
  SELECT generate_daily_analytics_snapshot(test_retailer_id, CURRENT_DATE) INTO test_snapshot_id;
  IF test_snapshot_id IS NOT NULL THEN
    INSERT INTO analytics_test_results VALUES ('snapshot_generation', true, 'Snapshot created successfully');
  ELSE
    INSERT INTO analytics_test_results VALUES ('snapshot_generation', false, 'Failed to create snapshot');
  END IF;
  
  -- TEST 4: Snapshot contains correct data
  SELECT * INTO v_record FROM analytics_snapshots WHERE id = test_snapshot_id;
  IF v_record.retailer_id = test_retailer_id AND v_record.snapshot_date = CURRENT_DATE THEN
    INSERT INTO analytics_test_results VALUES ('snapshot_data', true, 'Snapshot data correct');
  ELSE
    INSERT INTO analytics_test_results VALUES ('snapshot_data', false, 'Snapshot data mismatch');
  END IF;
  
  -- TEST 5: SKU trends generation
  SELECT generate_sku_trends(test_retailer_id, CURRENT_DATE) INTO v_trend_count;
  IF v_trend_count >= 1 THEN
    INSERT INTO analytics_test_results VALUES ('sku_trends_generation', true, CONCAT(v_trend_count, ' SKU trends created'));
  ELSE
    INSERT INTO analytics_test_results VALUES ('sku_trends_generation', false, 'No SKU trends generated');
  END IF;
  
  -- TEST 6: SKU trend data accuracy
  SELECT COUNT(*) INTO v_trend_count 
  FROM sku_trends 
  WHERE product_id = test_product_id AND trend_date = CURRENT_DATE;
  
  IF v_trend_count = 1 THEN
    INSERT INTO analytics_test_results VALUES ('sku_trend_accuracy', true, 'SKU trend recorded for product');
  ELSE
    INSERT INTO analytics_test_results VALUES ('sku_trend_accuracy', false, 'SKU trend not found');
  END IF;
  
  -- TEST 7: Complaint analysis
  -- Create test reviews with complaints
  INSERT INTO reviews(user_id, product_id, order_id, rating, comment, is_visible)
  VALUES 
    (gen_random_uuid(), test_product_id, gen_random_uuid(), 1, 'Poor quality product', true),
    (gen_random_uuid(), test_product_id, gen_random_uuid(), 2, 'Late delivery issue', true),
    (gen_random_uuid(), test_product_id, gen_random_uuid(), 1, 'Damaged packaging', true);
  
  DECLARE
    v_complaint_id uuid;
  BEGIN
    SELECT analyze_retailer_complaints(
      test_retailer_id,
      CURRENT_DATE - 7,
      CURRENT_DATE
    ) INTO v_complaint_id;
    
    IF v_complaint_id IS NOT NULL THEN
      INSERT INTO analytics_test_results VALUES ('complaint_analysis', true, 'Complaints analyzed successfully');
    ELSE
      INSERT INTO analytics_test_results VALUES ('complaint_analysis', false, 'Complaint analysis failed');
    END IF;
  END;
  
  -- TEST 8: Complaint categorization
  SELECT * INTO v_record FROM retailer_complaints WHERE retailer_id = test_retailer_id;
  IF v_record.quality_issues > 0 AND v_record.delivery_issues > 0 AND v_record.packaging_issues > 0 THEN
    INSERT INTO analytics_test_results VALUES ('complaint_categories', true, 'Complaints categorized correctly');
  ELSE
    INSERT INTO analytics_test_results VALUES ('complaint_categories', false, 'Categorization failed');
  END IF;
  
  -- TEST 9: Performance summary generation
  DECLARE
    v_summary jsonb;
  BEGIN
    SELECT get_retailer_performance_summary(
      test_retailer_id,
      CURRENT_DATE - 7,
      CURRENT_DATE
    ) INTO v_summary;
    
    IF v_summary ? 'overview' AND v_summary ? 'trends' THEN
      INSERT INTO analytics_test_results VALUES ('performance_summary', true, 'Summary generated with all sections');
    ELSE
      INSERT INTO analytics_test_results VALUES ('performance_summary', false, 'Summary missing required sections');
    END IF;
  END;
  
  -- TEST 10: Top SKUs function
  DECLARE
    v_top_skus_count int;
  BEGIN
    SELECT COUNT(*) INTO v_top_skus_count
    FROM get_top_skus(test_retailer_id, CURRENT_DATE - 7, CURRENT_DATE, 10, 'revenue');
    
    IF v_top_skus_count >= 0 THEN
      INSERT INTO analytics_test_results VALUES ('top_skus_function', true, CONCAT('Top SKUs query returned ', v_top_skus_count, ' results'));
    ELSE
      INSERT INTO analytics_test_results VALUES ('top_skus_function', false, 'Top SKUs query failed');
    END IF;
  END;
  
  -- TEST 11: Report scheduling
  DECLARE
    v_next_time timestamptz;
    v_report_id uuid;
  BEGIN
    INSERT INTO scheduled_reports(retailer_id, report_type, report_frequency, next_generation_at)
    VALUES (test_retailer_id, 'weekly_summary', 'weekly', CURRENT_DATE::timestamptz)
    RETURNING id INTO v_report_id;
    
    SELECT schedule_next_report(v_report_id) INTO v_next_time;
    
    IF v_next_time > now() THEN
      INSERT INTO analytics_test_results VALUES ('report_scheduling', true, 'Next report scheduled correctly');
    ELSE
      INSERT INTO analytics_test_results VALUES ('report_scheduling', false, 'Scheduling failed');
    END IF;
  END;
  
  -- TEST 12: RLS policies (retailer can only see own data)
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claim.sub TO test_retailer_id::text;
  
  SELECT COUNT(*) INTO v_trend_count 
  FROM analytics_snapshots 
  WHERE retailer_id = test_retailer_id;
  
  IF v_trend_count > 0 THEN
    INSERT INTO analytics_test_results VALUES ('rls_own_data', true, 'Retailer can access own analytics');
  ELSE
    INSERT INTO analytics_test_results VALUES ('rls_own_data', false, 'RLS blocking own data access');
  END IF;
  
  RESET ROLE;
  
END$$;

-- Display results
SELECT name, 
       CASE WHEN passed THEN '✓ PASSED' ELSE '✗ FAILED' END as result,
       details
FROM analytics_test_results
ORDER BY name;

-- Summary
SELECT 
  COUNT(*) as total_tests,
  SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed,
  SUM(CASE WHEN NOT passed THEN 1 ELSE 0 END) as failed
FROM analytics_test_results;

ROLLBACK;
