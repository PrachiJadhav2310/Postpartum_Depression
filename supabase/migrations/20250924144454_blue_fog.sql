@@ .. @@
   created_at timestamptz DEFAULT now()
 );

+-- Health predictions table
+CREATE TABLE IF NOT EXISTS health_predictions (
+  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
+  overall_risk_score integer NOT NULL DEFAULT 0,
+  needs_consultation boolean DEFAULT false,
+  urgent_care boolean DEFAULT false,
+  mental_health_risk integer DEFAULT 0,
+  physical_health_risk integer DEFAULT 0,
+  recommendations jsonb DEFAULT '[]'::jsonb,
+  prediction_data jsonb DEFAULT '{}'::jsonb,
+  created_at timestamptz DEFAULT now()
+);
+
 -- Create indexes for better performance
 CREATE INDEX IF NOT EXISTS idx_health_records_user_id ON health_records(user_id);
@@ .. @@
 CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
 CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
+CREATE INDEX IF NOT EXISTS idx_health_predictions_user_id ON health_predictions(user_id);
+CREATE INDEX IF NOT EXISTS idx_health_predictions_created_at ON health_predictions(created_at);