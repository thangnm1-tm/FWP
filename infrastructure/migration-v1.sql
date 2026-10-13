-- FwP Database Migration V1
-- Full schema creation with PostGIS support

-- ══════════════ Extensions ══════════════
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ══════════════ ENUMS ══════════════
DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'deactivated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE purpose_enum AS ENUM ('dating', 'friendship', 'study_buddy', 'all');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE swipe_action AS ENUM ('LIKE', 'PASS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gpa_preference_enum AS ENUM ('same_tier', 'max_1_diff', 'no_preference');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE reveal_status AS ENUM ('NONE', 'A_REQUESTED', 'B_REQUESTED', 'BOTH_ACCEPTED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ══════════════ TABLES ══════════════

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  status user_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Student Verifications
CREATE TABLE IF NOT EXISTS student_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_code VARCHAR(6) NOT NULL,
  otp_expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Universities
CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(50) NOT NULL,
  email_domain VARCHAR(100) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculties
CREATE TABLE IF NOT EXISTS faculties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(20) NOT NULL
);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  date_of_birth DATE,
  gender gender_enum,
  bio TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  gpa FLOAT,
  gpa_bucket INT,
  university_id UUID REFERENCES universities(id),
  faculty_id UUID REFERENCES faculties(id),
  academic_year INT,
  purpose purpose_enum,
  profile_completed BOOLEAN DEFAULT FALSE,
  gpa_visible BOOLEAN DEFAULT TRUE,
  discoverable BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interests
CREATE TABLE IF NOT EXISTS interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50)
);

-- User Interests
CREATE TABLE IF NOT EXISTS user_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  UNIQUE(user_id, interest_id)
);

-- Preferences
CREATE TABLE IF NOT EXISTS preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  gender_preference VARCHAR(20),
  min_age INT DEFAULT 18,
  max_age INT DEFAULT 30,
  max_distance_km INT DEFAULT 20,
  gpa_preference gpa_preference_enum DEFAULT 'no_preference',
  max_gpa_tier_diff INT DEFAULT 1,
  same_university_only BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Locations (with PostGIS geography point)
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  point GEOGRAPHY(Point, 4326),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recommendation Impressions (ML event tracking)
CREATE TABLE IF NOT EXISTS recommendation_impressions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  viewer_user_id UUID NOT NULL REFERENCES users(id),
  candidate_user_id UUID NOT NULL REFERENCES users(id),
  request_id UUID NOT NULL,
  rank_position INT NOT NULL,
  model_version VARCHAR(50) DEFAULT 'rule_v1',
  score FLOAT,
  shown_at TIMESTAMPTZ DEFAULT NOW()
);

-- Swipe Events
CREATE TABLE IF NOT EXISTS swipe_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  viewer_user_id UUID NOT NULL REFERENCES users(id),
  candidate_user_id UUID NOT NULL REFERENCES users(id),
  action swipe_action NOT NULL,
  impression_id UUID REFERENCES recommendation_impressions(id),
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(viewer_user_id, candidate_user_id)
);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a_id UUID NOT NULL REFERENCES users(id),
  user_b_id UUID NOT NULL REFERENCES users(id),
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE,
  -- Always store user_a_id < user_b_id to prevent duplicates
  CONSTRAINT match_ordered CHECK (user_a_id < user_b_id)
);

-- Unique match constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_unique
  ON matches(user_a_id, user_b_id);

-- Chat Rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  identity_revealed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reveal Requests
CREATE TABLE IF NOT EXISTS reveal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL UNIQUE REFERENCES matches(id),
  requester_id UUID NOT NULL REFERENCES users(id),
  status reveal_status DEFAULT 'NONE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- Blocks
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES users(id),
  blocked_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id),
  reported_id UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device Tokens (FCM)
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(500) NOT NULL,
  platform VARCHAR(20) DEFAULT 'android',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model Versions (ML registry)
CREATE TABLE IF NOT EXISTS model_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version VARCHAR(50) NOT NULL UNIQUE,
  model_type VARCHAR(50) NOT NULL,
  metrics JSONB,
  artifact_path VARCHAR(500),
  is_active BOOLEAN DEFAULT FALSE,
  trained_at TIMESTAMPTZ,
  deployed_at TIMESTAMPTZ
);

-- ══════════════ INDEXES ══════════════

-- PostGIS spatial index
CREATE INDEX IF NOT EXISTS idx_user_locations_point
  ON user_locations USING GIST(point);

-- Candidate generation
CREATE INDEX IF NOT EXISTS idx_profiles_gender
  ON profiles(gender) WHERE profile_completed = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_university
  ON profiles(university_id);
CREATE INDEX IF NOT EXISTS idx_profiles_gpa_bucket
  ON profiles(gpa_bucket);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON profiles(user_id);

-- Swipe lookups
CREATE INDEX IF NOT EXISTS idx_swipe_viewer
  ON swipe_events(viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_swipe_candidate
  ON swipe_events(candidate_user_id);

-- Block lookups
CREATE INDEX IF NOT EXISTS idx_blocks_blocker
  ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked
  ON blocks(blocked_id);

-- Match lookups
CREATE INDEX IF NOT EXISTS idx_matches_user_a
  ON matches(user_a_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_matches_user_b
  ON matches(user_b_id) WHERE active = TRUE;

-- Chat
CREATE INDEX IF NOT EXISTS idx_messages_room
  ON messages(chat_room_id, created_at DESC);

-- Impressions
CREATE INDEX IF NOT EXISTS idx_impressions_viewer
  ON recommendation_impressions(viewer_user_id, shown_at DESC);

-- ══════════════ SEED DATA ══════════════

-- PTIT University
INSERT INTO universities (id, name, short_name, email_domain)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Học viện Công nghệ Bưu chính Viễn thông',
  'PTIT',
  'stu.ptit.edu.vn'
) ON CONFLICT DO NOTHING;

-- Faculties
INSERT INTO faculties (university_id, name, code)
SELECT 'a0000000-0000-0000-0000-000000000001', seed.name, seed.code
FROM (VALUES
  ('Công nghệ thông tin', 'CNTT'), ('An toàn thông tin', 'ATTT'),
  ('Điện tử Viễn thông', 'DTVT'), ('Quản trị kinh doanh', 'QTKD'),
  ('Kế toán', 'KTT'), ('Mạng máy tính', 'MMT'),
  ('Khoa học máy tính', 'KHMT'), ('Kỹ thuật phần mềm', 'KTPM')
) AS seed(name, code)
WHERE NOT EXISTS (
  SELECT 1 FROM faculties f
  WHERE f.university_id = 'a0000000-0000-0000-0000-000000000001'
    AND f.code = seed.code
);

-- Interests
INSERT INTO interests (name, category) VALUES
  ('AI/ML', 'Tech'), ('Web Dev', 'Tech'), ('Mobile Dev', 'Tech'),
  ('Game Dev', 'Tech'), ('Cybersecurity', 'Tech'), ('Data Science', 'Tech'),
  ('Guitar', 'Music'), ('Piano', 'Music'), ('Singing', 'Music'),
  ('Dancing', 'Art'), ('Photography', 'Art'), ('Art', 'Art'), ('Design', 'Art'),
  ('Gym', 'Sports'), ('Running', 'Sports'), ('Swimming', 'Sports'),
  ('Basketball', 'Sports'), ('Football', 'Sports'),
  ('Anime', 'Entertainment'), ('Manga', 'Entertainment'),
  ('Movies', 'Entertainment'), ('K-pop', 'Entertainment'), ('Gaming', 'Entertainment'),
  ('Reading', 'Lifestyle'), ('Coffee', 'Lifestyle'), ('Cooking', 'Lifestyle'),
  ('Travel', 'Lifestyle'), ('Hiking', 'Lifestyle'),
  ('Music Production', 'Creative'), ('Volunteering', 'Social'), ('Debate', 'Social')
ON CONFLICT DO NOTHING;
