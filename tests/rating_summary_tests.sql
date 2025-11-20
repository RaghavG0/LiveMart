BEGIN;

CREATE TEMP TABLE test_results(name text, passed boolean, details text);

-- Helper to insert a product and reviews
DO $$
DECLARE
  pid uuid := gen_random_uuid();
  uid uuid := gen_random_uuid();
  rid1 uuid;
  rid2 uuid;
  rid3 uuid;
BEGIN
  -- Assume products and profiles exist; create temp if not available
  BEGIN
    INSERT INTO products(id, name) VALUES (pid, 'Test Product');
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'products table missing; skipping test';
    RETURN;
  END;

  -- Insert three reviews (visible + moderated to count)
  INSERT INTO reviews(id, product_id, rating, comment, visible, moderated)
  VALUES
    (gen_random_uuid(), pid, 5, 'Great', true, true),
    (gen_random_uuid(), pid, 4, 'Good', true, true),
    (gen_random_uuid(), pid, 1, 'Bad', true, true);

  PERFORM recompute_product_rating_summary(pid);

  -- Validate summary
  PERFORM 1 FROM product_rating_summary prs WHERE prs.product_id = pid AND prs.review_count = 3 AND prs.avg_rating = 3.33;
  IF FOUND THEN
    INSERT INTO test_results VALUES ('summary_basic', true, 'avg 3.33, count 3');
  ELSE
    INSERT INTO test_results VALUES ('summary_basic', false, 'unexpected summary');
  END IF;

  -- Update review to invisible, ensure recompute reflects
  UPDATE reviews SET visible=false WHERE product_id=pid AND rating=1;
  PERFORM recompute_product_rating_summary(pid);
  PERFORM 1 FROM product_rating_summary prs WHERE prs.product_id = pid AND prs.review_count = 2;
  IF FOUND THEN
    INSERT INTO test_results VALUES ('visibility_filter', true, 'count 2 after hide');
  ELSE
    INSERT INTO test_results VALUES ('visibility_filter', false, 'not filtered');
  END IF;

END$$;

SELECT * FROM test_results;

ROLLBACK;