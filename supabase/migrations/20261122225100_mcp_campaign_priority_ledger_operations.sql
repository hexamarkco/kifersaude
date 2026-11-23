-- Extend existing MCP campaign idempotency/audit ledger with non-sending priority and global-quota operations.
BEGIN;
ALTER TABLE public.mcp_comm_whatsapp_campaign_requests
  DROP CONSTRAINT IF EXISTS mcp_comm_whatsapp_campaign_requests_operation_check;
ALTER TABLE public.mcp_comm_whatsapp_campaign_requests
  ADD CONSTRAINT mcp_comm_whatsapp_campaign_requests_operation_check
  CHECK (operation = ANY (ARRAY[
    'create','update','import_contacts','remove_contact','activate','pause','resume','schedule','delete',
    'set_priority','set_global_limit'
  ]::text[]));
COMMIT;
