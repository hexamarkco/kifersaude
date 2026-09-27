import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const workerSource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/comm-whatsapp-campaign-worker/index.ts'),
  'utf8',
);
const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260927144205_optimize_campaign_response_reconciliation.sql'),
  'utf8',
);
const permissionMigrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260927144742_restrict_campaign_response_reconciliation_rpc.sql'),
  'utf8',
);
const reconcileSource = workerSource.slice(
  workerSource.indexOf('async function reconcileResponses'),
  workerSource.indexOf('async function reconcileAcceptedCampaignPersistences'),
);

test('reconcilia respostas de campanha em uma chamada de banco por lote', () => {
  assert.match(workerSource, /comm_whatsapp_find_campaign_replies/);
  assert.match(workerSource, /const repliesByTargetId = await findVisibleInboundCampaignReplies/);
  assert.doesNotMatch(reconcileSource, /await findVisibleInboundCampaignReply\(/);
});

test('RPC de respostas preserva as regras de resposta visível e janela mínima', () => {
  assert.match(migrationSource, /target\.sent_at \+ interval '20 seconds'/);
  assert.match(migrationSource, /message\.direction = 'inbound'/);
  assert.match(migrationSource, /comm_whatsapp_message_preview_text/);
  assert.match(migrationSource, /LIMIT 10/);
  assert.match(migrationSource, /GRANT EXECUTE ON FUNCTION public\.comm_whatsapp_find_campaign_replies\(jsonb\) TO service_role/);
  assert.match(permissionMigrationSource, /FROM PUBLIC, anon, authenticated/);
  assert.match(permissionMigrationSource, /TO service_role/);
});
