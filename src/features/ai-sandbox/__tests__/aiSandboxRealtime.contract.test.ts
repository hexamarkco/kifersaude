import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const serviceSource = readFileSync(resolve(process.cwd(), 'src/lib/aiSandboxChatService.ts'), 'utf8');
const screenSource = readFileSync(resolve(process.cwd(), 'src/features/ai-sandbox/AiSandboxChatScreen.tsx'), 'utf8');
const scenarioSource = readFileSync(resolve(process.cwd(), 'supabase/functions/ai-sandbox-run-scenario/index.ts'), 'utf8');
const migrationSource = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261007007000_enable_ai_sandbox_realtime.sql'), 'utf8');

test('sandbox publishes messages and final verdicts through Realtime', () => {
  for (const table of ['ai_sandbox_messages', 'ai_sandbox_test_runs', 'ai_sandbox_conversations']) {
    assert.match(migrationSource, new RegExp(`ADD TABLE public\\.${table}`));
    assert.match(serviceSource, new RegExp(`table: '${table}'`));
  }
  assert.match(serviceSource, /subscribeToConversation/);
  assert.match(screenSource, /aiSandboxChatService\.subscribeToConversation/);
});

test('manual and automated sandbox conversations share one list with a visible automated tag', () => {
  assert.match(serviceSource, /async listConversations\(\): Promise<AiSandboxConversation\[\]>/);
  assert.doesNotMatch(serviceSource, /\.eq\('is_automated'/);
  assert.doesNotMatch(screenSource, /showAutomated/);
  assert.match(screenSource, /Automatizado/);
  assert.match(screenSource, /conversation\.is_automated/);
});

test('scenario judge persists actionable playbook improvements for the UI', () => {
  assert.match(scenarioSource, /playbook_improvements/);
  assert.match(scenarioSource, /playbookImprovements: verdict\.playbookImprovements/);
  assert.match(scenarioSource, /const judgePlaybook = \[/);
  assert.match(scenarioSource, /AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS/);
  assert.match(screenSource, /Sugestões para o playbook/);
  assert.match(screenSource, /createAutomatedConversation/);
});
