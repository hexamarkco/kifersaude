BEGIN;

-- Estas RPCs sao usadas pelos workers e pelos caminhos internos do servidor.
-- Nao devem ficar disponiveis via Data API para anon ou authenticated.
REVOKE ALL ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text,
  text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text,
  text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb
) TO service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text,
  text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb,
  text, text, text, text, bigint, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text,
  text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb,
  text, text, text, text, bigint, integer, text
) TO service_role;

REVOKE ALL ON FUNCTION public.comm_whatsapp_persist_message_internal(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text,
  text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb,
  text, text, text, text, bigint, integer, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_persist_message_internal(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text,
  text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb,
  text, text, text, text, bigint, integer, text
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
