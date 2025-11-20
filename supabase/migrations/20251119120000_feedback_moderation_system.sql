-- =====================================================
-- Feedback Moderation System Migration
-- =====================================================
-- This migration creates a comprehensive moderation system for reviews/feedback
-- Features: Moderation queue, actions, audit logs, auto-moderation flags

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected', 'flagged', 'escalated');
CREATE TYPE moderation_action_type AS ENUM ('approve', 'reject', 'edit', 'escalate', 'flag', 'unflag');
CREATE TYPE auto_flag_reason AS ENUM ('profanity', 'spam', 'duplicate', 'low_quality', 'suspicious_pattern');
CREATE TYPE escalation_type AS ENUM ('legal', 'operations', 'compliance', 'high_priority');

-- =====================================================
-- TABLE: moderation_queue
-- =====================================================
-- Central queue for all feedback items requiring moderation

CREATE TABLE moderation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Moderation status
    status moderation_status NOT NULL DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 0, -- Higher = more urgent
    
    -- Content snapshot (for audit trail)
    original_rating INTEGER NOT NULL,
    original_comment TEXT NOT NULL,
    current_rating INTEGER NOT NULL,
    current_comment TEXT NOT NULL,
    
    -- Moderation metadata
    flagged_by UUID REFERENCES profiles(id),
    flagged_reason TEXT,
    assigned_to UUID REFERENCES profiles(id), -- Moderator assigned
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    last_action_at TIMESTAMPTZ,
    
    CONSTRAINT moderation_queue_rating_check CHECK (original_rating >= 1 AND original_rating <= 5),
    CONSTRAINT moderation_queue_current_rating_check CHECK (current_rating >= 1 AND current_rating <= 5)
);

-- =====================================================
-- TABLE: moderation_actions
-- =====================================================
-- Records all moderation actions taken on feedback

CREATE TABLE moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_item_id UUID NOT NULL REFERENCES moderation_queue(id) ON DELETE CASCADE,
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    
    -- Action details
    action_type moderation_action_type NOT NULL,
    moderator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Content changes (for edit actions)
    previous_rating INTEGER,
    new_rating INTEGER,
    previous_comment TEXT,
    new_comment TEXT,
    
    -- Action metadata
    reason TEXT,
    notes TEXT,
    escalation_type escalation_type,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT moderation_actions_rating_check CHECK (
        (previous_rating IS NULL OR (previous_rating >= 1 AND previous_rating <= 5)) AND
        (new_rating IS NULL OR (new_rating >= 1 AND new_rating <= 5))
    )
);

-- =====================================================
-- TABLE: moderation_audit_log
-- =====================================================
-- Immutable audit trail for all moderation activities

CREATE TABLE moderation_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference data
    queue_item_id UUID REFERENCES moderation_queue(id) ON DELETE SET NULL,
    action_id UUID REFERENCES moderation_actions(id) ON DELETE SET NULL,
    review_id UUID NOT NULL,
    
    -- Actor information
    actor_id UUID NOT NULL REFERENCES profiles(id),
    actor_role TEXT NOT NULL,
    actor_ip_address INET,
    
    -- Action details
    action_type moderation_action_type NOT NULL,
    action_summary TEXT NOT NULL,
    
    -- State before and after (JSONB for flexibility)
    state_before JSONB,
    state_after JSONB,
    
    -- Metadata
    reason TEXT,
    notes TEXT,
    
    -- Timestamp (immutable)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLE: auto_moderation_flags
-- =====================================================
-- Automatic flags raised by moderation workers/systems

CREATE TABLE auto_moderation_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    queue_item_id UUID REFERENCES moderation_queue(id) ON DELETE SET NULL,
    
    -- Flag details
    flag_type auto_flag_reason NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Detection metadata
    detected_content TEXT, -- The specific content that triggered the flag
    detection_metadata JSONB, -- Additional context (e.g., matched words, patterns)
    
    -- Override tracking
    overridden BOOLEAN NOT NULL DEFAULT FALSE,
    overridden_by UUID REFERENCES profiles(id),
    overridden_at TIMESTAMPTZ,
    override_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(review_id, flag_type) -- One flag per type per review
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Moderation queue indexes
CREATE INDEX idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX idx_moderation_queue_priority ON moderation_queue(priority DESC, created_at ASC);
CREATE INDEX idx_moderation_queue_product ON moderation_queue(product_id);
CREATE INDEX idx_moderation_queue_reviewer ON moderation_queue(reviewer_id);
CREATE INDEX idx_moderation_queue_assigned ON moderation_queue(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_moderation_queue_created ON moderation_queue(created_at DESC);
CREATE INDEX idx_moderation_queue_review ON moderation_queue(review_id);

-- Moderation actions indexes
CREATE INDEX idx_moderation_actions_queue_item ON moderation_actions(queue_item_id);
CREATE INDEX idx_moderation_actions_review ON moderation_actions(review_id);
CREATE INDEX idx_moderation_actions_moderator ON moderation_actions(moderator_id);
CREATE INDEX idx_moderation_actions_type ON moderation_actions(action_type);
CREATE INDEX idx_moderation_actions_created ON moderation_actions(created_at DESC);

-- Audit log indexes
CREATE INDEX idx_moderation_audit_queue ON moderation_audit_log(queue_item_id);
CREATE INDEX idx_moderation_audit_review ON moderation_audit_log(review_id);
CREATE INDEX idx_moderation_audit_actor ON moderation_audit_log(actor_id);
CREATE INDEX idx_moderation_audit_created ON moderation_audit_log(created_at DESC);

-- Auto moderation flags indexes
CREATE INDEX idx_auto_flags_review ON auto_moderation_flags(review_id);
CREATE INDEX idx_auto_flags_queue_item ON auto_moderation_flags(queue_item_id);
CREATE INDEX idx_auto_flags_type ON auto_moderation_flags(flag_type);
CREATE INDEX idx_auto_flags_overridden ON auto_moderation_flags(overridden) WHERE overridden = FALSE;
CREATE INDEX idx_auto_flags_confidence ON auto_moderation_flags(confidence_score DESC);

-- =====================================================
-- TRIGGER: Audit log for moderation actions
-- =====================================================

CREATE OR REPLACE FUNCTION log_moderation_action()
RETURNS TRIGGER AS $$
DECLARE
    actor_role_name TEXT;
    queue_item RECORD;
BEGIN
    -- Get actor role
    SELECT role::TEXT INTO actor_role_name
    FROM profiles
    WHERE id = NEW.moderator_id;
    
    -- Get queue item details
    SELECT * INTO queue_item
    FROM moderation_queue
    WHERE id = NEW.queue_item_id;
    
    -- Insert audit log entry
    INSERT INTO moderation_audit_log (
        queue_item_id,
        action_id,
        review_id,
        actor_id,
        actor_role,
        action_type,
        action_summary,
        state_before,
        state_after,
        reason,
        notes
    ) VALUES (
        NEW.queue_item_id,
        NEW.id,
        NEW.review_id,
        NEW.moderator_id,
        COALESCE(actor_role_name, 'unknown'),
        NEW.action_type,
        format('Moderator %s performed %s action on review %s', 
               NEW.moderator_id, 
               NEW.action_type, 
               NEW.review_id),
        jsonb_build_object(
            'rating', NEW.previous_rating,
            'comment', NEW.previous_comment,
            'status', queue_item.status
        ),
        jsonb_build_object(
            'rating', NEW.new_rating,
            'comment', NEW.new_comment,
            'action_type', NEW.action_type
        ),
        NEW.reason,
        NEW.notes
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_moderation_action
AFTER INSERT ON moderation_actions
FOR EACH ROW
EXECUTE FUNCTION log_moderation_action();

-- =====================================================
-- TRIGGER: Auto-create moderation queue on review insert
-- =====================================================

CREATE OR REPLACE FUNCTION auto_queue_review_for_moderation()
RETURNS TRIGGER AS $$
BEGIN
    -- Create moderation queue entry for new reviews
    INSERT INTO moderation_queue (
        review_id,
        product_id,
        reviewer_id,
        status,
        priority,
        original_rating,
        original_comment,
        current_rating,
        current_comment
    ) VALUES (
        NEW.id,
        NEW.product_id,
        NEW.user_id,
        'pending',
        CASE 
            WHEN NEW.rating <= 2 THEN 10 -- Low ratings get higher priority
            WHEN NEW.rating >= 4 THEN 0
            ELSE 5
        END,
        NEW.rating,
        NEW.comment,
        NEW.rating,
        NEW.comment
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_queue_review
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION auto_queue_review_for_moderation();

-- =====================================================
-- FUNCTION: Get moderation queue with filters
-- =====================================================

CREATE OR REPLACE FUNCTION get_moderation_queue(
    p_status moderation_status DEFAULT NULL,
    p_product_id UUID DEFAULT NULL,
    p_reviewer_id UUID DEFAULT NULL,
    p_min_priority INTEGER DEFAULT NULL,
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL,
    p_min_rating INTEGER DEFAULT NULL,
    p_max_rating INTEGER DEFAULT NULL,
    p_flagged_only BOOLEAN DEFAULT FALSE,
    p_assigned_to UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    queue_id UUID,
    review_id UUID,
    product_id UUID,
    product_name TEXT,
    reviewer_id UUID,
    reviewer_name TEXT,
    status moderation_status,
    priority INTEGER,
    original_rating INTEGER,
    original_comment TEXT,
    current_rating INTEGER,
    current_comment TEXT,
    flagged_by UUID,
    flagged_reason TEXT,
    assigned_to UUID,
    auto_flags JSONB,
    created_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    last_action_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mq.id,
        mq.review_id,
        mq.product_id,
        p.name AS product_name,
        mq.reviewer_id,
        prof.full_name AS reviewer_name,
        mq.status,
        mq.priority,
        mq.original_rating,
        mq.original_comment,
        mq.current_rating,
        mq.current_comment,
        mq.flagged_by,
        mq.flagged_reason,
        mq.assigned_to,
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'flag_type', amf.flag_type,
                    'confidence', amf.confidence_score,
                    'detected_content', amf.detected_content,
                    'overridden', amf.overridden
                )
            )
            FROM auto_moderation_flags amf
            WHERE amf.queue_item_id = mq.id),
            '[]'::jsonb
        ) AS auto_flags,
        mq.created_at,
        mq.reviewed_at,
        mq.last_action_at
    FROM moderation_queue mq
    INNER JOIN products p ON mq.product_id = p.id
    INNER JOIN profiles prof ON mq.reviewer_id = prof.id
    WHERE 
        (p_status IS NULL OR mq.status = p_status)
        AND (p_product_id IS NULL OR mq.product_id = p_product_id)
        AND (p_reviewer_id IS NULL OR mq.reviewer_id = p_reviewer_id)
        AND (p_min_priority IS NULL OR mq.priority >= p_min_priority)
        AND (p_date_from IS NULL OR mq.created_at >= p_date_from)
        AND (p_date_to IS NULL OR mq.created_at <= p_date_to)
        AND (p_min_rating IS NULL OR mq.current_rating >= p_min_rating)
        AND (p_max_rating IS NULL OR mq.current_rating <= p_max_rating)
        AND (NOT p_flagged_only OR mq.flagged_by IS NOT NULL)
        AND (p_assigned_to IS NULL OR mq.assigned_to = p_assigned_to)
    ORDER BY mq.priority DESC, mq.created_at ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Approve feedback
-- =====================================================

CREATE OR REPLACE FUNCTION approve_feedback(
    p_queue_item_id UUID,
    p_moderator_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_queue_item RECORD;
    v_action_id UUID;
    v_result JSONB;
BEGIN
    -- Get queue item
    SELECT * INTO v_queue_item
    FROM moderation_queue
    WHERE id = p_queue_item_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Queue item not found');
    END IF;
    
    -- Update queue status
    UPDATE moderation_queue
    SET 
        status = 'approved',
        reviewed_at = NOW(),
        last_action_at = NOW(),
        assigned_to = p_moderator_id
    WHERE id = p_queue_item_id;
    
    -- Update review visibility
    UPDATE reviews
    SET moderated = TRUE,
        moderated_at = NOW(),
        moderator_id = p_moderator_id
    WHERE id = v_queue_item.review_id;
    
    -- Record action
    INSERT INTO moderation_actions (
        queue_item_id,
        review_id,
        action_type,
        moderator_id,
        notes,
        previous_rating,
        new_rating,
        previous_comment,
        new_comment
    ) VALUES (
        p_queue_item_id,
        v_queue_item.review_id,
        'approve',
        p_moderator_id,
        p_notes,
        v_queue_item.original_rating,
        v_queue_item.current_rating,
        v_queue_item.original_comment,
        v_queue_item.current_comment
    ) RETURNING id INTO v_action_id;
    
    v_result := jsonb_build_object(
        'success', true,
        'action_id', v_action_id,
        'queue_item_id', p_queue_item_id,
        'review_id', v_queue_item.review_id,
        'status', 'approved'
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Reject feedback
-- =====================================================

CREATE OR REPLACE FUNCTION reject_feedback(
    p_queue_item_id UUID,
    p_moderator_id UUID,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_queue_item RECORD;
    v_action_id UUID;
    v_result JSONB;
BEGIN
    -- Get queue item
    SELECT * INTO v_queue_item
    FROM moderation_queue
    WHERE id = p_queue_item_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Queue item not found');
    END IF;
    
    IF p_reason IS NULL OR p_reason = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reason is required for rejection');
    END IF;
    
    -- Update queue status
    UPDATE moderation_queue
    SET 
        status = 'rejected',
        reviewed_at = NOW(),
        last_action_at = NOW(),
        assigned_to = p_moderator_id
    WHERE id = p_queue_item_id;
    
    -- Hide review
    UPDATE reviews
    SET 
        moderated = TRUE,
        moderated_at = NOW(),
        moderator_id = p_moderator_id,
        visible = FALSE
    WHERE id = v_queue_item.review_id;
    
    -- Record action
    INSERT INTO moderation_actions (
        queue_item_id,
        review_id,
        action_type,
        moderator_id,
        reason,
        notes,
        previous_rating,
        new_rating,
        previous_comment,
        new_comment
    ) VALUES (
        p_queue_item_id,
        v_queue_item.review_id,
        'reject',
        p_moderator_id,
        p_reason,
        p_notes,
        v_queue_item.original_rating,
        v_queue_item.current_rating,
        v_queue_item.original_comment,
        v_queue_item.current_comment
    ) RETURNING id INTO v_action_id;
    
    v_result := jsonb_build_object(
        'success', true,
        'action_id', v_action_id,
        'queue_item_id', p_queue_item_id,
        'review_id', v_queue_item.review_id,
        'status', 'rejected',
        'reason', p_reason
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Edit feedback
-- =====================================================

CREATE OR REPLACE FUNCTION edit_feedback(
    p_queue_item_id UUID,
    p_moderator_id UUID,
    p_new_rating INTEGER DEFAULT NULL,
    p_new_comment TEXT DEFAULT NULL,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_queue_item RECORD;
    v_action_id UUID;
    v_result JSONB;
BEGIN
    -- Get queue item
    SELECT * INTO v_queue_item
    FROM moderation_queue
    WHERE id = p_queue_item_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Queue item not found');
    END IF;
    
    IF p_reason IS NULL OR p_reason = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reason is required for editing');
    END IF;
    
    -- Use existing values if not provided
    p_new_rating := COALESCE(p_new_rating, v_queue_item.current_rating);
    p_new_comment := COALESCE(p_new_comment, v_queue_item.current_comment);
    
    -- Update queue with new content
    UPDATE moderation_queue
    SET 
        current_rating = p_new_rating,
        current_comment = p_new_comment,
        last_action_at = NOW()
    WHERE id = p_queue_item_id;
    
    -- Update review
    UPDATE reviews
    SET 
        rating = p_new_rating,
        comment = p_new_comment,
        updated_at = NOW()
    WHERE id = v_queue_item.review_id;
    
    -- Record action
    INSERT INTO moderation_actions (
        queue_item_id,
        review_id,
        action_type,
        moderator_id,
        reason,
        notes,
        previous_rating,
        new_rating,
        previous_comment,
        new_comment
    ) VALUES (
        p_queue_item_id,
        v_queue_item.review_id,
        'edit',
        p_moderator_id,
        p_reason,
        p_notes,
        v_queue_item.current_rating,
        p_new_rating,
        v_queue_item.current_comment,
        p_new_comment
    ) RETURNING id INTO v_action_id;
    
    v_result := jsonb_build_object(
        'success', true,
        'action_id', v_action_id,
        'queue_item_id', p_queue_item_id,
        'review_id', v_queue_item.review_id,
        'previous_rating', v_queue_item.current_rating,
        'new_rating', p_new_rating,
        'edited', true
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Escalate feedback
-- =====================================================

CREATE OR REPLACE FUNCTION escalate_feedback(
    p_queue_item_id UUID,
    p_moderator_id UUID,
    p_escalation_type escalation_type,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_queue_item RECORD;
    v_action_id UUID;
    v_result JSONB;
BEGIN
    -- Get queue item
    SELECT * INTO v_queue_item
    FROM moderation_queue
    WHERE id = p_queue_item_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Queue item not found');
    END IF;
    
    -- Update queue status
    UPDATE moderation_queue
    SET 
        status = 'escalated',
        priority = GREATEST(priority, 50), -- Bump priority for escalated items
        last_action_at = NOW()
    WHERE id = p_queue_item_id;
    
    -- Record action
    INSERT INTO moderation_actions (
        queue_item_id,
        review_id,
        action_type,
        moderator_id,
        escalation_type,
        reason,
        notes
    ) VALUES (
        p_queue_item_id,
        v_queue_item.review_id,
        'escalate',
        p_moderator_id,
        p_escalation_type,
        p_reason,
        p_notes
    ) RETURNING id INTO v_action_id;
    
    v_result := jsonb_build_object(
        'success', true,
        'action_id', v_action_id,
        'queue_item_id', p_queue_item_id,
        'review_id', v_queue_item.review_id,
        'status', 'escalated',
        'escalation_type', p_escalation_type
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Bulk moderate feedback
-- =====================================================

CREATE OR REPLACE FUNCTION bulk_moderate_feedback(
    p_queue_item_ids UUID[],
    p_moderator_id UUID,
    p_action_type moderation_action_type,
    p_reason TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_rate_limit INTEGER DEFAULT 100 -- Max items per call
)
RETURNS JSONB AS $$
DECLARE
    v_queue_item_id UUID;
    v_success_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_results JSONB := '[]'::jsonb;
    v_action_result JSONB;
    v_total_items INTEGER;
BEGIN
    v_total_items := array_length(p_queue_item_ids, 1);
    
    -- Check rate limit
    IF v_total_items > p_rate_limit THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', format('Bulk action exceeds rate limit. Max: %s, Requested: %s', p_rate_limit, v_total_items)
        );
    END IF;
    
    -- Process each queue item
    FOREACH v_queue_item_id IN ARRAY p_queue_item_ids
    LOOP
        BEGIN
            CASE p_action_type
                WHEN 'approve' THEN
                    v_action_result := approve_feedback(v_queue_item_id, p_moderator_id, p_notes);
                WHEN 'reject' THEN
                    v_action_result := reject_feedback(v_queue_item_id, p_moderator_id, p_reason, p_notes);
                ELSE
                    v_action_result := jsonb_build_object('success', false, 'error', 'Unsupported bulk action type');
            END CASE;
            
            IF (v_action_result->>'success')::boolean THEN
                v_success_count := v_success_count + 1;
            ELSE
                v_error_count := v_error_count + 1;
            END IF;
            
            v_results := v_results || jsonb_build_object(
                'queue_item_id', v_queue_item_id,
                'result', v_action_result
            );
        EXCEPTION WHEN OTHERS THEN
            v_error_count := v_error_count + 1;
            v_results := v_results || jsonb_build_object(
                'queue_item_id', v_queue_item_id,
                'result', jsonb_build_object('success', false, 'error', SQLERRM)
            );
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'total', v_total_items,
        'succeeded', v_success_count,
        'failed', v_error_count,
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Get audit log
-- =====================================================

CREATE OR REPLACE FUNCTION get_moderation_audit_log(
    p_review_id UUID DEFAULT NULL,
    p_queue_item_id UUID DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL,
    p_action_type moderation_action_type DEFAULT NULL,
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    log_id UUID,
    queue_item_id UUID,
    action_id UUID,
    review_id UUID,
    actor_id UUID,
    actor_name TEXT,
    actor_role TEXT,
    action_type moderation_action_type,
    action_summary TEXT,
    state_before JSONB,
    state_after JSONB,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mal.id,
        mal.queue_item_id,
        mal.action_id,
        mal.review_id,
        mal.actor_id,
        p.full_name AS actor_name,
        mal.actor_role,
        mal.action_type,
        mal.action_summary,
        mal.state_before,
        mal.state_after,
        mal.reason,
        mal.notes,
        mal.created_at
    FROM moderation_audit_log mal
    INNER JOIN profiles p ON mal.actor_id = p.id
    WHERE 
        (p_review_id IS NULL OR mal.review_id = p_review_id)
        AND (p_queue_item_id IS NULL OR mal.queue_item_id = p_queue_item_id)
        AND (p_actor_id IS NULL OR mal.actor_id = p_actor_id)
        AND (p_action_type IS NULL OR mal.action_type = p_action_type)
        AND (p_date_from IS NULL OR mal.created_at >= p_date_from)
        AND (p_date_to IS NULL OR mal.created_at <= p_date_to)
    ORDER BY mal.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Flag content for auto-moderation
-- =====================================================

CREATE OR REPLACE FUNCTION flag_for_auto_moderation(
    p_review_id UUID,
    p_flag_type auto_flag_reason,
    p_confidence_score DECIMAL,
    p_detected_content TEXT DEFAULT NULL,
    p_detection_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_flag_id UUID;
    v_queue_item_id UUID;
BEGIN
    -- Get queue item for review
    SELECT id INTO v_queue_item_id
    FROM moderation_queue
    WHERE review_id = p_review_id;
    
    -- Insert or update flag
    INSERT INTO auto_moderation_flags (
        review_id,
        queue_item_id,
        flag_type,
        confidence_score,
        detected_content,
        detection_metadata
    ) VALUES (
        p_review_id,
        v_queue_item_id,
        p_flag_type,
        p_confidence_score,
        p_detected_content,
        p_detection_metadata
    )
    ON CONFLICT (review_id, flag_type)
    DO UPDATE SET
        confidence_score = EXCLUDED.confidence_score,
        detected_content = EXCLUDED.detected_content,
        detection_metadata = EXCLUDED.detection_metadata,
        created_at = NOW()
    RETURNING id INTO v_flag_id;
    
    -- Update queue status to flagged if high confidence
    IF p_confidence_score >= 0.7 AND v_queue_item_id IS NOT NULL THEN
        UPDATE moderation_queue
        SET 
            status = 'flagged',
            priority = GREATEST(priority, 20)
        WHERE id = v_queue_item_id AND status = 'pending';
    END IF;
    
    RETURN v_flag_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Override auto-moderation flag
-- =====================================================

CREATE OR REPLACE FUNCTION override_auto_flag(
    p_flag_id UUID,
    p_moderator_id UUID,
    p_reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE auto_moderation_flags
    SET 
        overridden = TRUE,
        overridden_by = p_moderator_id,
        overridden_at = NOW(),
        override_reason = p_reason
    WHERE id = p_flag_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_moderation_flags ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for moderation tables
CREATE POLICY "Admin full access to moderation_queue"
ON moderation_queue FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admin full access to moderation_actions"
ON moderation_actions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admin read access to audit log"
ON moderation_audit_log FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admin full access to auto flags"
ON auto_moderation_flags FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE moderation_queue IS 'Central queue for all feedback items requiring moderation';
COMMENT ON TABLE moderation_actions IS 'Records all moderation actions taken on feedback';
COMMENT ON TABLE moderation_audit_log IS 'Immutable audit trail for all moderation activities';
COMMENT ON TABLE auto_moderation_flags IS 'Automatic flags raised by moderation workers/systems';

COMMENT ON FUNCTION get_moderation_queue IS 'Retrieve moderation queue with filters';
COMMENT ON FUNCTION approve_feedback IS 'Approve feedback and make it visible publicly';
COMMENT ON FUNCTION reject_feedback IS 'Reject feedback and hide it with reason';
COMMENT ON FUNCTION edit_feedback IS 'Edit feedback content for grammar or sensitive info';
COMMENT ON FUNCTION escalate_feedback IS 'Escalate feedback to legal/ops/compliance';
COMMENT ON FUNCTION bulk_moderate_feedback IS 'Bulk approve/reject feedback with rate limits';
COMMENT ON FUNCTION get_moderation_audit_log IS 'Retrieve audit log with filters';
COMMENT ON FUNCTION flag_for_auto_moderation IS 'Flag content for auto-moderation review';
COMMENT ON FUNCTION override_auto_flag IS 'Override an auto-moderation flag';
