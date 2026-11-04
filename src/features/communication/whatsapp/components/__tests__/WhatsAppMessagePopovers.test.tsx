import assert from 'node:assert/strict';
import { act, createRef, type ComponentProps } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppMessage } from '../../domain/types';
import { WhatsAppMessagePopovers } from '../WhatsAppMessagePopovers';

const message: CommWhatsAppMessage = {
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  external_message_id: 'external-message-1',
  direction: 'inbound',
  message_type: 'text',
  delivery_status: 'read',
  text_content: 'Olá',
  message_at: '2026-11-04T12:00:00Z',
  created_at: '2026-11-04T12:00:00Z',
  metadata: {},
};

const noop = () => undefined;
const createProps = (): ComponentProps<typeof WhatsAppMessagePopovers> => ({
  reactionPickerRef: createRef<HTMLDivElement>(),
  reactionPickerPosition: null,
  openReactionPickerMessage: null,
  reactionOptions: [],
  reactingMessageIds: new Set(),
  onCloseReactionPicker: noop,
  onReactToMessage: noop,
  messageActionMenuRef: createRef<HTMLDivElement>(),
  messageActionMenuPosition: { top: 12, left: 12, width: 268 },
  openMessageActionMenuMessage: message,
  starringMessageIds: new Set(),
  deletingMessageId: null,
  onCloseMessageActionMenu: noop,
  onOpenMessageDetails: noop,
  onReplyToMessage: noop,
  onOpenForwardMessageModal: noop,
  onToggleStarMessage: noop,
  onOpenEditMessageModal: noop,
  onRequestDeleteMessage: noop,
});

test('usa opções do DS e preserva navegação e ações do menu de mensagem', () => {
  const replied: CommWhatsAppMessage[] = [];
  const forwarded: CommWhatsAppMessage[] = [];
  const starred: CommWhatsAppMessage[] = [];
  const view = render(<WhatsAppMessagePopovers {...createProps()}
    onReplyToMessage={value => replied.push(value)}
    onOpenForwardMessageModal={value => forwarded.push(value)}
    onToggleStarMessage={value => starred.push(value)}
  />);
  try {
    const menu = document.body.querySelector('[role="menu"][aria-label="Menu da mensagem"]');
    assert.ok(menu);
    assert.equal(menu.querySelector('.kds-button'), null);
    const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    assert.deepEqual(items.map(item => item.textContent?.trim()), [
      'Responder mensagem', 'Encaminhar mensagem', 'Estrelar mensagem',
    ]);
    act(() => {
      items[0].focus();
      items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    assert.equal(document.activeElement, items[1]);
    act(() => items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    assert.equal(document.activeElement, items[2]);
    act(() => items.forEach(item => item.click()));
    assert.deepEqual(replied, [message]);
    assert.deepEqual(forwarded, [message]);
    assert.deepEqual(starred, [message]);
  } finally {
    view.unmount();
  }
});

test('mantém a exclusão como ação destrutiva e bloqueia ações em andamento', () => {
  const deleted: CommWhatsAppMessage[] = [];
  const outbound = { ...message, direction: 'outbound' as const };
  const view = render(<WhatsAppMessagePopovers {...createProps()}
    openMessageActionMenuMessage={outbound}
    starringMessageIds={new Set([message.id])}
    deletingMessageId={message.id}
    onRequestDeleteMessage={value => deleted.push(value)}
  />);
  try {
    const items = [...document.body.querySelectorAll<HTMLButtonElement>('[aria-label="Menu da mensagem"] [role="menuitem"]')];
    const deletion = items.find(item => item.textContent?.includes('Apagar mensagem'));
    const star = items.find(item => item.textContent?.includes('Estrelar mensagem'));
    assert.ok(deletion);
    assert.ok(star);
    assert.ok(deletion.classList.contains('kds-record-action-danger'));
    assert.equal(deletion.disabled, true);
    assert.equal(star.disabled, true);
    assert.ok(items.some(item => item.textContent?.includes('Editar mensagem')));
    act(() => deletion.click());
    assert.deepEqual(deleted, []);
  } finally {
    view.unmount();
  }
});
