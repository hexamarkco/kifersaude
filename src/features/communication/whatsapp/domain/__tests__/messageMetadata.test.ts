import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { CommWhatsAppMessage } from '../types';
import {
  buildDeletedMessageSummary,
  getDeletedMessageInfo,
  getEditedMessageInfo,
  getMessageContactCardInfo,
  getMessageInteractiveInfo,
  getMessageLinkPreview,
  getMessageQuoteInfo,
  getMessageReactions,
  getOwnReactionEmoji,
  getReactionTooltipText,
} from '../messageMetadata';

const createMessage = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  external_message_id: 'external-1',
  direction: 'inbound',
  message_type: 'text',
  delivery_status: 'read',
  text_content: 'Texto atual',
  message_at: '2026-09-08T12:00:00.000Z',
  metadata: {},
  created_at: '2026-09-08T12:00:00.000Z',
  ...overrides,
});

test('reads quote, link and contact metadata used by message rendering', () => {
  const message = createMessage({
    message_type: 'contact_list',
    metadata: {
      quote: {
        external_message_id: 'quoted-1',
        author_phone: '5511999999999',
        quoted_type: 'image',
        preview_text: '',
      },
      link_preview: {
        url: 'https://www.kifersaude.com.br/planos',
        title: 'Planos',
      },
      contact_card: {
        kind: 'contact_list',
        count: 2,
        items: [
          { name: 'Ana', phone_number: '5511988887777' },
          { name: 'Bruno', phone_number: null },
        ],
      },
    },
  });

  assert.deepEqual(getMessageQuoteInfo(message), {
    externalMessageId: 'quoted-1',
    authorPhone: '5511999999999',
    quotedType: 'image',
    previewText: '[Imagem]',
  });
  assert.deepEqual(getMessageLinkPreview(message), {
    url: 'https://www.kifersaude.com.br/planos',
    title: 'Planos',
    description: null,
    body: null,
    previewImage: null,
    domain: 'kifersaude.com.br',
  });
  assert.deepEqual(getMessageContactCardInfo(message), {
    kind: 'contact_list',
    count: 2,
    items: [
      { name: 'Ana', phoneNumber: '5511988887777' },
      { name: 'Bruno', phoneNumber: null },
    ],
  });
});

test('normalizes interactive buttons, sections and selected reply', () => {
  const message = createMessage({
    message_type: 'interactive',
    metadata: {
      interactive: {
        kind: 'list',
        header: 'Escolha um plano',
        buttons: [{ id: 'open', title: 'Ver opções' }],
        sections: [{ title: 'Planos', rows: [{ id: 'pme', title: 'PME', description: 'Empresarial' }] }],
        selectedReply: { id: 'pme', title: 'PME' },
      },
    },
  });

  assert.deepEqual(getMessageInteractiveInfo(message), {
    kind: 'list',
    header: 'Escolha um plano',
    body: null,
    footer: null,
    buttons: [{ id: 'open', title: 'Ver opções' }],
    sections: [{ title: 'Planos', rows: [{ id: 'pme', title: 'PME', description: 'Empresarial' }] }],
    selectedReply: { id: 'pme', title: 'PME' },
  });
});

test('preserves edit and delete history presentation', () => {
  const edited = createMessage({
    text_content: 'Texto novo',
    metadata: {
      edited: true,
      edited_at: '2026-09-08T12:05:00.000Z',
      original_text_content: 'Texto original',
      edit_history: [{ previous_text: 'Texto anterior' }],
    },
  });
  const deleted = createMessage({
    delivery_status: 'deleted',
    text_content: '[Mensagem apagada]',
    metadata: { deleted: true, deleted_original_text_content: 'Conteúdo removido', deleted_by: 'self' },
  });

  assert.deepEqual(getEditedMessageInfo(edited), {
    edited: true,
    originalText: 'Texto original',
    previousText: 'Texto anterior',
    currentText: 'Texto novo',
    editedAt: '2026-09-08T12:05:00.000Z',
  });
  assert.equal(getDeletedMessageInfo(deleted).preservedText, 'Conteúdo removido');
  assert.equal(buildDeletedMessageSummary('image', 'Foto anterior'), '[Apagada] Foto anterior');
  assert.equal(buildDeletedMessageSummary('image'), '[Imagem apagada]');
});

test('groups reactions and identifies the own reaction without losing group labels', () => {
  const message = createMessage({
    metadata: {
      chat_id: '120363000000000000@g.us',
      reactions: [
        { actor_key: 'self', emoji: '👍', from_me: true },
        { actor_key: 'ana', emoji: '👍', from_name: 'Ana' },
        { actor_key: 'bruno', emoji: '❤️', from_name: 'Bruno' },
      ],
    },
  });

  assert.deepEqual(getMessageReactions(message), [
    { emoji: '👍', count: 2, fromMe: true, actors: ['Você', 'Ana'] },
    { emoji: '❤️', count: 1, fromMe: false, actors: ['Bruno'] },
  ]);
  assert.equal(getOwnReactionEmoji(message), '👍');
  assert.equal(getReactionTooltipText(message), '👍 Você, Ana\n❤️ Bruno');
});
