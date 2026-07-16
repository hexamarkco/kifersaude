BEGIN;

DO $$
DECLARE
  profile_count integer;
BEGIN
  SELECT count(*)
  INTO profile_count
  FROM public.user_profiles;

  IF profile_count <> 1 THEN
    RAISE EXCEPTION 'Inbox access recovery requires exactly one user profile; found %.', profile_count;
  END IF;

  UPDATE public.user_profiles
  SET role = 'admin'
  WHERE role IS DISTINCT FROM 'admin';
END;
$$;

INSERT INTO public.profile_permissions (role, module, can_view, can_edit)
VALUES
  ('admin', 'whatsapp', true, true),
  ('admin', 'whatsapp-inbox', true, true)
ON CONFLICT (role, module) DO UPDATE
SET
  can_view = true,
  can_edit = true,
  updated_at = now();

COMMIT;
