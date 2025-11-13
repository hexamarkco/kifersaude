/*
  # Add username column to user_profiles

  ## Summary
  - Adds a dedicated username for authentication separate from email
  - Backfills usernames for existing profiles
  - Ensures uniqueness and non-null constraint on usernames
  - Updates handle_new_user trigger function to auto-generate usernames
*/

BEGIN;

-- Add username column if it does not exist
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS username text;

-- Populate usernames for existing rows using the email local part
WITH to_update AS (
  SELECT id,
         COALESCE(
           NULLIF(
             lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9_.-]', '', 'gi')),
             ''
           ),
           'user'
         ) AS base_username
  FROM user_profiles
  WHERE username IS NULL
)
UPDATE user_profiles up
SET username = (
  SELECT CASE
           WHEN gs = 0 THEN tu.base_username
           ELSE tu.base_username || gs::text
         END AS candidate
  FROM generate_series(0, 999) AS gs
  WHERE NOT EXISTS (
    SELECT 1
    FROM user_profiles other
    WHERE other.username = CASE
                             WHEN gs = 0 THEN tu.base_username
                             ELSE tu.base_username || gs::text
                           END
      AND other.id <> up.id
  )
  ORDER BY LENGTH(CASE
                    WHEN gs = 0 THEN tu.base_username
                    ELSE tu.base_username || gs::text
                  END),
           CASE
             WHEN gs = 0 THEN tu.base_username
             ELSE tu.base_username || gs::text
           END
  LIMIT 1
)
FROM to_update tu
WHERE up.id = tu.id;

-- Guarantee uniqueness and presence
ALTER TABLE user_profiles
  ALTER COLUMN username SET NOT NULL;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_username_key UNIQUE (username);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- Update handle_new_user trigger to include username generation
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
BEGIN
  IF NEW.raw_user_meta_data ? 'username' THEN
    base_username := lower(regexp_replace(NEW.raw_user_meta_data->>'username', '[^a-z0-9_.-]', '', 'gi'));
  ELSE
    base_username := lower(regexp_replace(split_part(COALESCE(NEW.email, ''), '@', 1), '[^a-z0-9_.-]', '', 'gi'));
  END IF;

  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  candidate_username := base_username;

  WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE username = candidate_username) LOOP
    suffix := suffix + 1;
    candidate_username := base_username || suffix::text;
  END LOOP;

  assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'observer');
  IF assigned_role NOT IN ('admin', 'observer') THEN
    assigned_role := 'observer';
  END IF;

  IF assigned_role = 'observer' AND NOT EXISTS (SELECT 1 FROM public.user_profiles) THEN
    assigned_role := 'admin';
  END IF;

  INSERT INTO public.user_profiles (id, email, username, role, created_by)
  VALUES (
    NEW.id,
    NEW.email,
    candidate_username,
    assigned_role,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        username = EXCLUDED.username,
        role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

COMMIT;
