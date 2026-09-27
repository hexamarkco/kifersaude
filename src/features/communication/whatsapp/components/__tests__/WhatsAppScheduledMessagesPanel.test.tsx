import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  type AsyncMock<Result> = ((...args: unknown[]) => Promise<Result>) & {
    mockResolvedValue: (value: Result) => AsyncMock<Result>;
    mockReturnValueOnce: (value: Promise<Result>) => AsyncMock<Result>;
  };
  function createAsyncMock<Result>() {
    return vi.fn() as unknown as AsyncMock<Result>;
  }

  return {
    listScheduledMessages: createAsyncMock<unknown[]>(),
    listScheduledSequences: createAsyncMock<unknown[]>(),
    countScheduledMessages: createAsyncMock<number>(),
    countScheduledSequences: createAsyncMock<number>(),
    lookupSavedContactsByPhones: createAsyncMock<unknown[]>(),
    cancelScheduledMessage: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    deleteScheduledMessage: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    cancelScheduledSequence: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    retryScheduledSequence: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  };
});

vi.mock('../../data', () => ({
  commWhatsAppService: mocks,
  formatCommWhatsAppPhoneLabel: (value: string) => value,
}));

import WhatsAppScheduledMessagesPanel from '../WhatsAppScheduledMessagesPanel';

const sequence = {
  id: 'sequence-old',
  channel_id: 'channel-1',
  chat_id: 'chat-1',
  phone_digits: '5521999999999',
  phone_number: '+55 21 99999-9999',
  display_name: 'Contato antigo',
  lead_id: null,
  contract_id: null,
  reminder_id: null,
  label: 'Sequência antiga',
  status: 'scheduled' as const,
  scheduled_at: '2026-09-28T12:00:00.000Z',
  current_step_index: 0,
  cancel_on_inbound_message: true,
  last_error: null,
  paused_at: null,
  cancelled_at: null,
  completed_at: null,
  created_at: '2026-09-27T12:00:00.000Z',
  updated_at: '2026-09-27T12:00:00.000Z',
  steps: [],
};

function configureSuccessfulCounts() {
  mocks.countScheduledMessages.mockResolvedValue(0);
  mocks.countScheduledSequences.mockResolvedValue(0);
  mocks.lookupSavedContactsByPhones.mockResolvedValue([]);
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

test('descarta sequências antigas quando uma nova carga parcial falha', async () => {
  configureSuccessfulCounts();
  const initialMessages = createDeferred<unknown[]>();
  const initialSequences = createDeferred<unknown[]>();
  const nextMessages = createDeferred<unknown[]>();
  const nextSequences = createDeferred<unknown[]>();
  mocks.listScheduledMessages
    .mockReturnValueOnce(initialMessages.promise)
    .mockReturnValueOnce(nextMessages.promise);
  mocks.listScheduledSequences
    .mockReturnValueOnce(initialSequences.promise)
    .mockReturnValueOnce(nextSequences.promise);

  let updateChatId: (chatId: string) => void = () => undefined;
  function TestHarness() {
    const [chatId, setChatId] = useState('chat-1');
    updateChatId = setChatId;

    return (
      <WhatsAppScheduledMessagesPanel
        channelId="channel-1"
        chatId={chatId}
        isOpen
        onClose={() => undefined}
      />
    );
  }

  const view = render(<TestHarness />);

  await act(async () => {
    initialMessages.resolve([]);
    initialSequences.resolve([sequence]);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  assert.match(document.body.textContent ?? '', /Sequência antiga/);

  await act(async () => {
    updateChatId('chat-2');
    nextMessages.resolve([]);
    nextSequences.reject(new Error('falha temporária'));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.doesNotMatch(document.body.textContent ?? '', /Sequência antiga/);
  assert.match(document.body.textContent ?? '', /0 mensagem\(ns\) e 0 sequência\(s\)/);
  assert.match(document.body.textContent ?? '', /Alguns agendamentos não puderam ser carregados/);
  assert.match(document.body.textContent ?? '', /Uma parte da consulta falhou/);
  view.unmount();
});
