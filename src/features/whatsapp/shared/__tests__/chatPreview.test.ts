import assert from 'node:assert/strict';
import { test } from 'vitest';

import { mergeChatPreview, sanitizeTechnicalCiphertextPreview, shouldApplyIncomingChatPreview } from '../chatPreview';

test('chat row does not overwrite an existing preview on equal timestamps when content differs', () => {
  const currentChat = {
    last_message: 'Lead respondeu agora',
    last_message_at: '2026-03-12T13:00:00.000Z',
    last_message_direction: 'inbound' as const,
  };

  const shouldApply = shouldApplyIncomingChatPreview(
    currentChat,
    {
      preview: 'Minha mensagem antiga',
      timestamp: '2026-03-12T13:00:00.000Z',
      direction: 'outbound',
    },
    'chat-row',
  );

  assert.equal(shouldApply, false);
});

test('message backed updates win tie-breakers when preview text changes at the same timestamp', () => {
  const merged = mergeChatPreview(
    {
      last_message: 'Minha mensagem antiga',
      last_message_at: '2026-03-12T13:00:00.000Z',
      last_message_direction: 'outbound',
    },
    {
      preview: 'Lead respondeu agora',
      timestamp: '2026-03-12T13:00:00.000Z',
      direction: 'inbound',
    },
    'message-event',
  );

  assert.deepEqual(merged, {
    last_message: 'Lead respondeu agora',
    last_message_at: '2026-03-12T13:00:00.000Z',
    last_message_direction: 'inbound',
  });
});

test('message backed updates also fix stale directions when the preview text is the same', () => {
  const merged = mergeChatPreview(
    {
      last_message: 'Tudo certo',
      last_message_at: '2026-03-12T13:00:00.000Z',
      last_message_direction: 'outbound',
    },
    {
      preview: 'Tudo certo',
      timestamp: '2026-03-12T13:00:00.000Z',
      direction: 'inbound',
    },
    'message-history',
  );

  assert.equal(merged.last_message_direction, 'inbound');
});

test('message history keeps the newest preview when older items are merged later', () => {
  const stickerPreview = mergeChatPreview(
    {
      last_message: 'Contato respondeu antes',
      last_message_at: '2026-03-13T21:12:05.000Z',
      last_message_direction: 'inbound',
    },
    {
      preview: '[Sticker]',
      timestamp: '2026-03-13T22:05:02.000Z',
      direction: 'inbound',
    },
    'message-history',
  );

  const merged = mergeChatPreview(
    stickerPreview,
    {
      preview: 'Contato respondeu antes',
      timestamp: '2026-03-13T21:12:05.000Z',
      direction: 'inbound',
    },
    'message-history',
  );

  assert.deepEqual(merged, {
    last_message: '[Sticker]',
    last_message_at: '2026-03-13T22:05:02.000Z',
    last_message_direction: 'inbound',
  });
});

test('chat row does not replace a resolved direction on equal timestamps', () => {
  const merged = mergeChatPreview(
    {
      last_message: 'Tudo certo',
      last_message_at: '2026-03-12T13:00:00.000Z',
      last_message_direction: 'inbound',
    },
    {
      preview: 'Tudo certo',
      timestamp: '2026-03-12T13:00:00.000Z',
      direction: 'outbound',
    },
    'chat-row',
  );

  assert.equal(merged.last_message_direction, 'inbound');
});

test('chat row can still fill missing direction when preview matches', () => {
  const merged = mergeChatPreview(
    {
      last_message: 'Tudo certo',
      last_message_at: '2026-03-12T13:00:00.000Z',
      last_message_direction: null,
    },
    {
      preview: 'Tudo certo',
      timestamp: '2026-03-12T13:00:00.000Z',
      direction: 'inbound',
    },
    'chat-row',
  );

  assert.equal(merged.last_message_direction, 'inbound');
});

test('technical ciphertext previews are ignored', () => {
  assert.equal(sanitizeTechnicalCiphertextPreview('[Mensagem criptografada]'), '');
  assert.equal(sanitizeTechnicalCiphertextPreview('Aguardando esta mensagem chegar. Confira seu celular.'), '');
});
