-- =================================================================
-- FwP Reset Demo Data Script
-- Removes ONLY synthetic demo data (emails like demo.student%@stu.ptit.edu.vn)
-- Preserves real users and Docker volumes.
-- =================================================================
BEGIN;

-- Delete messages in rooms involving demo users
DELETE FROM messages WHERE sender_id IN (SELECT id FROM users WHERE email LIKE 'demo.student%@stu.ptit.edu.vn');

-- Delete chat rooms for matches of demo users
DELETE FROM chat_rooms WHERE match_id IN (SELECT id FROM matches WHERE user_a_id IN (SELECT id FROM users WHERE email LIKE 'demo.student%@stu.ptit.edu.vn') OR user_b_id IN (SELECT id FROM users WHERE email LIKE 'demo.student%@stu.ptit.edu.vn'));

-- Delete matches involving demo users
DELETE FROM matches WHERE user_a_id IN (SELECT id FROM users WHERE email LIKE 'demo.student%@stu.ptit.edu.vn') OR user_b_id IN (SELECT id FROM users WHERE email LIKE 'demo.student%@stu.ptit.edu.vn');

-- Delete swipe events involving demo users
DELETE FROM swipe_events WHERE viewer_user_id IN (SELECT id FROM users WHERE email LIKE 'demo.student%@stu.ptit.edu.vn') OR candidate_user_id IN (SELECT id FROM users WHERE email LIKE 'demo.student%@stu.ptit.edu.vn');

-- Delete impressions involving demo users
DELETE FROM recommendation_impressions WHERE viewer_user_id IN (SELECT id FROM users WHERE email LIKE 'demo.student%@stu.ptit.edu.vn') OR candidate_user_id IN (SELECT id FROM users WHERE email LIKE 'demo.student%@stu.ptit.edu.vn');

-- Delete demo users (cascades to profiles, preferences, user_locations, user_interests, verifications)
DELETE FROM users WHERE email LIKE 'demo.student%@stu.ptit.edu.vn';

COMMIT;
