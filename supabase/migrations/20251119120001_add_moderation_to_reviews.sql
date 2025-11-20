-- Add moderation fields to reviews table

ALTER TABLE reviews 
ADD COLUMN IF NOT EXISTS moderated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS moderator_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT TRUE;

-- Index for moderated reviews
CREATE INDEX IF NOT EXISTS idx_reviews_moderated ON reviews(moderated);
CREATE INDEX IF NOT EXISTS idx_reviews_visible ON reviews(visible);
CREATE INDEX IF NOT EXISTS idx_reviews_moderator ON reviews(moderator_id) WHERE moderator_id IS NOT NULL;

COMMENT ON COLUMN reviews.moderated IS 'Whether the review has been moderated';
COMMENT ON COLUMN reviews.moderated_at IS 'Timestamp when review was moderated';
COMMENT ON COLUMN reviews.moderator_id IS 'Admin who moderated this review';
COMMENT ON COLUMN reviews.visible IS 'Whether the review is visible publicly (false if rejected)';
