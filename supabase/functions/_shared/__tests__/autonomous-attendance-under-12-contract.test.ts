import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261007004000_add_under_12_autonomous_attendance_rule.sql'),
  'utf8',
);
const scenarioSource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/ai-sandbox-run-scenario/index.ts'),
  'utf8',
);

test('Resposta Autônoma receives the fixed eligibility rule for children under 12', () => {
  assert.match(migrationSource, /CRIANÇA MENOR DE 12 ANOS/);
  assert.match(migrationSource, /não trabalhamos com operadoras que aceitem criança menor de 12 anos como titular sozinha/);
  assert.match(migrationSource, /adulto precisa entrar no plano como titular e a criança entra como dependente/);
  assert.match(migrationSource, /há mensalidade para o adulto e para a criança/);
  assert.match(migrationSource, /sem insistir em idade, cidade, CNPJ\/MEI ou outros dados/);
});

test('automated scenarios apply the child-under-12 rule only to child-only quotes', () => {
  assert.match(scenarioSource, /14\. Se o lead queria plano EXCLUSIVAMENTE para crianca menor de 12 anos/);
  assert.match(scenarioSource, /se a cotacao ja incluia um adulto/);
  assert.match(scenarioSource, /mencionar titular, dependente ou mensalidade sem o lead perguntar e uma violacao/);
  assert.match(scenarioSource, /collectDeterministicViolations/);
});
