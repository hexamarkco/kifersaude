BEGIN;

-- The published holder-import migration uses this legacy function name. Keep
-- its migration immutable while routing the trigger to the same fail-closed
-- behavior already used for contract mutation audit rows.
CREATE OR REPLACE FUNCTION public._mcp_contract_audit_no_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION 'MCP_CONTRACT_AUDIT_IMMUTABLE' USING ERRCODE = '42501';
END;
$function$;

REVOKE ALL ON FUNCTION public._mcp_contract_audit_no_change() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
