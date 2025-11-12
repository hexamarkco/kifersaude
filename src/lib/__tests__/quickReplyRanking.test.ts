import assert from 'node:assert/strict';
import { rankQuickRepliesForConversation, findTopQuickReplies } from '../quickReplyRanking';
import type { WhatsAppQuickReply } from '../whatsappQuickRepliesService';
import type { WhatsAppConversation } from '../supabase';

const replies: WhatsAppQuickReply[] = [
  {
    id: '1',
    title: 'Enviar proposta',
    content: 'Olá! Segue a proposta detalhada do plano.',
    category: 'proposta',
    is_favorite: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    updated_at: null,
  },
  {
    id: '2',
    title: 'Perguntar sobre boleto',
    content: 'Você chegou a receber o boleto do último mês?',
    category: 'cobrança',
    is_favorite: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updated_at: null,
  },
  {
    id: '3',
    title: 'Saudação inicial',
    content: 'Oi, tudo bem? Vi que você demonstrou interesse em nossos planos.',
    category: 'introdução',
    is_favorite: false,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    updated_at: null,
  },
];

const conversation: WhatsAppConversation[] = [
  {
    id: 'msg-1',
    phone_number: '5511999999999',
    message_text: 'Oi, pode me enviar o boleto atualizado?',
    message_type: 'received',
    timestamp: new Date().toISOString(),
    read_status: true,
    created_at: new Date().toISOString(),
  } as WhatsAppConversation,
  {
    id: 'msg-2',
    phone_number: '5511999999999',
    message_text: 'Claro, vou verificar aqui.',
    message_type: 'sent',
    timestamp: new Date().toISOString(),
    read_status: true,
    created_at: new Date().toISOString(),
  } as WhatsAppConversation,
];

const ranked = rankQuickRepliesForConversation(replies, {
  conversationHistory: conversation,
});

assert.strictEqual(ranked[0]?.id, '2');
assert.strictEqual(ranked[1]?.id, '1');

const leadKeywords = ['Em negociação'];
const topReplies = findTopQuickReplies(replies, {
  conversationHistory: conversation,
  additionalKeywords: leadKeywords,
});

assert.strictEqual(topReplies.length, 3);
assert.strictEqual(topReplies[0]?.id, '2');

console.log('quickReplyRanking tests passed');
