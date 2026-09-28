import assert from 'node:assert/strict';
import { act, type SetStateAction } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppMessage } from '../../domain/types';
import { useInboxMessageViewport } from '../useInboxMessageViewport';

type ViewportOptions = Parameters<typeof useInboxMessageViewport>[0];
type Viewport = ReturnType<typeof useInboxMessageViewport>;

const message = (id: string): CommWhatsAppMessage => ({
  id,
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  direction: 'inbound',
  message_type: 'text',
  delivery_status: 'received',
  message_at: '2026-09-28T12:00:00.000Z',
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
});

const Harness = ({ options, capture }: {
  options: ViewportOptions;
  capture: (viewport: Viewport) => void;
}) => {
  capture(useInboxMessageViewport(options));
  return null;
};

test('marca como lida ao alcançar o fim, mantém o estado ao rolar para cima e destaca a mensagem navegada', () => {
  const messagesContainer = {
    scrollTop: 304,
    scrollHeight: 1000,
    clientHeight: 600,
  } as HTMLDivElement;
  const scrollCalls: Array<{ block: ScrollLogicalPosition; behavior: ScrollBehavior }> = [];
  const messageNode = {
    scrollIntoView: (options: { block: ScrollLogicalPosition; behavior: ScrollBehavior }) => scrollCalls.push(options),
  } as unknown as HTMLDivElement;
  const readSources: Array<'scroll'> = [];
  const refs: ViewportOptions['refs'] = {
    messagesContainerRef: { current: messagesContainer },
    messageBubbleRefs: { current: { 'message-1': messageNode } },
    pendingScrollModeRef: { current: null },
    pendingScrollTopRef: { current: null },
    pendingScrollHeightRef: { current: null },
    isNearBottomRef: { current: true },
  };
  const options: ViewportOptions = {
    refs,
    messages: [message('message-1')],
    localOutgoingMessages: [],
    selectedChatId: 'chat-1',
    highlightedMessageId: 'message-1',
    setHighlightedMessageId: (_next: SetStateAction<string | null>) => undefined,
    markSelectedChatReadIfEligible: (source) => readSources.push(source),
  };
  let viewport: Viewport | null = null;
  const view = render(<Harness options={options} capture={(next) => { viewport = next; }} />);

  try {
    assert.deepEqual(scrollCalls, [{ block: 'center', behavior: 'smooth' }]);
    assert.ok(viewport);

    act(() => viewport?.handleMessagesScroll());
    assert.equal(refs.isNearBottomRef.current, true);
    assert.deepEqual(readSources, ['scroll']);

    messagesContainer.scrollTop = 303;
    act(() => viewport?.handleMessagesScroll());
    assert.equal(refs.isNearBottomRef.current, false);
    assert.deepEqual(readSources, ['scroll']);
  } finally {
    view.unmount();
  }
});
