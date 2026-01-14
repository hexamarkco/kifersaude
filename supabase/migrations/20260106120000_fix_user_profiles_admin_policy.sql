/*
  # Fix user_profiles admin update policy recursion

  1. Problem
    - "Admins can update any profile" policy queries user_profiles directly
    - Row Level Security evaluates the policy per row, triggering infinite recursion (42P17)

  2. Solution
    - Replace the policy with a version that uses a SECURITY DEFINER helper function
    - The helper function checks the current user's role without re-entering RLS

  3. Security
    - Helper function only returns whether the requester is an admin
    - Non-admin users continue to be limited to their own profile updates
*/

-- Drop the problematic policy if it exists
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;

-- Ensure any previous helper is removed before recreating it
DROP FUNCTION IF EXISTS public.user_is_admin();

-- Helper function executed with definer privileges to bypass RLS on user_profiles
CREATE OR REPLACE FUNCTION public.user_is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  current_role TEXT;
BEGIN
  SELECT role INTO current_role
  FROM public.user_profiles
  WHERE id = auth.uid();

  RETURN COALESCE(current_role, '') = 'admin';
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_is_admin() TO authenticated;

-- Recreate the admin update policy using the helper function to avoid recursion
CREATE POLICY "Admins can update any profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (public.user_is_admin())
  WITH CHECK (public.user_is_admin());
