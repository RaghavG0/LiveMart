-- Test suite for moderation system
-- Run these tests after deploying the migration

BEGIN;

-- Setup test data
CREATE TEMP TABLE test_results (
    test_name TEXT,
    passed BOOLEAN,
    error_message TEXT
);

-- Helper function to run tests
CREATE OR REPLACE FUNCTION run_test(test_name TEXT, test_query TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE test_query;
    INSERT INTO test_results VALUES (test_name, TRUE, NULL);
EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results VALUES (test_name, FALSE, SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TEST 1: Moderation queue creation
-- =====================================================
DO $$
DECLARE
    v_review_id UUID;
    v_queue_id UUID;
BEGIN
    -- Insert test review (assuming test user and product exist)
    INSERT INTO reviews (user_id, product_id, rating, comment)
    SELECT 
        id,
        (SELECT id FROM products LIMIT 1),
        3,
        'Test review for moderation'
    FROM profiles
    LIMIT 1
    RETURNING id INTO v_review_id;
    
    -- Check if queue item was auto-created
    SELECT id INTO v_queue_id
    FROM moderation_queue
    WHERE review_id = v_review_id;
    
    IF v_queue_id IS NULL THEN
        RAISE EXCEPTION 'Queue item not auto-created for new review';
    END IF;
    
    RAISE NOTICE 'TEST 1 PASSED: Queue item auto-created';
    
    -- Cleanup
    DELETE FROM reviews WHERE id = v_review_id;
END;
$$;

-- =====================================================
-- TEST 2: Approve feedback
-- =====================================================
DO $$
DECLARE
    v_review_id UUID;
    v_queue_id UUID;
    v_moderator_id UUID;
    v_result JSONB;
BEGIN
    -- Get test moderator (admin user)
    SELECT id INTO v_moderator_id
    FROM profiles
    WHERE role = 'admin'
    LIMIT 1;
    
    IF v_moderator_id IS NULL THEN
        RAISE EXCEPTION 'No admin user found for testing';
    END IF;
    
    -- Create test review
    INSERT INTO reviews (user_id, product_id, rating, comment)
    SELECT 
        id,
        (SELECT id FROM products LIMIT 1),
        4,
        'Test review for approval'
    FROM profiles
    WHERE role != 'admin'
    LIMIT 1
    RETURNING id INTO v_review_id;
    
    -- Get queue item
    SELECT id INTO v_queue_id
    FROM moderation_queue
    WHERE review_id = v_review_id;
    
    -- Test approve function
    v_result := approve_feedback(v_queue_id, v_moderator_id, 'Test approval');
    
    IF NOT (v_result->>'success')::boolean THEN
        RAISE EXCEPTION 'Approve feedback failed: %', v_result->>'error';
    END IF;
    
    -- Verify queue status
    IF NOT EXISTS (
        SELECT 1 FROM moderation_queue
        WHERE id = v_queue_id AND status = 'approved'
    ) THEN
        RAISE EXCEPTION 'Queue status not updated to approved';
    END IF;
    
    -- Verify review is moderated
    IF NOT EXISTS (
        SELECT 1 FROM reviews
        WHERE id = v_review_id AND moderated = TRUE
    ) THEN
        RAISE EXCEPTION 'Review not marked as moderated';
    END IF;
    
    RAISE NOTICE 'TEST 2 PASSED: Approve feedback works correctly';
    
    -- Cleanup
    DELETE FROM reviews WHERE id = v_review_id;
END;
$$;

-- =====================================================
-- TEST 3: Reject feedback
-- =====================================================
DO $$
DECLARE
    v_review_id UUID;
    v_queue_id UUID;
    v_moderator_id UUID;
    v_result JSONB;
BEGIN
    -- Get test moderator
    SELECT id INTO v_moderator_id
    FROM profiles
    WHERE role = 'admin'
    LIMIT 1;
    
    -- Create test review
    INSERT INTO reviews (user_id, product_id, rating, comment)
    SELECT 
        id,
        (SELECT id FROM products LIMIT 1),
        1,
        'Inappropriate content for rejection test'
    FROM profiles
    WHERE role != 'admin'
    LIMIT 1
    RETURNING id INTO v_review_id;
    
    -- Get queue item
    SELECT id INTO v_queue_id
    FROM moderation_queue
    WHERE review_id = v_review_id;
    
    -- Test reject function
    v_result := reject_feedback(
        v_queue_id,
        v_moderator_id,
        'Contains inappropriate content',
        'Test rejection'
    );
    
    IF NOT (v_result->>'success')::boolean THEN
        RAISE EXCEPTION 'Reject feedback failed: %', v_result->>'error';
    END IF;
    
    -- Verify queue status
    IF NOT EXISTS (
        SELECT 1 FROM moderation_queue
        WHERE id = v_queue_id AND status = 'rejected'
    ) THEN
        RAISE EXCEPTION 'Queue status not updated to rejected';
    END IF;
    
    -- Verify review is hidden
    IF NOT EXISTS (
        SELECT 1 FROM reviews
        WHERE id = v_review_id AND visible = FALSE
    ) THEN
        RAISE EXCEPTION 'Review not hidden after rejection';
    END IF;
    
    RAISE NOTICE 'TEST 3 PASSED: Reject feedback works correctly';
    
    -- Cleanup
    DELETE FROM reviews WHERE id = v_review_id;
END;
$$;

-- =====================================================
-- TEST 4: Edit feedback
-- =====================================================
DO $$
DECLARE
    v_review_id UUID;
    v_queue_id UUID;
    v_moderator_id UUID;
    v_result JSONB;
    v_original_comment TEXT := 'Original comment with typos';
    v_edited_comment TEXT := 'Original comment with corrections';
BEGIN
    -- Get test moderator
    SELECT id INTO v_moderator_id
    FROM profiles
    WHERE role = 'admin'
    LIMIT 1;
    
    -- Create test review
    INSERT INTO reviews (user_id, product_id, rating, comment)
    SELECT 
        id,
        (SELECT id FROM products LIMIT 1),
        4,
        v_original_comment
    FROM profiles
    WHERE role != 'admin'
    LIMIT 1
    RETURNING id INTO v_review_id;
    
    -- Get queue item
    SELECT id INTO v_queue_id
    FROM moderation_queue
    WHERE review_id = v_review_id;
    
    -- Test edit function
    v_result := edit_feedback(
        v_queue_id,
        v_moderator_id,
        4,
        v_edited_comment,
        'Fixed typos',
        'Test edit'
    );
    
    IF NOT (v_result->>'success')::boolean THEN
        RAISE EXCEPTION 'Edit feedback failed: %', v_result->>'error';
    END IF;
    
    -- Verify review is updated
    IF NOT EXISTS (
        SELECT 1 FROM reviews
        WHERE id = v_review_id AND comment = v_edited_comment
    ) THEN
        RAISE EXCEPTION 'Review comment not updated';
    END IF;
    
    -- Verify original is preserved in queue
    IF NOT EXISTS (
        SELECT 1 FROM moderation_queue
        WHERE id = v_queue_id AND original_comment = v_original_comment
    ) THEN
        RAISE EXCEPTION 'Original comment not preserved';
    END IF;
    
    RAISE NOTICE 'TEST 4 PASSED: Edit feedback preserves audit trail';
    
    -- Cleanup
    DELETE FROM reviews WHERE id = v_review_id;
END;
$$;

-- =====================================================
-- TEST 5: Escalate feedback
-- =====================================================
DO $$
DECLARE
    v_review_id UUID;
    v_queue_id UUID;
    v_moderator_id UUID;
    v_result JSONB;
BEGIN
    -- Get test moderator
    SELECT id INTO v_moderator_id
    FROM profiles
    WHERE role = 'admin'
    LIMIT 1;
    
    -- Create test review
    INSERT INTO reviews (user_id, product_id, rating, comment)
    SELECT 
        id,
        (SELECT id FROM products LIMIT 1),
        1,
        'Potentially legal issue requiring escalation'
    FROM profiles
    WHERE role != 'admin'
    LIMIT 1
    RETURNING id INTO v_review_id;
    
    -- Get queue item
    SELECT id INTO v_queue_id
    FROM moderation_queue
    WHERE review_id = v_review_id;
    
    -- Test escalate function
    v_result := escalate_feedback(
        v_queue_id,
        v_moderator_id,
        'legal',
        'Potential legal issue',
        'Test escalation'
    );
    
    IF NOT (v_result->>'success')::boolean THEN
        RAISE EXCEPTION 'Escalate feedback failed: %', v_result->>'error';
    END IF;
    
    -- Verify queue status and priority
    IF NOT EXISTS (
        SELECT 1 FROM moderation_queue
        WHERE id = v_queue_id AND status = 'escalated' AND priority >= 50
    ) THEN
        RAISE EXCEPTION 'Queue not properly escalated';
    END IF;
    
    RAISE NOTICE 'TEST 5 PASSED: Escalate feedback works correctly';
    
    -- Cleanup
    DELETE FROM reviews WHERE id = v_review_id;
END;
$$;

-- =====================================================
-- TEST 6: Audit log integrity
-- =====================================================
DO $$
DECLARE
    v_review_id UUID;
    v_queue_id UUID;
    v_moderator_id UUID;
    v_result JSONB;
    v_audit_count INTEGER;
BEGIN
    -- Get test moderator
    SELECT id INTO v_moderator_id
    FROM profiles
    WHERE role = 'admin'
    LIMIT 1;
    
    -- Create test review
    INSERT INTO reviews (user_id, product_id, rating, comment)
    SELECT 
        id,
        (SELECT id FROM products LIMIT 1),
        3,
        'Test review for audit log'
    FROM profiles
    WHERE role != 'admin'
    LIMIT 1
    RETURNING id INTO v_review_id;
    
    -- Get queue item
    SELECT id INTO v_queue_id
    FROM moderation_queue
    WHERE review_id = v_review_id;
    
    -- Perform multiple actions
    v_result := edit_feedback(v_queue_id, v_moderator_id, 4, 'Edited comment', 'Test edit', NULL);
    v_result := approve_feedback(v_queue_id, v_moderator_id, 'Test approval');
    
    -- Count audit log entries
    SELECT COUNT(*) INTO v_audit_count
    FROM moderation_audit_log
    WHERE review_id = v_review_id;
    
    IF v_audit_count < 2 THEN
        RAISE EXCEPTION 'Audit log not recording all actions. Expected >= 2, got %', v_audit_count;
    END IF;
    
    -- Verify audit log immutability (no update/delete allowed)
    BEGIN
        UPDATE moderation_audit_log
        SET reason = 'Modified'
        WHERE review_id = v_review_id;
        
        RAISE EXCEPTION 'Audit log should not be modifiable';
    EXCEPTION WHEN insufficient_privilege THEN
        -- Expected - audit log should be immutable
        NULL;
    END;
    
    RAISE NOTICE 'TEST 6 PASSED: Audit log integrity maintained';
    
    -- Cleanup
    DELETE FROM reviews WHERE id = v_review_id;
END;
$$;

-- =====================================================
-- TEST 7: Bulk moderation with rate limits
-- =====================================================
DO $$
DECLARE
    v_review_ids UUID[] := ARRAY[]::UUID[];
    v_queue_ids UUID[] := ARRAY[]::UUID[];
    v_moderator_id UUID;
    v_result JSONB;
    v_i INTEGER;
BEGIN
    -- Get test moderator
    SELECT id INTO v_moderator_id
    FROM profiles
    WHERE role = 'admin'
    LIMIT 1;
    
    -- Create 5 test reviews
    FOR v_i IN 1..5 LOOP
        INSERT INTO reviews (user_id, product_id, rating, comment)
        SELECT 
            id,
            (SELECT id FROM products LIMIT 1),
            3,
            'Bulk test review ' || v_i
        FROM profiles
        WHERE role != 'admin'
        LIMIT 1
        RETURNING id INTO v_review_ids[v_i];
        
        SELECT id INTO v_queue_ids[v_i]
        FROM moderation_queue
        WHERE review_id = v_review_ids[v_i];
    END LOOP;
    
    -- Test bulk approve
    v_result := bulk_moderate_feedback(
        v_queue_ids,
        v_moderator_id,
        'approve',
        NULL,
        'Bulk test',
        100
    );
    
    IF NOT (v_result->>'success')::boolean THEN
        RAISE EXCEPTION 'Bulk moderation failed: %', v_result;
    END IF;
    
    IF (v_result->>'succeeded')::integer != 5 THEN
        RAISE EXCEPTION 'Expected 5 successes, got %', v_result->>'succeeded';
    END IF;
    
    -- Test rate limit
    DECLARE
        v_large_array UUID[] := ARRAY_FILL(v_queue_ids[1], ARRAY[150]);
    BEGIN
        v_result := bulk_moderate_feedback(
            v_large_array,
            v_moderator_id,
            'approve',
            NULL,
            'Rate limit test',
            100
        );
        
        IF (v_result->>'success')::boolean THEN
            RAISE EXCEPTION 'Rate limit not enforced';
        END IF;
    END;
    
    RAISE NOTICE 'TEST 7 PASSED: Bulk moderation and rate limits work correctly';
    
    -- Cleanup
    FOREACH v_review_ids IN ARRAY v_review_ids LOOP
        DELETE FROM reviews WHERE id = v_review_ids;
    END LOOP;
END;
$$;

-- =====================================================
-- TEST 8: Auto-moderation flags
-- =====================================================
DO $$
DECLARE
    v_review_id UUID;
    v_flag_id UUID;
    v_moderator_id UUID;
BEGIN
    -- Get test moderator
    SELECT id INTO v_moderator_id
    FROM profiles
    WHERE role = 'admin'
    LIMIT 1;
    
    -- Create test review
    INSERT INTO reviews (user_id, product_id, rating, comment)
    SELECT 
        id,
        (SELECT id FROM products LIMIT 1),
        1,
        'This is spam content'
    FROM profiles
    WHERE role != 'admin'
    LIMIT 1
    RETURNING id INTO v_review_id;
    
    -- Flag for auto-moderation
    v_flag_id := flag_for_auto_moderation(
        v_review_id,
        'spam',
        0.85,
        'spam',
        '{"matched_patterns": ["spam"]}'::jsonb
    );
    
    IF v_flag_id IS NULL THEN
        RAISE EXCEPTION 'Auto-moderation flag not created';
    END IF;
    
    -- Verify flag exists
    IF NOT EXISTS (
        SELECT 1 FROM auto_moderation_flags
        WHERE id = v_flag_id AND confidence_score = 0.85
    ) THEN
        RAISE EXCEPTION 'Auto-moderation flag not stored correctly';
    END IF;
    
    -- Test override
    IF NOT override_auto_flag(v_flag_id, v_moderator_id, 'False positive') THEN
        RAISE EXCEPTION 'Failed to override auto-moderation flag';
    END IF;
    
    -- Verify override
    IF NOT EXISTS (
        SELECT 1 FROM auto_moderation_flags
        WHERE id = v_flag_id AND overridden = TRUE
    ) THEN
        RAISE EXCEPTION 'Auto-moderation flag override not recorded';
    END IF;
    
    RAISE NOTICE 'TEST 8 PASSED: Auto-moderation flags work correctly';
    
    -- Cleanup
    DELETE FROM reviews WHERE id = v_review_id;
END;
$$;

-- =====================================================
-- TEST 9: RLS policies for admin-only access
-- =====================================================
DO $$
DECLARE
    v_non_admin_id UUID;
BEGIN
    -- Get non-admin user
    SELECT id INTO v_non_admin_id
    FROM profiles
    WHERE role != 'admin'
    LIMIT 1;
    
    -- Set session to non-admin user
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_non_admin_id)::text, true);
    
    -- Attempt to access moderation_queue (should fail)
    BEGIN
        PERFORM * FROM moderation_queue LIMIT 1;
        RAISE EXCEPTION 'Non-admin user should not access moderation queue';
    EXCEPTION WHEN insufficient_privilege THEN
        -- Expected
        NULL;
    END;
    
    RAISE NOTICE 'TEST 9 PASSED: RLS policies enforce admin-only access';
END;
$$;

-- =====================================================
-- Display test results
-- =====================================================
SELECT 
    test_name,
    CASE WHEN passed THEN '✓ PASSED' ELSE '✗ FAILED' END as result,
    error_message
FROM test_results
ORDER BY test_name;

-- Summary
SELECT 
    COUNT(*) as total_tests,
    SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed,
    SUM(CASE WHEN NOT passed THEN 1 ELSE 0 END) as failed
FROM test_results;

ROLLBACK;
