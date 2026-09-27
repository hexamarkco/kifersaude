import assert from 'node:assert/strict';
import { test } from 'vitest';

import { formatDashboardRecentChatMeta } from '../dashboardPresentation';

test('não mostra Contato privado como telefone de uma conversa sem número', () => {
  assert.equal(formatDashboardRecentChatMeta('Contato privado', '25/09, 17:25'), '25/09, 17:25');
});

test('mantém telefone e data quando o número está disponível', () => {
  assert.equal(
    formatDashboardRecentChatMeta('+55 (21) 99999-9999', '27/09, 19:17'),
    '+55 (21) 99999-9999 · 27/09, 19:17',
  );
});
