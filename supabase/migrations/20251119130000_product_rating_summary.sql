-- Product Rating Summary & Search Index Queue
-- Date: 2025-11-19

-- Summary table per product
CREATE TABLE IF NOT EXISTS product_rating_summary (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  review_count int NOT NULL DEFAULT 0,
  avg_rating numeric(3,2) NOT NULL DEFAULT 0,
  pct_1star numeric(5,2) NOT NULL DEFAULT 0,
  pct_2star numeric(5,2) NOT NULL DEFAULT 0,
  pct_3star numeric(5,2) NOT NULL DEFAULT 0,
  pct_4star numeric(5,2) NOT NULL DEFAULT 0,
  pct_5star numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Search indexing queue; worker will consume
CREATE TYPE search_op AS ENUM ('upsert', 'delete');
CREATE TABLE IF NOT EXISTS search_index_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  op search_op NOT NULL,
  product_id uuid NOT NULL,
  review_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_index_queue_created ON search_index_queue(created_at);

-- Helper to recompute summary for a product efficiently
CREATE OR REPLACE FUNCTION recompute_product_rating_summary(p_product_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_total int;
  v_avg numeric(10,2);
  c1 int; c2 int; c3 int; c4 int; c5 int;
BEGIN
  -- Consider only approved & visible reviews
  SELECT COUNT(*), COALESCE(AVG(rating),0)
    INTO v_total, v_avg
  FROM reviews
  WHERE product_id = p_product_id AND visible = true AND moderated = true;

  SELECT
    SUM(CASE WHEN rating=1 THEN 1 ELSE 0 END),
    SUM(CASE WHEN rating=2 THEN 1 ELSE 0 END),
    SUM(CASE WHEN rating=3 THEN 1 ELSE 0 END),
    SUM(CASE WHEN rating=4 THEN 1 ELSE 0 END),
    SUM(CASE WHEN rating=5 THEN 1 ELSE 0 END)
  INTO c1,c2,c3,c4,c5
  FROM reviews
  WHERE product_id = p_product_id AND visible = true AND moderated = true;

  IF v_total = 0 THEN
    INSERT INTO product_rating_summary(product_id, review_count, avg_rating, pct_1star, pct_2star, pct_3star, pct_4star, pct_5star, updated_at)
    VALUES (p_product_id, 0, 0, 0,0,0,0,0, now())
    ON CONFLICT (product_id) DO UPDATE SET review_count=0, avg_rating=0, pct_1star=0, pct_2star=0, pct_3star=0, pct_4star=0, pct_5star=0, updated_at=now();
  ELSE
    INSERT INTO product_rating_summary(product_id, review_count, avg_rating, pct_1star, pct_2star, pct_3star, pct_4star, pct_5star, updated_at)
    VALUES (
      p_product_id,
      v_total,
      ROUND(v_avg::numeric,2),
      ROUND((c1::numeric / v_total * 100)::numeric,2),
      ROUND((c2::numeric / v_total * 100)::numeric,2),
      ROUND((c3::numeric / v_total * 100)::numeric,2),
      ROUND((c4::numeric / v_total * 100)::numeric,2),
      ROUND((c5::numeric / v_total * 100)::numeric,2),
      now()
    )
    ON CONFLICT (product_id) DO UPDATE SET
      review_count=EXCLUDED.review_count,
      avg_rating=EXCLUDED.avg_rating,
      pct_1star=EXCLUDED.pct_1star,
      pct_2star=EXCLUDED.pct_2star,
      pct_3star=EXCLUDED.pct_3star,
      pct_4star=EXCLUDED.pct_4star,
      pct_5star=EXCLUDED.pct_5star,
      updated_at=now();
  END IF;
END;
$$;

-- Trigger function to enqueue search index updates for approved/visible reviews
CREATE OR REPLACE FUNCTION enqueue_search_index_for_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_op search_op;
  v_row reviews;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_row := NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_row := NEW;
  ELSE
    v_row := OLD;
  END IF;

  -- Only index approved + visible reviews; remove otherwise
  IF (v_row.visible = true AND v_row.moderated = true) THEN
    v_op := 'upsert';
    INSERT INTO search_index_queue(op, product_id, review_id, payload)
    VALUES ('upsert', v_row.product_id, v_row.id, jsonb_build_object(
      'productId', v_row.product_id,
      'reviewId', v_row.id,
      'text', v_row.comment,
      'rating', v_row.rating,
      'hasImages', (v_row.media_urls IS NOT NULL AND jsonb_array_length(v_row.media_urls) > 0),
      'createdAt', v_row.created_at
    ));
  ELSE
    v_op := 'delete';
    INSERT INTO search_index_queue(op, product_id, review_id) VALUES ('delete', v_row.product_id, v_row.id);
  END IF;

  -- Recompute summary atomically
  PERFORM recompute_product_rating_summary(v_row.product_id);
  RETURN v_row;
END;
$$;

-- Attach triggers on reviews for create/update/delete
DROP TRIGGER IF EXISTS trg_reviews_rating_index_ins ON reviews;
CREATE TRIGGER trg_reviews_rating_index_ins AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION enqueue_search_index_for_review();

DROP TRIGGER IF EXISTS trg_reviews_rating_index_upd ON reviews;
CREATE TRIGGER trg_reviews_rating_index_upd AFTER UPDATE OF rating, comment, visible, moderated ON reviews
FOR EACH ROW EXECUTE FUNCTION enqueue_search_index_for_review();

DROP TRIGGER IF EXISTS trg_reviews_rating_index_del ON reviews;
CREATE TRIGGER trg_reviews_rating_index_del AFTER DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION enqueue_search_index_for_review();

-- Policies (service role processes queue; summary is public read)
ALTER TABLE product_rating_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_index_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_rating_summary_read ON product_rating_summary FOR SELECT USING (true);
CREATE POLICY search_index_queue_service ON search_index_queue FOR ALL USING (auth.role() = 'service_role');
