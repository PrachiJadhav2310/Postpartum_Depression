/*
  # Fix User Profile Insert Policy

  1. Changes
    - Drop existing restrictive insert policy
    - Create new policy that allows authenticated users to insert their own profile
    - This fixes the "Database error saving new user" issue
  
  2. Security
    - Users can only insert a profile with their own user ID
    - RLS still protects against unauthorized access
*/

-- Drop the existing insert policy if it exists
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Create a new insert policy that allows the user to create their profile
-- The key is using auth.uid() in the WITH CHECK clause
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Also ensure the trigger function has proper permissions
-- Recreate it with SECURITY DEFINER to ensure it can insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'New User'))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();