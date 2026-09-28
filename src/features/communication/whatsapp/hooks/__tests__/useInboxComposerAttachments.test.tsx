import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { PendingAttachment } from '../../domain/outgoingMessageTypes';
import { useInboxComposerAttachments } from '../useInboxComposerAttachments';

type AttachmentState = ReturnType<typeof useInboxComposerAttachments>;

const Harness = ({
  selectedChatId,
  generatingFollowUp = false,
  clearMediaUploadProgress,
  capture,
}: {
  selectedChatId: string | null;
  generatingFollowUp?: boolean;
  clearMediaUploadProgress: (chatId: string) => void;
  capture: (state: AttachmentState) => void;
}) => {
  const state = useInboxComposerAttachments({
    selectedChatId,
    selectedChat: selectedChatId ? { id: selectedChatId } : null,
    generatingFollowUp,
    sendDisabledReason: null,
    clearMediaUploadProgress,
  });
  capture(state);
  return null;
};

const ChatSwitchHarness = ({ capture }: { capture: (state: AttachmentState, switchChat: () => void) => void }) => {
  const [selectedChatId, setSelectedChatId] = useState('chat-1');
  const state = useInboxComposerAttachments({
    selectedChatId,
    selectedChat: { id: selectedChatId },
    generatingFollowUp: false,
    sendDisabledReason: null,
    clearMediaUploadProgress: () => undefined,
  });
  capture(state, () => setSelectedChatId('chat-2'));
  return null;
};

const createHarness = (options: { selectedChatId?: string | null; generatingFollowUp?: boolean } = {}) => {
  let state: AttachmentState | null = null;
  const clearedProgressForChat: string[] = [];
  const clearMediaUploadProgress = (chatId: string) => { clearedProgressForChat.push(chatId); };
  const view = render(
    <Harness
      selectedChatId={options.selectedChatId ?? 'chat-1'}
      generatingFollowUp={options.generatingFollowUp}
      clearMediaUploadProgress={clearMediaUploadProgress}
      capture={(nextState) => { state = nextState; }}
    />,
  );
  return {
    view,
    get state() {
      if (!state) throw new Error('Attachment controller was not captured');
      return state;
    },
    clearedProgressForChat,
  };
};

const attachment = (id: string, kind: PendingAttachment['kind'], fileName: string): PendingAttachment => ({
  id,
  kind,
  file: new File(['conteúdo'], fileName, { type: kind === 'image' ? 'image/png' : 'application/pdf' }),
});

test('selecionar arquivos substitui anexos comuns, preserva a nota de voz e limpa o input', () => {
  const harness = createHarness();
  const voice = attachment('voice-1', 'voice', 'nota.ogg');
  const oldDocument = attachment('document-1', 'document', 'anterior.pdf');
  const selectedFile = new File(['novo'], 'novo.pdf', { type: 'application/pdf' });
  const event = { target: { files: [selectedFile], value: 'selecionado' } };

  try {
    act(() => harness.state.setPendingAttachments([voice, oldDocument]));
    act(() => harness.state.handleAttachmentInputChange(event as never));

    assert.equal(event.target.value, '');
    assert.deepEqual(
      harness.state.pendingAttachments.map(({ kind, file }) => [kind, file.name]),
      [['voice', 'nota.ogg'], ['document', 'novo.pdf']],
    );
  } finally {
    harness.view.unmount();
  }
});

test('colar imagem normaliza nomes ausentes e revoga o preview removido', () => {
  let previewNumber = 0;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const revokedUrls: string[] = [];
  URL.createObjectURL = () => `blob:inbox-${++previewNumber}`;
  URL.revokeObjectURL = (url) => { revokedUrls.push(url); };
  const harness = createHarness();
  const pastedImage = new File(['imagem'], '', { type: 'image/png' });
  let defaultPrevented = false;
  const event = {
    clipboardData: {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => pastedImage }],
      files: [],
    },
    preventDefault: () => { defaultPrevented = true; },
  };

  try {
    act(() => harness.state.handleComposerPaste(event as never));

    const [pastedAttachment] = harness.state.pendingAttachments;
    assert.equal(defaultPrevented, true);
    assert.equal(pastedAttachment?.kind, 'image');
    assert.match(pastedAttachment?.file.name ?? '', /^imagem-colada-/);
    assert.equal(pastedAttachment?.previewUrl, 'blob:inbox-1');

    act(() => harness.state.clearPendingAttachments());
    assert.deepEqual(revokedUrls, ['blob:inbox-1']);
  } finally {
    harness.view.unmount();
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
  }
});

test('drag aninhado só fecha o indicador no último leave e o drop carrega os arquivos', () => {
  const harness = createHarness();
  const firstFile = new File(['1'], 'um.pdf', { type: 'application/pdf' });
  const secondFile = new File(['2'], 'dois.pdf', { type: 'application/pdf' });
  const createDragEvent = (files: File[]) => {
    let prevented = false;
    return {
      event: {
        dataTransfer: { types: ['Files'], files },
        preventDefault: () => { prevented = true; },
      },
      wasPrevented: () => prevented,
    };
  };

  try {
    const enter = createDragEvent([]);
    const leave = createDragEvent([]);
    act(() => {
      harness.state.handleThreadDragEnter(enter.event as never);
      harness.state.handleThreadDragEnter(enter.event as never);
      harness.state.handleThreadDragLeave(leave.event as never);
    });
    assert.equal(harness.state.isDraggingFilesOverThread, true);
    act(() => harness.state.handleThreadDragLeave(leave.event as never));
    assert.equal(harness.state.isDraggingFilesOverThread, false);

    const drop = createDragEvent([firstFile, secondFile]);
    act(() => harness.state.handleThreadDrop(drop.event as never));
    assert.equal(drop.wasPrevented(), true);
    assert.deepEqual(harness.state.pendingAttachments.map(({ file }) => file.name), ['um.pdf', 'dois.pdf']);
  } finally {
    harness.view.unmount();
  }
});

test('remover permite desfazer por seis segundos e limpar anexo também limpa o progresso do chat', () => {
  const timers = installFakeTimers();
  const harness = createHarness();
  const document = attachment('document-1', 'document', 'contrato.pdf');

  try {
    act(() => harness.state.setPendingAttachments([document]));
    act(() => harness.state.handleClearAttachment(document.id));
    assert.equal(harness.state.removedAttachmentForUndo?.file.name, 'contrato.pdf');
    assert.deepEqual(harness.clearedProgressForChat, ['chat-1']);

    act(() => timers.advanceBy(5999));
    assert.equal(harness.state.removedAttachmentForUndo?.file.name, 'contrato.pdf');
    act(() => timers.advanceBy(1));
    assert.equal(harness.state.removedAttachmentForUndo, null);

    act(() => harness.state.setPendingAttachments([document]));
    act(() => harness.state.handleClearAttachment(document.id));
    act(() => harness.state.handleUndoRemoveAttachment());
    assert.equal(harness.state.removedAttachmentForUndo, null);
    assert.deepEqual(harness.state.pendingAttachments.map(({ file }) => file.name), ['contrato.pdf']);
  } finally {
    harness.view.unmount();
    timers.restore();
  }
});

test('alterar conversa zera anexos pendentes e estado de drag', () => {
  let state: AttachmentState | null = null;
  let switchChat: () => void = () => undefined;
  const view = render(<ChatSwitchHarness capture={(nextState, switchToChat) => {
    state = nextState;
    switchChat = switchToChat;
  }} />);
  const getState = () => {
    if (!state) throw new Error('Attachment controller was not captured');
    return state;
  };

  try {
    act(() => getState().setPendingAttachments([attachment('document-1', 'document', 'contrato.pdf')]));
    act(() => getState().handleThreadDragEnter({
      dataTransfer: { types: ['Files'], files: [] },
      preventDefault: () => undefined,
    } as never));
    assert.equal(getState().isDraggingFilesOverThread, true);

    act(() => switchChat());

    assert.deepEqual(getState().pendingAttachments, []);
    assert.equal(getState().isDraggingFilesOverThread, false);
  } finally {
    view.unmount();
  }
});

const installFakeTimers = () => {
  type ScheduledTimer = { dueAt: number; callback: () => void };
  const originalSetTimeout = window.setTimeout;
  const originalClearTimeout = window.clearTimeout;
  const scheduled = new Map<number, ScheduledTimer>();
  let nextId = 0;
  let now = 0;

  window.setTimeout = ((callback: TimerHandler, delay = 0) => {
    if (typeof callback !== 'function') throw new TypeError('Timer callback must be a function');
    const id = ++nextId;
    scheduled.set(id, { dueAt: now + Math.max(0, Number(delay) || 0), callback: callback as () => void });
    return id;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((id?: number) => {
    if (id !== undefined) scheduled.delete(id);
  }) as typeof window.clearTimeout;

  return {
    advanceBy: (durationMs: number) => {
      const targetTime = now + durationMs;
      while (true) {
        const dueTimer = Array.from(scheduled.entries())
          .filter(([, timer]) => timer.dueAt <= targetTime)
          .sort(([, left], [, right]) => left.dueAt - right.dueAt)[0];
        if (!dueTimer) break;

        const [id, timer] = dueTimer;
        scheduled.delete(id);
        now = timer.dueAt;
        timer.callback();
      }
      now = targetTime;
    },
    restore: () => {
      window.setTimeout = originalSetTimeout;
      window.clearTimeout = originalClearTimeout;
    },
  };
};
