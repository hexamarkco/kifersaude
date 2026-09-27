BEGIN;

REVOKE ALL ON FUNCTION public.comm_whatsapp_find_campaign_replies(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_find_campaign_replies(jsonb)
  TO service_role;

COMMIT;
