import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppMessage } from '../../domain/types';
import { useInboxTranscriptExport } from '../useInboxTranscriptExport';

const mocks = vi.hoisted(() => ({
  listAllCalls: [] as string[],
  messages: [] as unknown[],
  settings: null as unknown,
  listAllError: null as unknown,
  settingsError: null as unknown,
  toastErrors: [] as string[],
  toastSuccesses: [] as string[],
}));

vi.mock('../../data', () => ({
  whatsappMessagesRepository: {
    listAll: async (chatId: string) => {
      mocks.listAllCalls.push(chatId);
      if (mocks.listAllError) throw mocks.listAllError;
      return mocks.messages;
    },
  },
}));

vi.mock('../../../../config', () => ({
  configService: {
    getSystemSettings: async () => {
      if (mocks.settingsError) throw mocks.settingsError;
      return mocks.settings;
    },
  },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: {
    error: (message: string) => mocks.toastErrors.push(message),
    success: (message: string) => mocks.toastSuccesses.push(message),
  },
}));

type ExportController = ReturnType<typeof useInboxTranscriptExport>;

const Harness = ({ chatId, leadLabel, capture }: {
  chatId: string | null;
  leadLabel: string;
  capture: (controller: ExportController) => void;
}) => {
  capture(useInboxTranscriptExport({ chatId, leadLabel }));
  return null;
};

const createMessage = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  direction: 'inbound',
  message_type: 'text',
  delivery_status: 'received',
  text_content: 'Olá, tudo bem?',
  message_at: '2026-09-08T15:30:00.000Z',
  metadata: {},
  created_at: '2026-09-08T15:30:00.000Z',
  ...overrides,
});

const resetMocks = () => {
  mocks.listAllCalls.length = 0;
  mocks.messages = [];
  mocks.settings = null;
  mocks.listAllError = null;
  mocks.settingsError = null;
  mocks.toastErrors.length = 0;
  mocks.toastSuccesses.length = 0;
};

const withClipboard = async (run: (copied: string[]) => Promise<void>) => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const copied: string[] = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async (text: string) => { copied.push(text); } },
  });

  try {
    await run(copied);
  } finally {
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  }
};

test('carrega e formata a conversa no fuso do sistema antes de copiar', async () => {
  resetMocks();
  mocks.messages = [createMessage()];
  mocks.settings = { timezone: 'America/Sao_Paulo' };

  await withClipboard(async (copied) => {
    const captured: ExportController[] = [];
    const view = render(<Harness chatId="chat-1" leadLabel="Marina" capture={(controller) => captured.push(controller)} />);
    try {
      const controller = captured[0];
      if (!controller) throw new Error('Transcript export controller was not captured.');

      await act(async () => { await controller.handleCopyChatTranscript(); });

      assert.deepEqual(mocks.listAllCalls, ['chat-1']);
      assert.deepEqual(copied, ['[12:30, 08/09/2026] Marina: Olá, tudo bem?']);
      assert.deepEqual(mocks.toastSuccesses, ['Conversa copiada no formato do follow-up.']);
      assert.equal(captured[captured.length - 1]?.copyingTranscript, false);
    } finally {
      view.unmount();
    }
  });
});

test('não copia conversas sem mensagens úteis e informa o estado vazio', async () => {
  resetMocks();
  mocks.messages = [createMessage({ direction: 'system' })];

  await withClipboard(async (copied) => {
    const captured: ExportController[] = [];
    const view = render(<Harness chatId="chat-1" leadLabel="Marina" capture={(controller) => captured.push(controller)} />);
    try {
      const controller = captured[0];
      if (!controller) throw new Error('Transcript export controller was not captured.');
      await act(async () => { await controller.handleCopyChatTranscript(); });

      assert.deepEqual(copied, []);
      assert.deepEqual(mocks.toastErrors, ['Não há histórico útil suficiente para copiar.']);
      assert.equal(captured[captured.length - 1]?.copyingTranscript, false);
    } finally {
      view.unmount();
    }
  });
});

test('preserva a mensagem de erro do serviço e libera o estado de cópia', async () => {
  resetMocks();
  mocks.listAllError = new Error('histórico indisponível');
  const originalError = console.error;
  console.error = () => undefined;
  const captured: ExportController[] = [];
  const view = render(<Harness chatId="chat-1" leadLabel="Marina" capture={(controller) => captured.push(controller)} />);

  try {
    const controller = captured[0];
    if (!controller) throw new Error('Transcript export controller was not captured.');
    await act(async () => { await controller.handleCopyChatTranscript(); });

    assert.deepEqual(mocks.toastErrors, ['histórico indisponível']);
    assert.equal(captured[captured.length - 1]?.copyingTranscript, false);
  } finally {
    view.unmount();
    console.error = originalError;
  }
});
