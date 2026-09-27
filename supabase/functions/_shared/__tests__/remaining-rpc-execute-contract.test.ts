import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260927201229_restrict_remaining_internal_rpc_execute.sql'),
  'utf8',
);

const serviceOnlyFunctions = [
  'ai_lead_is_waiting_for_quote',
  'automation_flows_health',
  'cleanup_logs_7d',
  'debug_comm_auth',
  'invoke_process_pending_leads',
  'resolve_comm_whatsapp_campaign_stop_on_reply',
  'trigger_lead_processing_now',
];

const authenticatedFunctions = [
  'create_ai_feature_config',
  'current_user_access_role',
  'current_user_can_view_comm_whatsapp',
  'get_comm_whatsapp_campaign_failure_reasons',
  'replace_cotador_produto_rede_hospitalar',
  'user_is_admin',
];

test('fecha os RPCs internos restantes sem retirar a API autenticada', () => {
  for (const functionName of serviceOnlyFunctions) {
    assert.match(migrationSource, new RegExp(`REVOKE ALL ON FUNCTION public\\.${functionName}\\(`));
    assert.match(migrationSource, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*? TO service_role;`));
  }

  for (const functionName of authenticatedFunctions) {
    assert.match(migrationSource, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${functionName}\\(`));
    assert.match(migrationSource, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*? TO authenticated, service_role;`));
  }

  assert.doesNotMatch(migrationSource, /GRANT EXECUTE[\s\S]*TO (?:PUBLIC|anon)/);
  assert.match(migrationSource, /Public login and public-link\/form counters intentionally remain exposed/);
});
