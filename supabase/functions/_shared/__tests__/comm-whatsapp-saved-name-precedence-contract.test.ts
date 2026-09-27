import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261013150000_preserve_persisted_chat_saved_name.sql'),
  'utf8',
);

test('nome salvo no chat vence leituras temporarias do cache do provedor', () => {
  assert.match(migrationSource, /NULLIF\(btrim\(chat\.saved_contact_name\), ''\) AS saved_contact_name/);
  assert.match(migrationSource, /0 AS source_priority[\s\S]*chat_identity\.saved_contact_name AS display_name/);
  assert.match(migrationSource, /1 AS source_priority[\s\S]*candidates\.display_name/);
  assert.match(migrationSource, /resolved_names\.source_priority/);
});

test('resolvedor usa phone_number quando phone_digits nao esta preenchido', () => {
  assert.match(migrationSource, /NULLIF\(btrim\(chat\.phone_digits\), ''\)/);
  assert.match(migrationSource, /NULLIF\(btrim\(chat\.phone_number\), ''\)/);
});
