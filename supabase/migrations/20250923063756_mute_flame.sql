/*
  # Mental Health Tracking

  1. New Tables
    - `mood_entries`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `mood_score` (integer 1-10)
      - `energy_level` (integer 1-10)
      - `anxiety_level` (integer 1-10)
      - `notes` (text)
      - `recorded_at` (timestamp)
      - `created_at` (timestamp)

    - `mental_health_assessments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `assessment_type` (text) - edinburgh, phq9, gad7
      - `score` (integer)
      - `responses` (jsonb)
      - `risk_level` (text) - low, mild, moderate, severe
      - `completed_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to manage their own data
*/

-- Create mood entries table
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

-- Create mental health assessments table
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

-- Enable RLS
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mental_health_assessments ENABLE ROW LEVEL SECURITY;

-- Mood entries policies
CREATE POLICY "Users can view own mood entries"
  ON mood_entries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own mood entries"
  ON mood_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own mood entries"
  ON mood_entries
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own mood entries"
  ON mood_entries
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Mental health assessments policies
CREATE POLICY "Users can view own assessments"
  ON mental_health_assessments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own assessments"
  ON mental_health_assessments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own assessments"
  ON mental_health_assessments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS mood_entries_user_id_idx ON mood_entries(user_id);
CREATE INDEX IF NOT EXISTS mood_entries_recorded_at_idx ON mood_entries(recorded_at);
CREATE INDEX IF NOT EXISTS assessments_user_id_idx ON mental_health_assessments(user_id);
CREATE INDEX IF NOT EXISTS assessments_completed_at_idx ON mental_health_assessments(completed_at);