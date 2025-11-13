/*
  # Controlled email lookup by username

  ## Summary
  - Creates a SECURITY DEFINER function to return the email for a given username
  - Limits the output to a single email value without exposing other columns
  - Grants EXECUTE privileges to the anon role for RPC access while preserving table RLS
*/

BEGIN;

CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT up.email
  INTO v_email
  FROM public.user_profiles AS up
  WHERE up.username = p_username
  ORDER BY up.id
  LIMIT 1;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_by_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon;

COMMIT;
