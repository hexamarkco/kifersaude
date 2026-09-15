BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;

SELECT plan(17);

SELECT ok(
  position('listed' in pg_get_constraintdef(oid)) > 0
    AND position('accessed' in pg_get_constraintdef(oid)) > 0,
  'document audit action constraint permits list and access events'
)
FROM pg_constraint
WHERE conrelid = 'public.mcp_contract_document_audit_log'::regclass
  AND conname = 'mcp_contract_document_audit_log_action_check';

SELECT ok(to_regprocedure('public._mcp_log_contract_document_read(uuid, jsonb, text)') IS NOT NULL, 'internal read-audit helper exists');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_log_contract_document_read(uuid, jsonb, text)'::regprocedure, 'EXECUTE'), 'service_role cannot call read-audit helper directly');
SELECT ok(position('_mcp_log_contract_document_read' in pg_get_functiondef('public.mcp_contract_documents_list(uuid, text, uuid, integer, timestamptz, uuid)'::regprocedure)) > 0, 'document list writes access audit events');
SELECT ok(position('_mcp_log_contract_document_read' in pg_get_functiondef('public.mcp_contract_document_get(uuid, uuid)'::regprocedure)) > 0, 'document get writes access audit events');

SELECT ok(has_function_privilege('service_role', 'public.mcp_contract_documents_list(uuid, text, uuid, integer, timestamptz, uuid)'::regprocedure, 'EXECUTE'), 'service_role can invoke document list');
SELECT ok(has_function_privilege('service_role', 'public.mcp_contract_document_get(uuid, uuid)'::regprocedure, 'EXECUTE'), 'service_role can invoke document get');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_contract_documents_list(uuid, text, uuid, integer, timestamptz, uuid)'::regprocedure, 'EXECUTE'), 'anon cannot invoke document list');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_contract_document_get(uuid, uuid)'::regprocedure, 'EXECUTE'), 'anon cannot invoke document get');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_contract_documents_list(uuid, text, uuid, integer, timestamptz, uuid)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke document list');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_contract_document_get(uuid, uuid)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke document get');

SELECT ok(position('document.storage_cleanup_completed_at IS NULL' in pg_get_functiondef('public.mcp_remove_contract_dependent(uuid, uuid, timestamptz, text)'::regprocedure)) > 0, 'dependent removal ignores fully cleaned document tombstones');
SELECT ok(position('document.storage_cleanup_completed_at IS NULL' in pg_get_functiondef('public.mcp_remove_contract_holder(uuid, uuid, timestamptz, text)'::regprocedure)) > 0, 'holder removal ignores fully cleaned document tombstones');
SELECT ok(position('FROM public.documents AS legacy_document' in pg_get_functiondef('public.mcp_remove_contract_dependent(uuid, uuid, timestamptz, text)'::regprocedure)) > 0, 'dependent removal preserves legacy document references');
SELECT ok(position('FROM public.documents AS legacy_document' in pg_get_functiondef('public.mcp_remove_contract_holder(uuid, uuid, timestamptz, text)'::regprocedure)) > 0, 'holder removal preserves legacy document references');
SELECT ok(has_function_privilege('service_role', 'public.mcp_remove_contract_dependent(uuid, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role can invoke dependent removal');
SELECT ok(has_function_privilege('service_role', 'public.mcp_remove_contract_holder(uuid, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role can invoke holder removal');

SELECT * FROM finish();
ROLLBACK;
