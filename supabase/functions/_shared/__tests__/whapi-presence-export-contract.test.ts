import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'vitest';

const sharedSource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/_shared/comm-whatsapp.ts'),
  'utf8',
);
const presenceFunctionSource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/comm-whatsapp-presence/index.ts'),
  'utf8',
);

describe('contrato da presenca do WhatsApp', () => {
  test('exporta pelo agregador todos os helpers usados pela Edge Function', () => {
    assert.match(
      sharedSource,
      /import \{[\s\S]*isWhapiPresenceSnapshotStale[\s\S]*\} from '\.\/whapi-presence-parser\.ts';/,
    );
    assert.match(
      sharedSource,
      /export \{[\s\S]*isWhapiPresenceSnapshotStale[\s\S]*\};/,
    );
    assert.match(
      presenceFunctionSource,
      /isWhapiPresenceSnapshotStale[\s\S]*from '\.\.\/_shared\/comm-whatsapp\.ts';/,
    );
  });
});
