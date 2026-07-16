BEGIN;

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
  authenticated_email text;
BEGIN
  cached_role := current_setting('app.rls_user_role', true);
  IF cached_role IS NOT NULL THEN
    RETURN NULLIF(cached_role, '');
  END IF;

  authenticated_email := lower(NULLIF(auth.jwt()->>'email', ''));

  SELECT profile.role
  INTO resolved_role
  FROM public.user_profiles profile
  WHERE profile.id = auth.uid()
     OR (authenticated_email IS NOT NULL AND lower(profile.email) = authenticated_email)
  ORDER BY CASE WHEN profile.id = auth.uid() THEN 0 ELSE 1 END
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
  authenticated_email text;
BEGIN
  cached_admin := current_setting('app.rls_is_admin', true);
  IF cached_admin IS NOT NULL THEN
    RETURN cached_admin = 'true';
  END IF;

  authenticated_email := lower(NULLIF(auth.jwt()->>'email', ''));

  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles profile
    JOIN public.access_profiles access_profile ON access_profile.slug = profile.role
    WHERE access_profile.is_admin = true
      AND (
        profile.id = auth.uid()
        OR (authenticated_email IS NOT NULL AND lower(profile.email) = authenticated_email)
      )
  )
  INTO is_admin;

  PERFORM set_config('app.rls_is_admin', is_admin::text, true);
  RETURN is_admin;
END;
$$;

REVOKE ALL ON FUNCTION public.current_user_access_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_access_role() TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_is_access_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_access_admin() TO authenticated;

COMMIT;
