import assert from 'node:assert/strict';
import { test } from 'vitest';

import { resolveScheduledDestinationDisplayName } from './destination';

test('prioriza o nome salvo sobre a identidade recebida do WhatsApp', () => {
  assert.equal(
    resolveScheduledDestinationDisplayName({
      chat: {
        savedContactName: 'Mariangela',
        displayName: 'Mariangela - Cliente',
      },
      scheduledDisplayName: 'Nome antigo do agendamento',
      phoneDigits: '5521982965495',
      isGroup: false,
    }),
    'Mariangela',
  );
});

test('usa o nome salvo no agendamento quando a conversa não existe', () => {
  assert.equal(
    resolveScheduledDestinationDisplayName({
      chat: null,
      scheduledDisplayName: 'Mariangela - Cliente',
      phoneDigits: '5521982965495',
      isGroup: false,
    }),
    'Mariangela - Cliente',
  );
});

test('não exibe nome de contato em grupo', () => {
  assert.equal(
    resolveScheduledDestinationDisplayName({
      chat: { savedContactName: 'Nome pessoal', displayName: 'Grupo antigo' },
      scheduledDisplayName: 'Outro nome',
      phoneDigits: '',
      isGroup: true,
    }),
    'Grupo',
  );
});
