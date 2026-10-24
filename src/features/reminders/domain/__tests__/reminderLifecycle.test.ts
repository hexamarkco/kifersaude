import assert from 'node:assert/strict';
import { test } from 'vitest';
import { isReminderPending, normalizeReminderLifecyclePatch } from '../reminderLifecycle';

test('encerramento legado não depende de uma data de conclusão conhecida', () => {
  assert.equal(isReminderPending({ lido: true, cancelled_at: null }), false);
  assert.equal(isReminderPending({ lido: false, cancelled_at: '2026-10-24T12:00:00Z' }), false);
  assert.equal(isReminderPending({ lido: false, cancelled_at: null }), true);
  assert.equal(isReminderPending({ lido: null }), false);
});

test('novas conclusões usam o instante real; reabertura limpa a data', () => {
  const before = Date.now();
  const completed = normalizeReminderLifecyclePatch({ lido: true });
  assert.equal(completed.lido, true);
  assert.ok(typeof completed.concluido_em === 'string');
  assert.ok(Date.parse(completed.concluido_em) >= before && Date.parse(completed.concluido_em) <= Date.now());
  assert.deepEqual(normalizeReminderLifecyclePatch({ lido: false, concluido_em: '2026-10-23T12:00:00Z' }), { lido: false, concluido_em: null });
  assert.deepEqual(normalizeReminderLifecyclePatch({ data_lembrete: '2026-10-26T12:00:00Z' }), { data_lembrete: '2026-10-26T12:00:00Z' });
  assert.equal(normalizeReminderLifecyclePatch({ lido: true, concluido_em: '2026-10-23T12:00:00Z' }).concluido_em, '2026-10-23T12:00:00Z');
});
