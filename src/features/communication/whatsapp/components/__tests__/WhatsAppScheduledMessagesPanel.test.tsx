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

test('seções recolhem e paginam independentemente, com busca em todas as páginas', async () => {
  configureSuccessfulCounts();
  mocks.listScheduledSequences.mockResolvedValue(Array.from({ length: 7 }, (_, index) => ({
    ...sequence, id: `sequence-${index}`, label: `Sequência ${index}`,
  })));
  mocks.listScheduledMessages.mockResolvedValue(Array.from({ length: 7 }, (_, index) => ({
    ...sequence, id: `message-${index}`, label: `Normal ${index}`,
    message_type: 'text', text_content: `Texto ${index}`, recurrence: 'none',
  })));

  const view = render(<WhatsAppScheduledMessagesPanel channelId="channel-1" isOpen onClose={() => undefined} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  const getSection = (title: string) => {
    const section = document.querySelector<HTMLElement>(`section[aria-label="${title}"]`);
    assert.ok(section);
    return section;
  };
  const sequences = getSection('Sequências');
  const messages = getSection('Mensagens normais');
  const click = (element: HTMLElement | null) => {
    assert.ok(element);
    act(() => element.click());
  };
  const cardCount = (section: HTMLElement, pattern: RegExp) => Array.from(section.querySelectorAll('p')).filter((element) => pattern.test(element.textContent ?? '')).length;
  assert.equal(cardCount(sequences, /^Sequência \d$/), 5);
  assert.equal(cardCount(messages, /^Normal \d$/), 5);
  click(sequences.querySelector<HTMLButtonElement>('button[aria-label="Próxima página de Sequências"]'));
  assert.equal(cardCount(sequences, /^Sequência \d$/), 2);
  assert.equal(cardCount(messages, /^Normal \d$/), 5);
  assert.equal(sequences.querySelector<HTMLButtonElement>('button[aria-label="Próxima página de Sequências"]')?.disabled, true);

  click(sequences.querySelector('button[aria-expanded]'));
  assert.equal(sequences.querySelector<HTMLElement>('div[id]')?.hidden, true);
  assert.equal(messages.querySelector<HTMLElement>('div[id]')?.hidden, false);
  click(sequences.querySelector('button[aria-expanded]'));
  assert.match(sequences.querySelector('nav')?.textContent ?? '', /Página 2 de 2/);

  const search = document.querySelector<HTMLInputElement>('#scheduled-messages-search');
  assert.ok(search);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'Normal 6');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.match(getSection('Mensagens normais').textContent ?? '', /Normal 6/);
  assert.match(getSection('Mensagens normais').querySelector('nav')?.textContent ?? '', /Página 1 de 1/);
  click(Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Limpar') ?? null);
  assert.match(getSection('Mensagens normais').querySelector('nav')?.textContent ?? '', /Página 1 de 2/);
  view.unmount();
});

test('permite abrir o histórico quando não há próximos agendamentos e sair de outra aba vazia', async () => {
  configureSuccessfulCounts();
  mocks.listScheduledMessages.mockResolvedValue([]);
  mocks.listScheduledSequences
    .mockReturnValueOnce(Promise.resolve([]))
    .mockReturnValueOnce(Promise.resolve([{ ...sequence, status: 'cancelled', label: 'Sequência do histórico' }]))
    .mockReturnValueOnce(Promise.resolve([]));

  const view = render(<WhatsAppScheduledMessagesPanel channelId="channel-1" isOpen onClose={() => undefined} />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  assert.match(document.body.textContent ?? '', /Nenhum agendamento nesta aba/);
  const selectTab = async (label: string) => {
    const tab = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((element) => element.textContent?.includes(label));
    assert.ok(tab);
    await act(async () => {
      tab.click();
    });
  };
  await selectTab('Histórico');
  assert.match(document.body.textContent ?? '', /Sequência do histórico/);
  await selectTab('Atenção');
  assert.match(document.body.textContent ?? '', /Nenhum agendamento nesta aba/);
  assert.equal(document.querySelectorAll('[role="tab"]').length, 4);
  view.unmount();
});

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

test('não apresenta falha de carregamento como se não houvesse agendamentos', async () => {
  configureSuccessfulCounts();
  mocks.listScheduledMessages.mockReturnValueOnce(Promise.reject(new Error('falha temporária')));
  mocks.listScheduledSequences.mockReturnValueOnce(Promise.reject(new Error('falha temporária')));

  const view = render(
    <WhatsAppScheduledMessagesPanel
      channelId="channel-1"
      chatId="chat-1"
      isOpen
      onClose={() => undefined}
    />,
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.match(document.body.textContent ?? '', /Dados indisponíveis — tente novamente/);
  assert.match(document.body.textContent ?? '', /Não foi possível carregar os agendamentos/);
  assert.doesNotMatch(document.body.textContent ?? '', /0 mensagem\(ns\) e 0 sequência\(s\)$/);
  view.unmount();
});

test('informa quando as contagens das abas falham mesmo sem agendamentos listados', async () => {
  mocks.listScheduledMessages.mockReturnValueOnce(Promise.resolve([]));
  mocks.listScheduledSequences.mockReturnValueOnce(Promise.resolve([]));
  mocks.lookupSavedContactsByPhones.mockResolvedValue([]);
  mocks.countScheduledMessages
    .mockReturnValueOnce(Promise.reject(new Error('contagem indisponível')))
    .mockReturnValueOnce(Promise.reject(new Error('contagem indisponível')))
    .mockReturnValueOnce(Promise.reject(new Error('contagem indisponível')));
  mocks.countScheduledSequences
    .mockReturnValueOnce(Promise.reject(new Error('contagem indisponível')))
    .mockReturnValueOnce(Promise.reject(new Error('contagem indisponível')))
    .mockReturnValueOnce(Promise.reject(new Error('contagem indisponível')));

  const view = render(
    <WhatsAppScheduledMessagesPanel
      channelId="channel-1"
      isOpen
      onClose={() => undefined}
    />,
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.match(document.body.textContent ?? '', /Os totais das abas estão incompletos/);
  assert.match(document.body.textContent ?? '', /Nenhum agendamento nesta aba/);
  view.unmount();
});
