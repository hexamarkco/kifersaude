BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_profiles profile
    WHERE NOT EXISTS (
      SELECT 1
      FROM auth.users auth_user
      WHERE auth_user.id = profile.id
    )
  ) THEN
    RAISE EXCEPTION 'Cannot migrate user_profiles: profile IDs are not backed by auth.users.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_profiles profile
    WHERE profile.created_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM auth.users auth_user
        WHERE auth_user.id = profile.created_by
      )
  ) THEN
    RAISE EXCEPTION 'Cannot migrate user_profiles: created_by IDs are not backed by auth.users.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.access_profiles
    WHERE slug = 'observer'
  ) THEN
    RAISE EXCEPTION 'Cannot migrate user_profiles: observer access profile is missing.';
  END IF;
END $$;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_created_by_fkey;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES auth.users(id);

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
BEGIN
  base_username := lower(regexp_replace(
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'username', ''),
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    '[^a-z0-9_.-]',
    '',
    'gi'
  ));

  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  candidate_username := base_username;
  WHILE EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE username = candidate_username
      AND id <> NEW.id
  ) LOOP
    suffix := suffix + 1;
    candidate_username := base_username || suffix::text;
  END LOOP;

  INSERT INTO public.user_profiles (id, email, username, role, created_by)
  VALUES (NEW.id, NEW.email, candidate_username, 'observer', NULL)
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, public.user_profiles.email),
        username = EXCLUDED.username;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_access_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  cached_role text;
  resolved_role text;
BEGIN
  cached_role := current_setting('app.rls_user_role', true);
  IF cached_role IS NOT NULL THEN
    RETURN NULLIF(cached_role, '');
  END IF;

  SELECT role
  INTO resolved_role
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;

  PERFORM set_config('app.rls_user_role', COALESCE(resolved_role, ''), true);
  RETURN resolved_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_access_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  cached_admin text;
  is_admin boolean;
BEGIN
  cached_admin := current_setting('app.rls_is_admin', true);
  IF cached_admin IS NOT NULL THEN
    RETURN cached_admin = 'true';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles profile
    JOIN public.access_profiles access_profile ON access_profile.slug = profile.role
    WHERE profile.id = auth.uid()
      AND access_profile.is_admin = true
  )
  INTO is_admin;

  PERFORM set_config('app.rls_is_admin', is_admin::text, true);
  RETURN is_admin;
END;
$$;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins can update any profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profiles;

COMMIT;
