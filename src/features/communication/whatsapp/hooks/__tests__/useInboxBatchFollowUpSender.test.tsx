import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import type { BatchFollowUpSendItem, BatchFollowUpSendProgress } from '../../domain/batchFollowUpTypes';
import { useInboxBatchFollowUpSender } from '../useInboxBatchFollowUpSender';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockResolvedValueOnce: (value: unknown) => MockFunction;
  mockRejectedValueOnce: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  sendText: vi.fn() as unknown as MockFunction,
  updateLeadStatus: vi.fn() as unknown as MockFunction,
  clearAgenda: vi.fn() as unknown as MockFunction,
  scheduleFollowUp: vi.fn() as unknown as MockFunction,
  approveSchedule: vi.fn() as unknown as MockFunction,
  markRemindersRead: vi.fn() as unknown as MockFunction,
  updateSentAudits: vi.fn() as unknown as MockFunction,
  insertLegacyAudits: vi.fn() as unknown as MockFunction,
  toastSuccess: vi.fn() as unknown as MockFunction,
  toastWarning: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappMessagesRepository: { sendText: mocks.sendText },
  whatsappContactsRepository: { updateLeadStatus: mocks.updateLeadStatus },
  clearInboxLeadAgenda: mocks.clearAgenda,
  scheduleInboxFollowUp: mocks.scheduleFollowUp,
  approveInboxFollowUpSchedule: mocks.approveSchedule,
  markInboxRemindersRead: mocks.markRemindersRead,
  updateInboxFollowUpSentAudits: mocks.updateSentAudits,
  insertInboxLegacyFollowUpAudits: mocks.insertLegacyAudits,
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: {
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
  },
}));

type BatchSender = ReturnType<typeof useInboxBatchFollowUpSender>;
type BatchSenderOptions = Parameters<typeof useInboxBatchFollowUpSender>[0];

const Harness = ({ options, capture }: {
  options: BatchSenderOptions;
  capture: (sender: BatchSender) => void;
}) => {
  capture(useInboxBatchFollowUpSender(options));
  return null;
};

const createChat = (overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: '5511999999999@s.whatsapp.net',
  is_group: false,
  phone_number: '+55 11 99999-9999',
  phone_digits: '5511999999999',
  display_name: 'Contato',
  lead_id: 'lead-1',
  lead_status: 'Em atendimento',
  merged_into_chat_id: null,
  lead_link_source: null,
  lead_linked_at: null,
  lead_linked_by: null,
  auto_link_blocked: false,
  identity_conflict: false,
  is_archived: false,
  is_muted: false,
  is_pinned: false,
  manual_unread: false,
  last_message_direction: 'outbound',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const createResult = (overrides: Partial<BatchFollowUpSendItem> = {}): BatchFollowUpSendItem => ({
  chatId: 'chat-1',
  externalChatId: null,
  textSegments: ['mensagem'],
  reminderId: 'reminder-1',
  leadId: 'lead-1',
  phone: '+55 (11) 99999-9999',
  currentAction: 'send',
  generationId: 'generation-1',
  approvedScheduleAction: 'no_schedule',
  approvedScheduleDate: null,
  scheduleReason: null,
  opportunityRecommendation: 'continue',
  ...overrides,
});

const createOptions = (chats: CommWhatsAppChat[] = [createChat()]) => {
  const calls = {
    refreshedChats: 0,
    refreshedMessages: [] as Array<{ chat: CommWhatsAppChat | null; reason: string | undefined }>,
  };
  const options: BatchSenderOptions = {
    refs: {
      latestChatsRef: { current: chats },
      loadChatsRef: { current: async () => { calls.refreshedChats += 1; } },
      loadMessagesRef: { current: async (chat, reason) => { calls.refreshedMessages.push({ chat, reason }); } },
    },
  };
  return { options, calls };
};

const mountSender = (options: BatchSenderOptions) => {
  let sender!: BatchSender;
  const view = render(<Harness options={options} capture={(next) => { sender = next; }} />);
  return { view, get sender() { return sender; } };
};

const resetMocks = () => {
  mocks.sendText.mockReset();
  mocks.updateLeadStatus.mockReset();
  mocks.clearAgenda.mockReset();
  mocks.scheduleFollowUp.mockReset();
  mocks.approveSchedule.mockReset();
  mocks.markRemindersRead.mockReset();
  mocks.updateSentAudits.mockReset();
  mocks.insertLegacyAudits.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastWarning.mockReset();
};

test('envia segmentos, agenda ações aprovadas, aplica status comerciais e atualiza auditorias', async () => {
  resetMocks();
  vi.useFakeTimers();
  mocks.sendText.mockResolvedValue(undefined);
  mocks.scheduleFollowUp.mockResolvedValue({ inserted: true, reminderId: 'new-reminder' });
  mocks.approveSchedule.mockResolvedValue(undefined);
  mocks.updateLeadStatus.mockResolvedValue(undefined);
  mocks.clearAgenda.mockResolvedValue(undefined);
  mocks.markRemindersRead.mockResolvedValue(undefined);
  mocks.updateSentAudits.mockResolvedValue(undefined);
  const context = createOptions([
    createChat(),
    createChat({ id: 'chat-2', lead_id: 'lead-2', lead_status: 'Em atendimento' }),
    createChat({ id: 'chat-3', lead_id: 'lead-3', lead_status: 'Em atendimento' }),
  ]);
  const mounted = mountSender(context.options);
  const progress: BatchFollowUpSendProgress[] = [];

  try {
    const sending = mounted.sender.handleBatchSendFollowUp([
      createResult({
        textSegments: ['parte 1', 'parte 2'],
      }),
      createResult({
        chatId: 'chat-2',
        leadId: 'lead-2',
        reminderId: 'reminder-2',
        generationId: 'generation-2',
        currentAction: 'wait',
        approvedScheduleAction: 'schedule',
        approvedScheduleDate: '2026-09-29T15:00:00.000Z',
        scheduleReason: 'Retomar após a cotação',
      }),
      createResult({
        chatId: 'chat-3',
        leadId: 'lead-3',
        reminderId: 'reminder-3',
        generationId: null,
        currentAction: 'wait',
        opportunityRecommendation: 'mark_lost_recommended',
      }),
    ], { onProgress: (item) => progress.push(item) });
    await vi.advanceTimersByTimeAsync(1500);
    const summary = await sending;

    assert.deepEqual(summary, { sentCount: 1, scheduledCount: 1, failedCount: 0, errorMessage: undefined });
    assert.deepEqual(mocks.sendText.mock.calls, [
      ['5511999999999@s.whatsapp.net', 'parte 1', { clientRequestId: 'follow-up:reminder-1:0' }],
      ['5511999999999@s.whatsapp.net', 'parte 2', { clientRequestId: 'follow-up:reminder-1:1' }],
    ]);
    assert.deepEqual(mocks.scheduleFollowUp.mock.calls[0], [{
      leadId: 'lead-2',
      title: 'Follow-up',
      description: 'Retomar após a cotação',
      dueAt: '2026-09-29T15:00:00.000Z',
      priority: 'normal',
      generationId: 'generation-2',
      origin: 'follow_up_v2_batch',
    }]);
    assert.deepEqual(mocks.approveSchedule.mock.calls[0], [{
      generationId: 'generation-2',
      dueAt: '2026-09-29T15:00:00.000Z',
      reminderId: 'new-reminder',
    }]);
    assert.deepEqual(mocks.updateLeadStatus.mock.calls, [
      ['chat-1', 'Reativação'],
      ['chat-3', 'Perdido'],
    ]);
    assert.deepEqual(mocks.clearAgenda.mock.calls, [['lead-3']]);
    assert.deepEqual(mocks.markRemindersRead.mock.calls[0], [['reminder-2', 'reminder-1', 'reminder-3']]);
    assert.deepEqual(mocks.updateSentAudits.mock.calls[0]?.[0], [{ id: 'generation-1', sentText: 'parte 1\n\nparte 2' }]);
    assert.ok(progress.some((item) => item.reminderId === 'reminder-1' && item.status === 'sending' && item.sentSegments === 1));
    assert.ok(progress.some((item) => item.reminderId === 'reminder-1' && item.status === 'sent' && item.sentSegments === 2));
    assert.ok(progress.some((item) => item.reminderId === 'reminder-3' && item.finalStatus === 'Perdido'));
    assert.equal(context.calls.refreshedChats, 1);
    assert.deepEqual(context.calls.refreshedMessages, [{ chat: null, reason: 'send' }]);
    assert.equal(mocks.toastSuccess.mock.calls[0]?.[0], '1 follow-up(s) enviado(s) e 1 novo(s) agendado(s).');
  } finally {
    mounted.view.unmount();
    vi.useRealTimers();
  }
});

test('conflito de identidade interrompe sem enviar e rejeita lote sem nenhuma ação válida', async () => {
  resetMocks();
  const context = createOptions([createChat({ identity_conflict: true })]);
  const mounted = mountSender(context.options);
  const progress: BatchFollowUpSendProgress[] = [];

  try {
    await assert.rejects(
      mounted.sender.handleBatchSendFollowUp([createResult()], { onProgress: (item) => progress.push(item) }),
      /Lead lead-1: Identidade WhatsApp pendente de revisão manual\./,
    );

    assert.equal(mocks.sendText.mock.calls.length, 0);
    assert.equal(mocks.markRemindersRead.mock.calls.length, 0);
    assert.deepEqual(progress.map((item) => item.status), ['sending', 'failed']);
    assert.equal(progress[1]?.errorMessage, 'Identidade WhatsApp pendente de revisão manual.');
  } finally {
    mounted.view.unmount();
  }
});

test('falha de um envio não bloqueia o próximo e respeita intervalo entre mensagens', async () => {
  resetMocks();
  vi.useFakeTimers();
  mocks.sendText.mockRejectedValueOnce(new Error('provedor offline'));
  mocks.sendText.mockResolvedValue(undefined);
  mocks.updateLeadStatus.mockResolvedValue(undefined);
  mocks.markRemindersRead.mockResolvedValue(undefined);
  const context = createOptions([
    createChat(),
    createChat({ id: 'chat-2', lead_id: 'lead-2', external_chat_id: '5511888888888@s.whatsapp.net' }),
  ]);
  const mounted = mountSender(context.options);
  const progress: BatchFollowUpSendProgress[] = [];

  try {
    const sending = mounted.sender.handleBatchSendFollowUp([
      createResult(),
      createResult({
        chatId: 'chat-2',
        leadId: 'lead-2',
        reminderId: 'reminder-2',
        generationId: 'generation-2',
      }),
    ], { onProgress: (item) => progress.push(item) });
    await vi.advanceTimersByTimeAsync(1500);
    const summary = await sending;

    assert.deepEqual(summary, {
      sentCount: 1,
      scheduledCount: 0,
      failedCount: 1,
      errorMessage: 'Lead lead-1: provedor offline',
    });
    assert.equal(mocks.sendText.mock.calls.length, 2);
    assert.deepEqual(mocks.sendText.mock.calls[1], [
      '5511888888888@s.whatsapp.net',
      'mensagem',
      { clientRequestId: 'follow-up:reminder-2:0' },
    ]);
    assert.ok(progress.some((item) => item.reminderId === 'reminder-1' && item.status === 'failed'));
    assert.ok(progress.some((item) => item.reminderId === 'reminder-2' && item.status === 'sent'));
    assert.equal(mocks.toastWarning.mock.calls[0]?.[0], '1 follow-up(s) enviado(s). 1 falharam.');
  } finally {
    mounted.view.unmount();
    vi.useRealTimers();
  }
});

test('envio legado registra auditoria antiga e resolve o destino pelo telefone normalizado', async () => {
  resetMocks();
  mocks.sendText.mockResolvedValue(undefined);
  mocks.markRemindersRead.mockResolvedValue(undefined);
  mocks.insertLegacyAudits.mockResolvedValue(undefined);
  const context = createOptions([createChat({ external_chat_id: '', lead_status: 'Convertido' })]);
  const mounted = mountSender(context.options);

  try {
    const summary = await mounted.sender.handleBatchSendFollowUp([createResult({
      externalChatId: null,
      generationId: null,
      textSegments: ['texto 1', 'texto 2'],
    })]);

    assert.equal(summary.sentCount, 1);
    assert.deepEqual(mocks.sendText.mock.calls[0], [
      '5511999999999@s.whatsapp.net',
      'texto 1',
      { clientRequestId: 'follow-up:reminder-1:0' },
    ]);
    assert.deepEqual(mocks.sendText.mock.calls[1], [
      '5511999999999@s.whatsapp.net',
      'texto 2',
      { clientRequestId: 'follow-up:reminder-1:1' },
    ]);
    assert.deepEqual(mocks.insertLegacyAudits.mock.calls[0], [[{
      lead_id: 'lead-1',
      chat_id: 'chat-1',
      text_content: 'texto 1\n\ntexto 2',
      next_action_title: null,
      next_action_due_at: null,
    }]]);
    assert.equal(mocks.updateSentAudits.mock.calls.length, 0);
    assert.equal(mocks.updateLeadStatus.mock.calls.length, 0);
  } finally {
    mounted.view.unmount();
  }
});

test('falha ao criar agenda aprovada vira aviso e mantém o lembrete de origem pendente', async () => {
  resetMocks();
  mocks.scheduleFollowUp.mockRejectedValueOnce(new Error('agenda indisponível'));
  mocks.markRemindersRead.mockResolvedValue(undefined);
  const context = createOptions();
  const mounted = mountSender(context.options);
  const progress: BatchFollowUpSendProgress[] = [];

  try {
    const summary = await mounted.sender.handleBatchSendFollowUp([createResult({
      currentAction: 'wait',
      approvedScheduleAction: 'schedule',
      approvedScheduleDate: '2026-09-29T15:00:00.000Z',
    })], { onProgress: (item) => progress.push(item) });

    assert.deepEqual(summary, {
      sentCount: 0,
      scheduledCount: 0,
      failedCount: 0,
      errorMessage: 'Erro ao agendar proximo follow-up para lead lead-1: agenda indisponível',
    });
    assert.deepEqual(mocks.markRemindersRead.mock.calls[0], [[]]);
    assert.deepEqual(progress, [{ reminderId: 'reminder-1', status: 'sent', sentSegments: 0, totalSegments: 0 }]);
    assert.equal(mocks.toastWarning.mock.calls[0]?.[0], '0 follow-up(s) enviado(s).');
  } finally {
    mounted.view.unmount();
  }
});
