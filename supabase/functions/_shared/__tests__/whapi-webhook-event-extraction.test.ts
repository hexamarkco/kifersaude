import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  extractWhapiDeletedMessageEvent,
  extractWhapiEditedMessageEvent,
  extractWhapiInteractiveMeta,
  extractWhapiReactionEvent,
  extractWhapiStarEvent,
  summarizeWhapiMessage,
} from '../comm-whatsapp';

// Estes testes cobrem os formatos reais de payload que a Whapi manda no
// webhook `messages` (post/put/patch/delete), reproduzindo os eventos
// configurados em /settings desta conta: reacao, star/unstar, apagar e
// editar mensagem sempre chegam como `type: 'action'` com um objeto
// `action.type` dizendo o que aconteceu.

test('extractWhapiReactionEvent reconhece uma reacao recebida', () => {
  const event = extractWhapiReactionEvent({
    id: 'reaction-event-1',
    type: 'action',
    from_me: false,
    from: '5511999999999',
    from_name: 'Nick',
    timestamp: 1712995300,
    action: {
      type: 'reaction',
      target: 'target-message-1',
      emoji: '👍',
    },
  }, 'put');

  assert.ok(event);
  assert.equal(event?.targetExternalMessageId, 'target-message-1');
  assert.equal(event?.emoji, '👍');
  assert.equal(event?.fromMe, false);
  assert.equal(event?.actorKey, '5511999999999');
});

test('extractWhapiReactionEvent ignora acoes que nao sao reacao', () => {
  const event = extractWhapiReactionEvent({
    id: 'star-event-1',
    type: 'action',
    action: { type: 'star', target: 'target-message-1' },
  }, 'put');

  assert.equal(event, null);
});

test('extractWhapiReactionEvent ignora reacao sem mensagem alvo', () => {
  const event = extractWhapiReactionEvent({
    id: 'reaction-event-2',
    type: 'action',
    action: { type: 'reaction', emoji: '❤️' },
  }, 'put');

  assert.equal(event, null);
});

test('extractWhapiStarEvent reconhece um star explicito', () => {
  const event = extractWhapiStarEvent({
    id: 'target-message-1',
    type: 'action',
    timestamp: 1712995300,
    action: { type: 'star', target: 'target-message-1', starred: 'true' },
  }, 'put');

  assert.ok(event);
  assert.equal(event?.targetExternalMessageId, 'target-message-1');
  assert.equal(event?.starred, true);
});

test('extractWhapiStarEvent trata unstar como starred=false mesmo sem flag explicita', () => {
  const event = extractWhapiStarEvent({
    id: 'target-message-1',
    type: 'action',
    action: { type: 'unstar', target: 'target-message-1' },
  }, 'put');

  assert.ok(event);
  assert.equal(event?.starred, false);
});

test('extractWhapiStarEvent trata star como starred=true mesmo sem flag explicita', () => {
  const event = extractWhapiStarEvent({
    id: 'target-message-1',
    type: 'action',
    action: { type: 'star', target: 'target-message-1' },
  }, 'put');

  assert.ok(event);
  assert.equal(event?.starred, true);
});

test('extractWhapiStarEvent ignora acoes que nao sao star/unstar', () => {
  const event = extractWhapiStarEvent({
    id: 'delete-event-1',
    type: 'action',
    action: { type: 'delete', target: 'target-message-1' },
  }, 'put');

  assert.equal(event, null);
});

test('extractWhapiDeletedMessageEvent reconhece delete explicito via action', () => {
  const event = extractWhapiDeletedMessageEvent({
    id: 'delete-event-1',
    type: 'action',
    from_me: true,
    timestamp: 1712995300,
    action: { type: 'delete', target: 'target-message-1' },
  }, 'put');

  assert.ok(event);
  assert.equal(event?.targetExternalMessageId, 'target-message-1');
  assert.equal(event?.deletedBy, 'self');
});

test('extractWhapiDeletedMessageEvent reconhece delete pelo status=deleted sem action explicita', () => {
  const event = extractWhapiDeletedMessageEvent({
    id: 'target-message-1',
    type: 'text',
    status: 'deleted',
    from_me: false,
    timestamp: 1712995300,
  }, 'patch');

  assert.ok(event);
  assert.equal(event?.targetExternalMessageId, 'target-message-1');
  assert.equal(event?.deletedBy, 'contact');
});

test('extractWhapiDeletedMessageEvent ignora acoes que nao sao delete/revoke', () => {
  const event = extractWhapiDeletedMessageEvent({
    id: 'reaction-event-1',
    type: 'action',
    action: { type: 'reaction', target: 'target-message-1' },
  }, 'put');

  assert.equal(event, null);
});

test('extractWhapiEditedMessageEvent reconhece edicao explicita via action', () => {
  const event = extractWhapiEditedMessageEvent({
    id: 'edit-event-1',
    type: 'action',
    timestamp: 1712995300,
    action: {
      type: 'edit',
      target_message_id: 'target-message-1',
      edited_text: 'Texto corrigido',
    },
  }, 'put');

  assert.ok(event);
  assert.equal(event?.targetExternalMessageId, 'target-message-1');
  assert.equal(event?.editedText, 'Texto corrigido');
});

test('extractWhapiEditedMessageEvent reconhece patch com campos editados sem action.type=edit', () => {
  const event = extractWhapiEditedMessageEvent({
    id: 'target-message-1',
    type: 'text',
    edited_message_id: 'target-message-1',
    edited_text: 'Texto corrigido via patch',
  }, 'patch');

  assert.ok(event);
  assert.equal(event?.targetExternalMessageId, 'target-message-1');
  assert.equal(event?.editedText, 'Texto corrigido via patch');
});

test('extractWhapiEditedMessageEvent ignora patch sem indicio nenhum de edicao', () => {
  const event = extractWhapiEditedMessageEvent({
    id: 'poll-message-1',
    type: 'poll',
    poll: { total: 1 },
  }, 'patch');

  assert.equal(event, null);
});

test('summarizeWhapiMessage retorna o corpo do texto quando presente', () => {
  assert.equal(
    summarizeWhapiMessage({ type: 'text', text: { body: 'Oi, tudo bem?' } }),
    'Oi, tudo bem?',
  );
});

test('summarizeWhapiMessage usa rotulos fixos para tipos de midia sem legenda', () => {
  assert.equal(summarizeWhapiMessage({ type: 'image' }), '[Imagem]');
  assert.equal(summarizeWhapiMessage({ type: 'audio' }), '[Audio]');
  assert.equal(summarizeWhapiMessage({ type: 'video' }), '[Video]');
  assert.equal(summarizeWhapiMessage({ type: 'document' }), '[Documento]');
  assert.equal(summarizeWhapiMessage({ type: 'sticker' }), '[Sticker]');
  assert.equal(summarizeWhapiMessage({ type: 'location' }), '[Localizacao]');
});

test('summarizeWhapiMessage descreve uma acao de reacao quando nao ha texto', () => {
  assert.equal(
    summarizeWhapiMessage({ type: 'action', action: { type: 'reaction' } }),
    '[Reação]',
  );
});

test('summarizeWhapiMessage descreve uma acao de exclusao quando nao ha texto', () => {
  assert.equal(
    summarizeWhapiMessage({ type: 'action', action: { type: 'delete' } }),
    '[Mensagem apagada]',
  );
});

test('summarizeWhapiMessage cai no rotulo generico para payload que nao e um record', () => {
  assert.equal(summarizeWhapiMessage(null), '[Mensagem]');
  assert.equal(summarizeWhapiMessage('texto solto'), '[Mensagem]');
});

// Mensagens interativas (botoes/listas) chegam no formato do WhatsApp Cloud
// API que a Whapi repassa quase sem alteracao: `type: 'interactive'` com um
// objeto `interactive.{header,body,footer,action}`.

test('extractWhapiInteractiveMeta reconhece uma mensagem de botoes', () => {
  const meta = extractWhapiInteractiveMeta({
    type: 'interactive',
    interactive: {
      type: 'button',
      header: { type: 'text', text: 'Confirmação de horário' },
      body: { text: 'Você confirma seu horário amanhã às 14h?' },
      footer: { text: 'Responda para confirmar' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'confirm', title: 'Confirmar' } },
          { type: 'reply', reply: { id: 'cancel', title: 'Cancelar' } },
        ],
      },
    },
  });

  assert.ok(meta);
  assert.equal(meta?.kind, 'buttons');
  assert.equal(meta?.header, 'Confirmação de horário');
  assert.equal(meta?.body, 'Você confirma seu horário amanhã às 14h?');
  assert.equal(meta?.buttons.length, 2);
  assert.equal(meta?.buttons[0].title, 'Confirmar');
  assert.equal(meta?.buttons[1].id, 'cancel');
});

test('extractWhapiInteractiveMeta reconhece uma mensagem de lista', () => {
  const meta = extractWhapiInteractiveMeta({
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: 'Escolha um horário disponível' },
      action: {
        button: 'Ver horários',
        sections: [
          {
            title: 'Manhã',
            rows: [
              { id: 'slot-1', title: '09:00', description: 'Disponível' },
              { id: 'slot-2', title: '10:00', description: 'Disponível' },
            ],
          },
        ],
      },
    },
  });

  assert.ok(meta);
  assert.equal(meta?.kind, 'list');
  assert.equal(meta?.sections.length, 1);
  assert.equal(meta?.sections[0].title, 'Manhã');
  assert.equal(meta?.sections[0].rows.length, 2);
  assert.equal(meta?.sections[0].rows[0].title, '09:00');
});

test('extractWhapiInteractiveMeta reconhece a resposta que o contato escolheu (buttons_reply)', () => {
  const meta = extractWhapiInteractiveMeta({
    type: 'reply',
    reply: {
      buttons_reply: { id: 'confirm', title: 'Confirmar' },
    },
  });

  assert.ok(meta);
  assert.equal(meta?.kind, 'reply');
  assert.equal(meta?.selectedReply?.title, 'Confirmar');
});

test('extractWhapiInteractiveMeta reconhece a resposta que o contato escolheu (list_reply)', () => {
  const meta = extractWhapiInteractiveMeta({
    type: 'reply',
    reply: {
      list_reply: { id: 'slot-1', title: '09:00', description: 'Disponível' },
    },
  });

  assert.ok(meta);
  assert.equal(meta?.kind, 'reply');
  assert.equal(meta?.selectedReply?.title, '09:00');
});

test('extractWhapiInteractiveMeta retorna null para mensagem de texto comum', () => {
  const meta = extractWhapiInteractiveMeta({ type: 'text', text: { body: 'Oi' } });
  assert.equal(meta, null);
});

test('extractWhapiInteractiveMeta retorna null quando o payload interactive nao tem nada util', () => {
  const meta = extractWhapiInteractiveMeta({ type: 'interactive', interactive: {} });
  assert.equal(meta, null);
});
