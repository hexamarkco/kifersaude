/*
  # Align user_profiles with User Management users table

  ## Summary
  - Repoint user_profiles foreign keys from auth.users to user_management.users
  - Update the handle_new_user trigger function to honor User Management identifiers
  - Preserve backwards compatibility for existing users without the new metadata
*/

BEGIN;

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_id_fkey
  FOREIGN KEY (id)
  REFERENCES user_management.users(id)
  ON DELETE CASCADE;

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_created_by_fkey;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES user_management.users(id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  base_username text;
  candidate_username text;
  suffix integer := 0;
  assigned_role text;
  metadata jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  profile_id uuid;
  email_value text;
BEGIN
  profile_id := NULL;

  IF metadata ? 'user_management_id' THEN
    profile_id := NULLIF(metadata->>'user_management_id', '')::uuid;
  END IF;

  IF profile_id IS NULL AND metadata ? 'user_management_user_id' THEN
    profile_id := NULLIF(metadata->>'user_management_user_id', '')::uuid;
  END IF;

  IF profile_id IS NULL AND metadata ? 'user_id' THEN
    profile_id := NULLIF(metadata->>'user_id', '')::uuid;
  END IF;

  IF profile_id IS NULL THEN
    profile_id := NEW.id;
  END IF;

  IF metadata ? 'username' THEN
    base_username := lower(regexp_replace(metadata->>'username', '[^a-z0-9_.-]', '', 'gi'));
  ELSE
    email_value := COALESCE(NEW.email, metadata->>'email', '');
    base_username := lower(regexp_replace(split_part(email_value, '@', 1), '[^a-z0-9_.-]', '', 'gi'));
  END IF;

  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  candidate_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE username = candidate_username AND id <> profile_id) LOOP
    suffix := suffix + 1;
    candidate_username := base_username || suffix::text;
  END LOOP;

  assigned_role := COALESCE(metadata->>'role', 'observer');
  IF assigned_role NOT IN ('admin', 'observer') THEN
    assigned_role := 'observer';
  END IF;

  IF assigned_role = 'observer' AND NOT EXISTS (SELECT 1 FROM public.user_profiles) THEN
    assigned_role := 'admin';
  END IF;

  INSERT INTO public.user_profiles (id, email, username, role, created_by)
  VALUES (
    profile_id,
    COALESCE(NEW.email, metadata->>'email'),
    candidate_username,
    assigned_role,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, public.user_profiles.email),
        username = EXCLUDED.username,
        role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

COMMIT;
