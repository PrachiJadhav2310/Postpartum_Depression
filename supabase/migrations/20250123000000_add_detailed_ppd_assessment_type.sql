/*
  # Add detailed_ppd to assessment_type constraint
  
  This migration adds 'detailed_ppd' as a valid assessment_type value
  to support the new detailed assessment with BERT-based predictions.
*/

-- Drop the existing check constraint
ALTER TABLE mental_health_assessments 
DROP CONSTRAINT IF EXISTS mental_health_assessments_assessment_type_check;

-- Add new constraint with detailed_ppd included
ALTER TABLE mental_health_assessments 
ADD CONSTRAINT mental_health_assessments_assessment_type_check 
CHECK (assessment_type IN ('edinburgh', 'phq9', 'gad7', 'custom', 'detailed_ppd'));
