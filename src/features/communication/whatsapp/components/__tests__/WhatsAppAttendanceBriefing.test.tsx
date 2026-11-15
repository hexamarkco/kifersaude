import { act, useState } from 'react';
import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { render } from '../../../../../testing-library/react';
import { WhatsAppAttendanceBriefing } from '../WhatsAppAttendanceBriefing';
import { presentAttendanceBriefing, type AttendanceBriefing } from '../../domain/attendanceBriefing';

type LoadMock = {
  (chatId: string, leadId: string): Promise<AttendanceBriefing | null>;
  mockReset: () => void;
  mockResolvedValue: (value: AttendanceBriefing | null) => LoadMock;
  mockResolvedValueOnce: (value: AttendanceBriefing | null) => LoadMock;
  mockRejectedValueOnce: (value: Error) => LoadMock;
  mockReturnValueOnce: (value: Promise<AttendanceBriefing>) => LoadMock;
  mock: { calls: [string, string][] };
};
const mocks = vi.hoisted(() => ({ load: vi.fn() as unknown as LoadMock }));
vi.mock('../../data/attendanceRepository', () => ({ loadAttendanceBriefing: mocks.load }));
const memory = { attendanceV2: { version: 2 }, briefing: { confirmed: { intent: 'pf_to_mei', goal: 'Manter Leve Saúde e mudar PF para MEI',
  beneficiaries: [{ id: 'one', label: 'cliente', age: 80 }, { id: 'two', label: 'esposa', age: 80 }], companyType: 'mei' },
pending: ['companyPresence'], conflicts: [], review: ['product_eligibility'], reason: 'product_eligibility' }, v2Decision: { handoffCode: 'PRECISA_HUMANO' } };
const briefing = presentAttendanceBriefing(memory, '2026-11-14T12:00:00Z')!;
function ConversationHarness({ capture }: { capture: (select: (id: string) => void) => void }) {
  const [id, setId] = useState('old');
  capture(setId);
  return <WhatsAppAttendanceBriefing chatId={id} leadId={`${id}-lead`} handedOff />;
}

test('presents internal intent, both equal ages and pending fields in business language without a send action', async () => {
  mocks.load.mockReset();
  mocks.load.mockResolvedValue(briefing);
  const view = render(<WhatsAppAttendanceBriefing chatId="chat" leadId="lead" handedOff />);
  await act(async () => undefined);
  const text = view.container.textContent ?? '';
  assert.ok(text.includes('Atendimento transferido com pontos a conferir'));
  assert.ok(text.includes('Manter Leve Saúde e mudar PF para MEI'));
  assert.equal(text.match(/80 anos/g)?.length, 2);
  assert.ok(text.includes('Ainda falta confirmar'));
  assert.doesNotMatch(text, /product_eligibility|PRECISA_HUMANO|companyPresence/);
  assert.deepEqual(Array.from(view.container.querySelectorAll('button')).map((button) => button.textContent), ['Atualizar resumo']);
  view.unmount();
});
test('empty or malformed memory is not displayed as successful qualification', async () => {
  mocks.load.mockReset();
  assert.equal(presentAttendanceBriefing({}, 'today'), null);
  const invalid = presentAttendanceBriefing({ ...memory, v2Decision: { handoffCode: 'QUALIFICACAO_COMPLETA' } }, 'today');
  assert.equal(invalid?.qualificationComplete, false);
  mocks.load.mockResolvedValue(null);
  const view = render(<WhatsAppAttendanceBriefing chatId="legacy" leadId="lead" handedOff />);
  await act(async () => undefined);
  assert.equal(view.container.textContent, '');
  view.unmount();
});
test('switching chats discards a late previous response and never shows another leads summary', async () => {
  mocks.load.mockReset();
  let resolveOld: (value: AttendanceBriefing) => void = () => undefined;
  const old = new Promise<AttendanceBriefing>((resolve) => { resolveOld = resolve; });
  mocks.load.mockReturnValueOnce(old).mockResolvedValueOnce({ ...briefing, reason: 'Resumo da nova conversa.' });
  let selectChat: (id: string) => void = () => undefined;
  const view = render(<ConversationHarness capture={(select) => { selectChat = select; }} />);
  await act(async () => { selectChat('new'); });
  await act(async () => { resolveOld({ ...briefing, reason: 'Resumo que não deve aparecer.' }); });
  assert.ok(view.container.textContent?.includes('Resumo da nova conversa.'));
  assert.ok(!view.container.textContent?.includes('Resumo que não deve aparecer.'));
  assert.deepEqual(mocks.load.mock.calls[mocks.load.mock.calls.length - 1], ['new', 'new-lead']);
  view.unmount();
});
test('a read failure offers retry and does not claim qualification success', async () => {
  mocks.load.mockReset();
  mocks.load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(briefing);
  const view = render(<WhatsAppAttendanceBriefing chatId="chat" leadId="lead" handedOff />);
  await act(async () => undefined);
  assert.ok(view.container.querySelector('[role="alert"]')?.textContent?.includes('Não foi possível'));
  await act(async () => { view.container.querySelector('button')?.click(); });
  assert.ok(view.container.textContent?.includes('Resumo do atendimento'));
  view.unmount();
});
