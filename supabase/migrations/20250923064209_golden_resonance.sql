-- User profiles and authentication
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  full_name varchar(255) NOT NULL,
  phone varchar(20),
  due_date date,
  birth_date date,
  emergency_contact_name varchar(255),
  emergency_contact_phone varchar(20),
  emergency_contact_relationship varchar(100) DEFAULT 'Spouse',
  healthcare_provider_name varchar(255),
  healthcare_provider_phone varchar(20),
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

-- Health records
CREATE TABLE IF NOT EXISTS health_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  record_type varchar(50) NOT NULL CHECK (record_type IN (
    'temperature', 'heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic',
    'weight', 'sleep_hours', 'sleep_quality', 'water_intake', 'exercise_minutes'
  )),
  value numeric NOT NULL,
  unit varchar(20) NOT NULL,
  notes text,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Symptoms tracking
CREATE TABLE IF NOT EXISTS symptoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  symptom_name varchar(255) NOT NULL,
  severity integer NOT NULL CHECK (severity >= 1 AND severity <= 5),
  notes text,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Mental health mood entries
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

-- Mental health assessments
CREATE TABLE IF NOT EXISTS mental_health_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assessment_type varchar(50) NOT NULL CHECK (assessment_type IN ('edinburgh', 'phq9', 'gad7', 'custom')),
  score integer NOT NULL,
  responses jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_level varchar(20) NOT NULL CHECK (risk_level IN ('low', 'mild', 'moderate', 'severe')) DEFAULT 'low',
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Community posts
CREATE TABLE IF NOT EXISTS community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title varchar(255),
  content text NOT NULL,
  category varchar(100) NOT NULL DEFAULT 'general',
  tags text[] DEFAULT '{}',
  is_anonymous boolean DEFAULT false,
  is_support_request boolean DEFAULT false,
  likes_count integer DEFAULT 0,
  replies_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Community replies
CREATE TABLE IF NOT EXISTS community_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_anonymous boolean DEFAULT false,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Community likes
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

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  message text NOT NULL,
  type varchar(50) NOT NULL DEFAULT 'info',
  is_read boolean DEFAULT false,
  action_url varchar(500),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_health_records_user_id ON health_records(user_id);
CREATE INDEX IF NOT EXISTS idx_health_records_type ON health_records(record_type);
CREATE INDEX IF NOT EXISTS idx_health_records_recorded_at ON health_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_symptoms_user_id ON symptoms(user_id);
CREATE INDEX IF NOT EXISTS idx_symptoms_recorded_at ON symptoms(recorded_at);
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_id ON mood_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_entries_recorded_at ON mood_entries(recorded_at);
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON mental_health_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_completed_at ON mental_health_assessments(completed_at);
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_community_replies_post_id ON community_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();