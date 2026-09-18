import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildSandboxApproachMessages } from '../auto-contact-approach.ts';

test('usa a primeira mensagem do fluxo de abordagem configurado', () => {
  const messages = buildSandboxApproachMessages({
    messageTemplates: [
      { id: 'template-inicial', message: 'Oi {{primeiro_nome}}, vi seu interesse em uma cotação.' },
    ],
    flows: [
      {
        triggerType: 'lead_created',
        ativo: true,
        steps: [
          { actionType: 'send_message', delayValue: 4, delayUnit: 'hours', templateId: 'template-inicial' },
        ],
      },
    ],
  }, 'Magali Lemos');

  assert.deepEqual(messages, ['Oi Magali, vi seu interesse em uma cotação.']);
});

test('usa a mensagem customizada do primeiro passo enviavel', () => {
  const messages = buildSandboxApproachMessages({
    flows: [
      {
        triggerType: 'lead_created',
        ativo: true,
        steps: [
          { actionType: 'update_status', delayValue: 0, delayUnit: 'seconds' },
          { actionType: 'send_message', customMessage: { type: 'text', text: 'Oi {{nome}}, vamos conversar?' } },
        ],
      },
    ],
  }, 'Magali Lemos');

  assert.deepEqual(messages, ['Oi Magali Lemos, vamos conversar?']);
});
