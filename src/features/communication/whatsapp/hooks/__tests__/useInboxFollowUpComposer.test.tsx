import assert from 'node:assert/strict';
import { act, useRef, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { useInboxFollowUpComposer } from '../useInboxFollowUpComposer';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockImplementation: (implementation: (...args: unknown[]) => unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  generate: vi.fn() as unknown as MockFunction,
  schedule: vi.fn() as unknown as MockFunction,
  updateSentAudit: vi.fn() as unknown as MockFunction,
  toastError: vi.fn() as unknown as MockFunction,
  toastSuccess: vi.fn() as unknown as MockFunction,
  sendTextSegments: vi.fn() as unknown as MockFunction,
  loadChatAgendaSummary: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappFollowUpService: { generate: mocks.generate },
  scheduleInboxFollowUp: mocks.schedule,
  updateInboxFollowUpSentAudit: mocks.updateSentAudit,
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

type FollowUpComposer = ReturnType<typeof useInboxFollowUpComposer>;
type FollowUpComposerOptions = Omit<
  Parameters<typeof useInboxFollowUpComposer>[0],
  'selectedChat' | 'selectedChatIdRef' | 'generatingFollowUp' | 'setGeneratingFollowUp'
>;
type HarnessControls = {
  followUp: FollowUpComposer;
  selectedChat: CommWhatsAppChat | null;
  switchChat: () => void;
};

let controls: HarnessControls;

const createChat = (id = 'chat-1', overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
  is_group: false,
  phone_number: '+55 11 99999-9999',
  phone_digits: '5511999999999',
  display_name: 'Contato',
  lead_id: 'lead-1',
  merged_into_chat_id: null,
  lead_link_source: 'manual',
  lead_linked_at: null,
  lead_linked_by: null,
  auto_link_blocked: false,
  identity_conflict: false,
  is_archived: false,
  is_muted: false,
  is_pinned: false,
  manual_unread: false,
  last_message_direction: 'inbound',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T11:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const createOptions = (overrides: Partial<FollowUpComposerOptions> = {}): FollowUpComposerOptions => ({
  selectedChatDisplayName: 'Contato',
  leadPanelId: 'lead-1',
  leadContracts: [{ id: 'contract-1' }],
  canEditAgenda: true,
  followUpGenerationBaseDisabledReason: null,
  sendDisabledReason: null,
  loadChatAgendaSummary: async (leadId, contractIds) => {
    mocks.loadChatAgendaSummary(leadId, contractIds);
  },
  sendTextSegments: async (chat, segments, quote, onSent) => {
    mocks.sendTextSegments(chat, segments, quote, onSent);
  },
  ...overrides,
});

const Harness = ({ options, initialChat = createChat() }: { options: FollowUpComposerOptions; initialChat?: CommWhatsAppChat }) => {
  const [selectedChat, setSelectedChat] = useState<CommWhatsAppChat | null>(initialChat);
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false);
  const selectedChatIdRef = useRef<string | null>(selectedChat?.id ?? null);
  selectedChatIdRef.current = selectedChat?.id ?? null;
  const followUp = useInboxFollowUpComposer({
    ...options,
    selectedChat,
    selectedChatIdRef,
    generatingFollowUp,
    setGeneratingFollowUp,
  });
  controls = {
    followUp,
    selectedChat,
    switchChat: () => setSelectedChat(createChat('chat-2')),
  };
  return null;
};

const resetMocks = () => {
  mocks.generate.mockReset();
  mocks.schedule.mockReset();
  mocks.updateSentAudit.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.sendTextSegments.mockReset();
  mocks.loadChatAgendaSummary.mockReset();
};

test('aplica o resultado e os metadados da geração somente para a conversa ativa', async () => {
  resetMocks();
  mocks.generate.mockResolvedValue({
    text: 'Mensagem sugerida',
    variations: [{ label: 'Direta', text: 'Mensagem alternativa' }],
    aiContext: { rationale: 'Retomar a cotação', emotionalContext: { detected: true, guidance: 'Tom acolhedor' } },
    currentAction: 'wait',
    currentActionReason: 'Aguardar retorno combinado',
    opportunityRecommendation: 'pause',
    generationId: 'generation-1',
    nextAction: {
      type: 'schedule',
      suggestedDateTime: '2026-09-30T12:00:00.000Z',
      priority: 'normal',
      title: 'Retomar cotação',
      reason: 'Data combinada',
      attemptNumber: 1,
      maxAttempts: 3,
      dayLoad: 2,
      dailyCapacity: 10,
      giveUpRecommendation: 'Pausar após a tentativa',
    },
  });
  const view = render(<Harness options={createOptions()} />);

  await act(async () => controls.followUp.handleGenerateFollowUp('contexto específico'));

  assert.deepEqual(mocks.generate.mock.calls, [['chat-1', {
    customInstructions: 'contexto específico',
    triggerSource: 'individual',
  }]]);
  assert.equal(controls.followUp.followUpDraft, 'Mensagem sugerida');
  assert.deepEqual(controls.followUp.followUpVariations, [{ label: 'Direta', text: 'Mensagem alternativa' }]);
  assert.equal(controls.followUp.followUpAiContextRationale, 'Retomar a cotação');
  assert.deepEqual(controls.followUp.followUpEmotionalContext, { detected: true, guidance: 'Tom acolhedor' });
  assert.equal(controls.followUp.followUpCurrentAction, 'wait');
  assert.equal(controls.followUp.followUpCurrentActionReason, 'Aguardar retorno combinado');
  assert.equal(controls.followUp.followUpOpportunityRecommendation, 'pause');
  assert.equal(controls.followUp.followUpGenerationId, 'generation-1');
  assert.equal(controls.followUp.followUpNextAction?.title, 'Retomar cotação');
  assert.equal(controls.followUp.generatingFollowUp, false);
  view.unmount();
});

test('descarta geração atrasada após trocar de conversa e invalida estado do modal', async () => {
  resetMocks();
  let resolveGeneration: (value: { text: string; generationId: string }) => void = () => undefined;
  mocks.generate.mockImplementation(() => new Promise((resolve) => {
    resolveGeneration = resolve;
  }));
  const view = render(<Harness options={createOptions()} />);

  act(() => controls.followUp.handleOpenFollowUpModal());
  let pending: Promise<void> = Promise.resolve();
  act(() => {
    pending = controls.followUp.handleGenerateFollowUp('retomar');
  });
  act(() => controls.switchChat());
  await act(async () => {
    resolveGeneration({ text: 'Resposta obsoleta', generationId: 'old-generation' });
    await pending;
  });

  assert.equal(controls.selectedChat?.id, 'chat-2');
  assert.equal(controls.followUp.followUpModalOpen, false);
  assert.equal(controls.followUp.followUpDraft, '');
  assert.equal(controls.followUp.followUpGenerationId, null);
  assert.equal(controls.followUp.generatingFollowUp, false);
  view.unmount();
});

test('agenda a próxima ação com contrato, descrição e status idempotente', async () => {
  resetMocks();
  mocks.schedule.mockResolvedValue({ inserted: false, reminderId: 'reminder-existing' });
  const view = render(<Harness options={createOptions()} />);
  act(() => controls.followUp.setFollowUpNextAction({
    type: 'schedule',
    suggestedDateTime: '2026-09-30T12:00:00.000Z',
    priority: 'alta',
    title: 'Retorno combinado',
    reason: 'Lead pediu retorno',
    attemptNumber: 2,
    maxAttempts: 4,
    dayLoad: null,
    dailyCapacity: 10,
    giveUpRecommendation: 'Encerrar após a tentativa',
  }));

  await act(async () => controls.followUp.handleScheduleFollowUpNextAction());

  assert.deepEqual(mocks.schedule.mock.calls[0], [{
    leadId: 'lead-1',
    title: 'Retorno combinado',
    description: 'Lead pediu retorno\n\nEncerrar após a tentativa',
    dueAt: '2026-09-30T12:00:00.000Z',
    priority: 'alta',
  }]);
  assert.deepEqual(mocks.loadChatAgendaSummary.mock.calls[0], ['lead-1', ['contract-1']]);
  assert.equal(mocks.toastSuccess.mock.calls[0]?.[0], 'Este follow-up já estava agendado.');
  assert.equal(controls.followUp.followUpNextAction, null);
  view.unmount();
});

test('bloqueia agenda sem permissão', async () => {
  resetMocks();
  const view = render(<Harness options={createOptions({ canEditAgenda: false })} />);
  act(() => controls.followUp.setFollowUpNextAction({
    type: 'schedule',
    suggestedDateTime: '2026-09-30T12:00:00.000Z',
    priority: 'normal',
    title: 'Retorno',
    reason: 'Combinado',
    attemptNumber: 1,
    maxAttempts: 2,
    dayLoad: null,
    dailyCapacity: 10,
    giveUpRecommendation: '',
  }));
  await act(async () => controls.followUp.handleScheduleFollowUpNextAction());
  assert.equal(mocks.schedule.mock.calls.length, 0);
  assert.equal(mocks.toastError.mock.calls[0]?.[0], 'Você não tem permissão para editar a agenda.');

  view.unmount();
});

test('não agenda sem lead vinculado', async () => {
  resetMocks();
  const noLeadView = render(<Harness
    options={createOptions({ leadPanelId: null })}
    initialChat={createChat('chat-sem-lead', { lead_id: null })}
  />);
  act(() => controls.followUp.setFollowUpNextAction({
    type: 'schedule',
    suggestedDateTime: '2026-09-30T12:00:00.000Z',
    priority: 'normal',
    title: 'Retorno',
    reason: 'Combinado',
    attemptNumber: 1,
    maxAttempts: 2,
    dayLoad: null,
    dailyCapacity: 10,
    giveUpRecommendation: '',
  }));
  await act(async () => controls.followUp.handleScheduleFollowUpNextAction());
  assert.equal(mocks.schedule.mock.calls.length, 0);
  assert.equal(mocks.toastError.mock.calls[0]?.[0], 'Vincule um lead antes de agendar a próxima ação.');
  noLeadView.unmount();
});

test('envia segmentos e grava auditoria somente após a fila confirmar o envio', async () => {
  resetMocks();
  const view = render(<Harness options={createOptions()} />);
  act(() => {
    controls.followUp.setFollowUpDraft('Primeira parte\n\n---\n\nSegunda parte');
    controls.followUp.setFollowUpCustomInstructions('deve ser limpo');
    controls.followUp.handleOpenFollowUpModal();
  });
  mocks.generate.mockResolvedValue({ text: 'Rascunho', generationId: 'generation-2' });
  await act(async () => controls.followUp.handleGenerateFollowUp('instrução'));
  act(() => controls.followUp.setFollowUpDraft('Primeira parte\n\n---\n\nSegunda parte'));
  await act(async () => controls.followUp.handleSendFollowUpDraft());

  const [chat, segments, quote, onSent] = mocks.sendTextSegments.mock.calls[0] ?? [];
  assert.equal((chat as CommWhatsAppChat | undefined)?.id, 'chat-1');
  assert.deepEqual(segments, ['Primeira parte', 'Segunda parte']);
  assert.equal(quote, null);
  assert.equal(typeof onSent, 'function');
  assert.equal(controls.followUp.followUpModalOpen, false);
  assert.equal(controls.followUp.followUpDraft, '');
  assert.equal(mocks.updateSentAudit.mock.calls.length, 0);

  await act(async () => (onSent as () => Promise<void>)());
  assert.deepEqual(mocks.updateSentAudit.mock.calls, [['generation-2', 'Primeira parte\n\nSegunda parte']]);
  view.unmount();
});
