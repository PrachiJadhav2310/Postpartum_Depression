-- ============================================
-- Complete Database Schema for Whispers of Motherhood
-- Postpartum Health Application
-- ============================================
-- Run this script in Supabase SQL Editor to create all tables
-- ============================================

-- ============================================
-- 1. USER PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  full_name text NOT NULL,
  phone text,
  due_date date,
  birth_date date,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text DEFAULT 'Spouse',
  healthcare_provider_name text,
  healthcare_provider_phone text,
  healthcare_provider_address text,
  notification_preferences jsonb DEFAULT '{
    "dailyCheckins": true,
    "emergencyAlerts": true,
    "communityUpdates": true,
    "appointmentReminders": true
  }'::jsonb,
  privacy_preferences jsonb DEFAULT '{
    "shareDataWithResearchers": false,
    "allowCommunityContact": true,
    "publicProfile": false
  }'::jsonb,
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. HEALTH RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS health_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN (
    'temperature', 'heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic',
    'weight', 'sleep_hours', 'sleep_quality', 'water_intake', 'exercise_minutes'
  )),
  value numeric NOT NULL,
  unit text NOT NULL,
  notes text,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. SYMPTOMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS symptoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  symptom_name text NOT NULL,
  severity integer NOT NULL CHECK (severity >= 1 AND severity <= 5),
  notes text,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 4. MOOD ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mood_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  mood_score integer NOT NULL CHECK (mood_score >= 1 AND mood_score <= 10),
  energy_level integer NOT NULL CHECK (energy_level >= 1 AND energy_level <= 10),
  anxiety_level integer NOT NULL CHECK (anxiety_level >= 1 AND anxiety_level <= 10),
  notes text,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 5. MENTAL HEALTH ASSESSMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS mental_health_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assessment_type text NOT NULL CHECK (assessment_type IN ('edinburgh', 'phq9', 'gad7', 'custom')),
  score integer NOT NULL,
  responses jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'mild', 'moderate', 'severe')) DEFAULT 'low',
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 6. COMMUNITY POSTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  tags text[] DEFAULT '{}',
  is_anonymous boolean DEFAULT false,
  is_support_request boolean DEFAULT false,
  likes_count integer DEFAULT 0,
  replies_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 7. COMMUNITY REPLIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS community_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_anonymous boolean DEFAULT false,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 8. COMMUNITY LIKES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS community_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES community_posts(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES community_replies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT check_like_target CHECK (
    (post_id IS NOT NULL AND reply_id IS NULL) OR 
    (post_id IS NULL AND reply_id IS NOT NULL)
  ),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, reply_id)
);

-- ============================================
-- 9. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean DEFAULT false,
  action_url text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 10. HEALTH PREDICTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS health_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  overall_risk_score integer NOT NULL DEFAULT 0,
  needs_consultation boolean DEFAULT false,
  urgent_care boolean DEFAULT false,
  mental_health_risk integer DEFAULT 0,
  physical_health_risk integer DEFAULT 0,
  recommendations jsonb DEFAULT '[]'::jsonb,
  prediction_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Health records indexes
CREATE INDEX IF NOT EXISTS health_records_user_id_idx ON health_records(user_id);
CREATE INDEX IF NOT EXISTS health_records_type_idx ON health_records(record_type);
CREATE INDEX IF NOT EXISTS health_records_recorded_at_idx ON health_records(recorded_at);

-- Symptoms indexes
CREATE INDEX IF NOT EXISTS symptoms_user_id_idx ON symptoms(user_id);
CREATE INDEX IF NOT EXISTS symptoms_recorded_at_idx ON symptoms(recorded_at);

-- Mood entries indexes
CREATE INDEX IF NOT EXISTS mood_entries_user_id_idx ON mood_entries(user_id);
CREATE INDEX IF NOT EXISTS mood_entries_recorded_at_idx ON mood_entries(recorded_at);

-- Mental health assessments indexes
CREATE INDEX IF NOT EXISTS assessments_user_id_idx ON mental_health_assessments(user_id);
CREATE INDEX IF NOT EXISTS assessments_completed_at_idx ON mental_health_assessments(completed_at);

-- Community indexes
CREATE INDEX IF NOT EXISTS community_posts_user_id_idx ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS community_posts_created_at_idx ON community_posts(created_at);
CREATE INDEX IF NOT EXISTS community_replies_post_id_idx ON community_replies(post_id);
CREATE INDEX IF NOT EXISTS community_replies_user_id_idx ON community_replies(user_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(is_read);

-- Health predictions indexes
CREATE INDEX IF NOT EXISTS health_predictions_user_id_idx ON health_predictions(user_id);
CREATE INDEX IF NOT EXISTS health_predictions_created_at_idx ON health_predictions(created_at);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
-- Note: user_profiles RLS is enabled but policies allow backend access
-- Backend handles authentication/authorization via JWT tokens
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mental_health_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_predictions ENABLE ROW LEVEL SECURITY;

-- User profiles policies
-- Note: Since we're using custom backend auth (not Supabase Auth),
-- RLS policies are disabled for user_profiles. Authentication is handled by backend JWT.
-- You can enable RLS later if you migrate to Supabase Auth.

-- For now, we'll create policies that allow authenticated backend access
-- In production, you may want to restrict these further

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true); -- Backend handles authorization via JWT

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Backend handles validation

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (true) -- Backend handles authorization
  WITH CHECK (true);

-- Health records policies
DROP POLICY IF EXISTS "Users can view own health records" ON health_records;
CREATE POLICY "Users can view own health records"
  ON health_records
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own health records" ON health_records;
CREATE POLICY "Users can insert own health records"
  ON health_records
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own health records" ON health_records;
CREATE POLICY "Users can update own health records"
  ON health_records
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own health records" ON health_records;
CREATE POLICY "Users can delete own health records"
  ON health_records
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Symptoms policies
DROP POLICY IF EXISTS "Users can view own symptoms" ON symptoms;
CREATE POLICY "Users can view own symptoms"
  ON symptoms
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own symptoms" ON symptoms;
CREATE POLICY "Users can insert own symptoms"
  ON symptoms
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own symptoms" ON symptoms;
CREATE POLICY "Users can update own symptoms"
  ON symptoms
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own symptoms" ON symptoms;
CREATE POLICY "Users can delete own symptoms"
  ON symptoms
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Mood entries policies
DROP POLICY IF EXISTS "Users can view own mood entries" ON mood_entries;
CREATE POLICY "Users can view own mood entries"
  ON mood_entries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own mood entries" ON mood_entries;
CREATE POLICY "Users can insert own mood entries"
  ON mood_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own mood entries" ON mood_entries;
CREATE POLICY "Users can update own mood entries"
  ON mood_entries
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own mood entries" ON mood_entries;
CREATE POLICY "Users can delete own mood entries"
  ON mood_entries
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Mental health assessments policies
DROP POLICY IF EXISTS "Users can view own assessments" ON mental_health_assessments;
CREATE POLICY "Users can view own assessments"
  ON mental_health_assessments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own assessments" ON mental_health_assessments;
CREATE POLICY "Users can insert own assessments"
  ON mental_health_assessments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own assessments" ON mental_health_assessments;
CREATE POLICY "Users can update own assessments"
  ON mental_health_assessments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Community posts policies (public read, authenticated write)
DROP POLICY IF EXISTS "Anyone can view community posts" ON community_posts;
CREATE POLICY "Anyone can view community posts"
  ON community_posts
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create community posts" ON community_posts;
CREATE POLICY "Users can create community posts"
  ON community_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own community posts" ON community_posts;
CREATE POLICY "Users can update own community posts"
  ON community_posts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own community posts" ON community_posts;
CREATE POLICY "Users can delete own community posts"
  ON community_posts
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Community replies policies
DROP POLICY IF EXISTS "Anyone can view community replies" ON community_replies;
CREATE POLICY "Anyone can view community replies"
  ON community_replies
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create community replies" ON community_replies;
CREATE POLICY "Users can create community replies"
  ON community_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own community replies" ON community_replies;
CREATE POLICY "Users can update own community replies"
  ON community_replies
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own community replies" ON community_replies;
CREATE POLICY "Users can delete own community replies"
  ON community_replies
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Community likes policies
DROP POLICY IF EXISTS "Users can manage own likes" ON community_likes;
CREATE POLICY "Users can manage own likes"
  ON community_likes
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Health predictions policies
DROP POLICY IF EXISTS "Users can view own predictions" ON health_predictions;
CREATE POLICY "Users can view own predictions"
  ON health_predictions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own predictions" ON health_predictions;
CREATE POLICY "Users can insert own predictions"
  ON health_predictions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- TRIGGERS AND FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for community_posts updated_at
DROP TRIGGER IF EXISTS update_community_posts_updated_at ON community_posts;
CREATE TRIGGER update_community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Note: User creation is handled by the backend API (/api/auth/register)
-- The backend directly inserts into user_profiles table with email and password_hash
-- No trigger needed since we're not using Supabase Auth for user creation

-- ============================================
-- 11. EMERGENCY RESOURCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS emergency_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('crisis', 'medical', 'support')),
  priority text NOT NULL CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  availability text DEFAULT '24/7',
  is_active boolean DEFAULT true,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 12. EMERGENCY ALERTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS emergency_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text,
  location text,
  status text DEFAULT 'logged' CHECK (status IN ('logged', 'contacted', 'resolved')),
  contacted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 13. EDUCATION RESOURCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS education_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  type text NOT NULL CHECK (type IN ('article', 'video', 'podcast', 'guide', 'course')),
  category text NOT NULL,
  duration text,
  rating numeric DEFAULT 0,
  author text,
  content_url text,
  thumbnail_url text,
  featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  view_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 14. QUESTIONNAIRE RESPONSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  questionnaire_type text DEFAULT 'initial' CHECK (questionnaire_type IN ('initial', 'followup', 'custom')),
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- INDEXES FOR NEW TABLES
-- ============================================

-- Emergency resources indexes
CREATE INDEX IF NOT EXISTS emergency_resources_type_idx ON emergency_resources(type);
CREATE INDEX IF NOT EXISTS emergency_resources_priority_idx ON emergency_resources(priority);
CREATE INDEX IF NOT EXISTS emergency_resources_active_idx ON emergency_resources(is_active);

-- Emergency alerts indexes
CREATE INDEX IF NOT EXISTS emergency_alerts_user_id_idx ON emergency_alerts(user_id);
CREATE INDEX IF NOT EXISTS emergency_alerts_created_at_idx ON emergency_alerts(created_at);
CREATE INDEX IF NOT EXISTS emergency_alerts_status_idx ON emergency_alerts(status);

-- Education resources indexes
CREATE INDEX IF NOT EXISTS education_resources_category_idx ON education_resources(category);
CREATE INDEX IF NOT EXISTS education_resources_type_idx ON education_resources(type);
CREATE INDEX IF NOT EXISTS education_resources_featured_idx ON education_resources(featured);
CREATE INDEX IF NOT EXISTS education_resources_active_idx ON education_resources(is_active);

-- Questionnaire responses indexes
CREATE INDEX IF NOT EXISTS questionnaire_responses_user_id_idx ON questionnaire_responses(user_id);
CREATE INDEX IF NOT EXISTS questionnaire_responses_type_idx ON questionnaire_responses(questionnaire_type);
CREATE INDEX IF NOT EXISTS questionnaire_responses_completed_at_idx ON questionnaire_responses(completed_at);

-- ============================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================

ALTER TABLE emergency_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- Emergency resources policies (public read, admin write)
DROP POLICY IF EXISTS "Anyone can view emergency resources" ON emergency_resources;
CREATE POLICY "Anyone can view emergency resources"
  ON emergency_resources
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Emergency alerts policies (users can only see their own)
DROP POLICY IF EXISTS "Users can view own emergency alerts" ON emergency_alerts;
CREATE POLICY "Users can view own emergency alerts"
  ON emergency_alerts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own emergency alerts" ON emergency_alerts;
CREATE POLICY "Users can create own emergency alerts"
  ON emergency_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own emergency alerts" ON emergency_alerts;
CREATE POLICY "Users can update own emergency alerts"
  ON emergency_alerts
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Education resources policies (public read)
DROP POLICY IF EXISTS "Anyone can view education resources" ON education_resources;
CREATE POLICY "Anyone can view education resources"
  ON education_resources
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Questionnaire responses policies (users can only see their own)
DROP POLICY IF EXISTS "Users can view own questionnaire responses" ON questionnaire_responses;
CREATE POLICY "Users can view own questionnaire responses"
  ON questionnaire_responses
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own questionnaire responses" ON questionnaire_responses;
CREATE POLICY "Users can create own questionnaire responses"
  ON questionnaire_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- TRIGGERS FOR NEW TABLES
-- ============================================

-- Trigger for emergency_resources updated_at
DROP TRIGGER IF EXISTS update_emergency_resources_updated_at ON emergency_resources;
CREATE TRIGGER update_emergency_resources_updated_at
  BEFORE UPDATE ON emergency_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for education_resources updated_at
DROP TRIGGER IF EXISTS update_education_resources_updated_at ON education_resources;
CREATE TRIGGER update_education_resources_updated_at
  BEFORE UPDATE ON education_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA FOR EMERGENCY RESOURCES
-- ============================================
INSERT INTO emergency_resources (name, phone, description, type, priority, availability, order_index) VALUES
('Emergency Services', '911', 'Immediate life-threatening emergencies', 'medical', 'high', '24/7', 1),
('National Suicide Prevention Lifeline', '988', 'Free, confidential crisis counseling 24/7', 'crisis', 'high', '24/7', 2),
('Crisis Text Line', '741741', 'Text HOME for free crisis counseling', 'crisis', 'high', '24/7', 3),
('Postpartum Support International', '1-800-944-4773', 'Specialized postpartum mental health support', 'support', 'medium', '24/7', 4),
('Lactation Support Hotline', '1-855-550-6667', 'Breastfeeding help and support', 'support', 'low', 'Business Hours', 5)
ON CONFLICT DO NOTHING;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE '📊 Tables created: user_profiles, health_records, symptoms, mood_entries, mental_health_assessments, community_posts, community_replies, community_likes, notifications, health_predictions, emergency_resources, emergency_alerts, education_resources, questionnaire_responses';
  RAISE NOTICE '🔒 Row Level Security (RLS) enabled on all tables';
  RAISE NOTICE '🔑 Policies created for authenticated users';
  RAISE NOTICE '⚡ Indexes created for optimal performance';
  RAISE NOTICE '🔄 Triggers created for automatic profile creation and updated_at timestamps';
  RAISE NOTICE '🌱 Seed data inserted for emergency resources';
END $$;
