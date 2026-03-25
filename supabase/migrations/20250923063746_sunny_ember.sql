/*
  # Health Records and Vital Signs

  1. New Tables
    - `health_records`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `record_type` (text) - temperature, heart_rate, blood_pressure, weight, etc.
      - `value` (numeric)
      - `unit` (text)
      - `notes` (text)
      - `recorded_at` (timestamp)
      - `created_at` (timestamp)

    - `symptoms`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `symptom_name` (text)
      - `severity` (integer 1-5)
      - `notes` (text)
      - `recorded_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to manage their own records
*/

-- Create health records table
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

-- Create symptoms table
CREATE TABLE IF NOT EXISTS symptoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  symptom_name text NOT NULL,
  severity integer NOT NULL CHECK (severity >= 1 AND severity <= 5),
  notes text,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptoms ENABLE ROW LEVEL SECURITY;

-- Health records policies
CREATE POLICY "Users can view own health records"
  ON health_records
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own health records"
  ON health_records
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own health records"
  ON health_records
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own health records"
  ON health_records
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Symptoms policies
CREATE POLICY "Users can view own symptoms"
  ON symptoms
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own symptoms"
  ON symptoms
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own symptoms"
  ON symptoms
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own symptoms"
  ON symptoms
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS health_records_user_id_idx ON health_records(user_id);
CREATE INDEX IF NOT EXISTS health_records_type_idx ON health_records(record_type);
CREATE INDEX IF NOT EXISTS health_records_recorded_at_idx ON health_records(recorded_at);
CREATE INDEX IF NOT EXISTS symptoms_user_id_idx ON symptoms(user_id);
CREATE INDEX IF NOT EXISTS symptoms_recorded_at_idx ON symptoms(recorded_at);