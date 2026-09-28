import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxSelectedChatLifecycle } from '../useInboxSelectedChatLifecycle';

type LifecycleOptions = Parameters<typeof useInboxSelectedChatLifecycle>[0];

type LifecycleControls = { selectChat: (chatId: string | null) => void };

const Harness = ({ options, capture }: {
  options: LifecycleOptions;
  capture: (controls: LifecycleControls) => void;
}) => {
  const [selectedChatId, setSelectedChatId] = useState(options.selectedChatId);
  useInboxSelectedChatLifecycle({ ...options, selectedChatId });
  capture({ selectChat: setSelectedChatId });
  return null;
};

const createOptions = ({ selectedChatId = 'chat-1', leadDrawerOpen = true }: {
  selectedChatId?: string | null;
  leadDrawerOpen?: boolean;
} = {}) => {
  const calls: string[] = [];
  const refs: LifecycleOptions['refs'] = {
    selectedChatIdRef: { current: null },
    suppressAutoChatSelectionRef: { current: true },
    leadMutationRequestIdRef: { current: 11 },
  };
  const state: LifecycleOptions['state'] = {
    setLinkLoadingLeadId: (value) => calls.push(`link:${String(value)}`),
    setThreadActionsMenuOpen: (value) => calls.push(`thread-menu:${String(value)}`),
    setSaveContactDialogOpen: (value) => calls.push(`save-contact:${String(value)}`),
    setSaveContactName: (value) => calls.push(`save-contact-name:${value}`),
    setCreateLeadDraft: (value) => calls.push(`create-lead:${String(value)}`),
    setMessagePendingDeletion: (value) => calls.push(`delete-message:${String(value)}`),
    setRetryPendingMessage: (value) => calls.push(`retry-message:${String(value)}`),
    setStatusReminderLead: (value) => calls.push(`status-reminder:${String(value)}`),
    setStatusReminderPromptMessage: (value) => calls.push(`status-reminder-prompt:${String(value)}`),
    setScheduleMessageModalOpen: (value) => calls.push(`schedule-modal:${String(value)}`),
    setScheduledMessagesPanelOpen: (value) => calls.push(`scheduled-panel:${String(value)}`),
    setChatFilesOpen: (value) => calls.push(`chat-files:${String(value)}`),
    setMediaDrawerOpen: (value) => calls.push(`media-drawer:${String(value)}`),
    setLeadSearchQuery: (value) => calls.push(`lead-search:${value}`),
  };

  return { calls, options: { selectedChatId, leadDrawerOpen, refs, state } satisfies LifecycleOptions, refs };
};

test('isola ações visuais da conversa ativa e invalida mutações ao trocar de chat', () => {
  const context = createOptions();
  const captured: LifecycleControls[] = [];
  const view = render(<Harness options={context.options} capture={(next) => { captured.push(next); }} />);

  assert.equal(context.refs.selectedChatIdRef.current, 'chat-1');
  assert.equal(context.refs.suppressAutoChatSelectionRef.current, false);
  assert.equal(context.refs.leadMutationRequestIdRef.current, 12);
  assert.deepEqual(context.calls, [
    'link:null',
    'thread-menu:false',
    'save-contact:false',
    'save-contact-name:',
    'create-lead:null',
    'delete-message:null',
    'retry-message:null',
    'status-reminder:null',
    'status-reminder-prompt:null',
    'schedule-modal:false',
    'scheduled-panel:false',
    'chat-files:false',
    'media-drawer:false',
    'lead-search:',
  ]);

  const mountedControls = captured[0];
  if (!mountedControls) {
    throw new Error('Selected-chat lifecycle controls were not captured.');
  }
  act(() => mountedControls.selectChat('chat-2'));
  assert.equal(context.refs.selectedChatIdRef.current, 'chat-2');
  assert.equal(context.refs.leadMutationRequestIdRef.current, 13);
  assert.deepEqual(context.calls.slice(14), context.calls.slice(0, 14));

  view.unmount();
});

test('preserva a volta explícita à lista e não limpa busca fechada', () => {
  const context = createOptions({ selectedChatId: null, leadDrawerOpen: false });
  const view = render(<Harness options={context.options} capture={() => undefined} />);

  assert.equal(context.refs.selectedChatIdRef.current, null);
  assert.equal(context.refs.suppressAutoChatSelectionRef.current, true);
  assert.equal(context.refs.leadMutationRequestIdRef.current, 12);
  assert.equal(context.calls.includes('lead-search:'), false);

  view.unmount();
});
