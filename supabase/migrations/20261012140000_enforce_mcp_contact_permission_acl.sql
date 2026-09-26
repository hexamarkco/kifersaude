BEGIN;

-- Essas funções são chamadas pela Edge Function do MCP com service_role. Elas
-- não fazem parte da API do frontend e não devem ficar disponíveis via Data API.
REVOKE EXECUTE ON FUNCTION
  public.mcp_get_contact_permission(uuid, text, text),
  public.mcp_set_contact_permission(uuid, text, text, text, text, text, text, jsonb, uuid, timestamptz),
  public.mcp_bulk_set_contact_permission(uuid, text, jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.mcp_get_contact_permission(uuid, text, text),
  public.mcp_set_contact_permission(uuid, text, text, text, text, text, text, jsonb, uuid, timestamptz),
  public.mcp_bulk_set_contact_permission(uuid, text, jsonb)
TO service_role;

COMMIT;
