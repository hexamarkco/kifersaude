// @vitest-environment node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { test } from 'vitest';

const sql = readFileSync('supabase/migrations/20261106184417_add_lead_approach_message_variations.sql', 'utf8');
const messages = [
  'Oi {{primeiro_nome}}, tudo bem? Sou a Luiza Kifer, *especialista em planos de saúde*.',
  'Vi que você demonstrou interesse em uma cotação e decidi te chamar por aqui para facilitar o envio das informações. 😊',
  'Você busca um plano só para você ou para mais alguém da família?',
].map((text) => ({ custom: { type: 'text', text } }));
const originalStep = { id: 'flow-step-1767987622968-f4d5d702433f4', actionType: 'send_message', messages,
  delayUnit: 'seconds', delayValue: 0 };
const originalFlow = { id: 'flow-1767987622968', name: 'Abordagem dos leads', triggerType: 'lead_created', ativo: true,
  steps: [originalStep, { id: 'status', actionType: 'update_status', statusToSet: 'Contato Inicial' }],
  scheduling: { startHour: '07:00', endHour: '22:00' }, conditions: [{ field: 'status', value: 'Novo' }],
  flowGraph: { nodes: [{ id: 'node', type: 'action', data: { step: originalStep } }], edges: [] } };
const settings = { enabled: true, autoSend: true, flows: [originalFlow, { id: 'other-flow', ativo: false }],
  messageTemplates: [{ id: 'template', message: 'Preservar' }], monitoring: { realtimeEnabled: true } };

test('migration cadastra dois pacotes, preserva configuração e é idempotente', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE integration_settings (id integer primary key, slug text, settings jsonb, updated_at timestamptz);');
    await db.query('INSERT INTO integration_settings VALUES (1, $1, $2, now()), (2, $3, $4, now())',
      ['whatsapp_auto_contact', JSON.stringify(settings), 'another-integration', '{"enabled":false}']);
    await db.exec(sql);
    const read = async () => (await db.query<{ settings: typeof settings }>('SELECT settings FROM integration_settings WHERE id=1')).rows[0].settings;
    const first = await read();
    const step = first.flows[0].steps![0] as typeof originalStep & { messageVariations: { id: string; messages: typeof messages }[] };
    assert.equal(step.messageVariations.length, 2);
    assert.ok(step.messageVariations.every((version) => version.messages.length === 3));
    assert.ok(step.messageVariations.every((version) => version.messages[0].custom.text.includes('{{primeiro_nome}}')));
    assert.deepEqual(step.messages, messages);
    assert.deepEqual(first.flows[0].flowGraph!.nodes[0].data.step, step);
    const withoutVersions = JSON.parse(JSON.stringify(first));
    delete withoutVersions.flows[0].steps[0].messageVariations;
    delete withoutVersions.flows[0].flowGraph.nodes[0].data.step.messageVariations;
    assert.deepEqual(withoutVersions, settings);
    assert.deepEqual((await db.query('SELECT settings FROM integration_settings WHERE id=2')).rows[0].settings, { enabled: false });
    await db.exec(sql);
    assert.deepEqual(await read(), first);
    await db.query("UPDATE integration_settings SET settings = jsonb_set(settings, '{flows,0,steps,0,messages,0,custom,text}', to_jsonb('Texto atualizado'::text)) WHERE id=1");
    // Reapplying a completed seed never resets later operator edits.
    const edited = await read();
    await db.exec(sql);
    assert.deepEqual(await read(), edited);
  } finally {
    await db.close();
  }
}, 30000);

test('migration aborta se a abordagem lida mudou antes da configuração', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE integration_settings (id integer primary key, slug text, settings jsonb, updated_at timestamptz);');
    const changed = JSON.parse(JSON.stringify(settings));
    changed.flows[0].steps[0].messages[0].custom.text = 'Outra abordagem';
    await db.query('INSERT INTO integration_settings VALUES (1, $1, $2, now())', ['whatsapp_auto_contact', JSON.stringify(changed)]);
    await assert.rejects(db.exec(sql), /abordagem original mudou/);
    assert.deepEqual((await db.query('SELECT settings FROM integration_settings')).rows[0].settings, changed);
  } finally {
    await db.close();
  }
}, 30000);
