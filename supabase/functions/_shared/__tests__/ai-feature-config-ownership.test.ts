import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const integrationsScreenSource = readFileSync(
  resolve(process.cwd(), 'src/features/config/integrations/IntegrationsScreen.tsx'),
  'utf8',
);
const followUpSource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/comm-whatsapp-generate-follow-up/index.ts'),
  'utf8',
);
const suggestReplySource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/comm-whatsapp-suggest-reply/index.ts'),
  'utf8',
);

test('features de IA são a única configuração persistida para os prompts do WhatsApp', () => {
  for (const source of [integrationsScreenSource, followUpSource, suggestReplySource]) {
    assert.doesNotMatch(source, /ai_follow_up_prompt|ai_reply_suggestion_prompt/);
  }

  assert.match(followUpSource, /loadFeatureConfig\(\s*supabaseAdmin,\s*AI_FEATURES\.FOLLOWUP_GENERATE/);
  assert.match(suggestReplySource, /loadFeatureConfig\(supabaseAdmin, AI_FEATURES\.MESSAGE_SUGGEST\)/);
});
