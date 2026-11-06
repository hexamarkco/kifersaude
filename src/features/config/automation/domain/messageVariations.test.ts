import assert from 'node:assert/strict';
import { test } from 'vitest';
import { hasIncompleteMessageVariations, normalizeFlowMessageVariations } from './messageVariations';
import { normalizeFlowMessageVariations as normalizeEdge } from '../../../../../supabase/functions/leads-api/domain/message-variations';
import { normalizeAutoContactSettings } from '../../../../lib/autoContactService';

const templates = [{ id: 'template', name: 'Saudação', message: 'Olá!' }];
const variations = [{ id: 'v2', messages: [
  { custom: { type: 'text', text: 'Olá {{primeiro_nome}}!' } },
  { templateId: 'template' },
  { ai: { instruction: 'Faça uma pergunta' } },
] }];

test('mantém paridade browser/worker para configurações legadas, completas e inválidas', () => {
  for (const value of [undefined, [], variations, [null, {}, { id: 'primary', messages: [{ templateId: 'missing' }] }],
    [{ id: 'v', messages: [] }, { id: 'v', messages: [null, { custom: { type: 'image', mediaUrl: 'https://example.com/image.jpg' } }] }]]) {
    assert.deepEqual(normalizeFlowMessageVariations(value, templates, 'template'), normalizeEdge(value, templates, 'template'));
  }
});

test('preserva as alternativas ao salvar, serializar e reabrir a configuração', () => {
  const raw = { messageTemplates: templates, flows: [{ id: 'flow', name: 'Abordagem', steps: [{
    id: 'step', actionType: 'send_message', messages: [{ templateId: 'template' }], messageVariations: variations,
  }] }] };
  const first = normalizeAutoContactSettings(raw);
  const reopened = normalizeAutoContactSettings(JSON.parse(JSON.stringify(first)));
  assert.deepEqual(reopened.flows[0].steps[0].messageVariations, normalizeFlowMessageVariations(variations, templates, 'template'));
  assert.deepEqual(reopened.flows[0].steps[0].messages, [{ templateId: 'template' }]);
});

test('exige conteúdo em todas as versões sem eliminar a versão incompleta', () => {
  const normalized = normalizeFlowMessageVariations([{ id: 'empty', messages: [] }], templates, 'template');
  assert.equal(normalized?.length, 1);
  assert.equal(hasIncompleteMessageVariations(normalized, templates), true);
  assert.equal(hasIncompleteMessageVariations(normalizeFlowMessageVariations(variations, templates, 'template'), templates), false);
  assert.equal(hasIncompleteMessageVariations([{ id: 'ai', messages: [{ ai: { instruction: ' ' } }] }], templates), true);
});
