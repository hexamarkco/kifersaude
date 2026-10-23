import assert from 'node:assert/strict';
import { test } from 'vitest';
import { projectRecoveryChats } from '../discovery.ts';

test('inventory includes direct and group chats without leaking message content', () => {
  assert.deepEqual(projectRecoveryChats([
    { id: '5511999999999@s.whatsapp.net', last_message: { timestamp: 1792700000, text: { body: 'private' } } },
    { id: 'status@broadcast' },
    { id: '123456789012345@lid', name: 'Private contact' },
  ], [{ id: '120363123456789012@g.us', last_message: { timestamp: 1792700000000 } }]), [
    { externalChatId: '5511999999999@s.whatsapp.net', lastMessageAt: 1792700000 },
    { externalChatId: '123456789012345@lid', lastMessageAt: null },
    { externalChatId: '120363123456789012@g.us', lastMessageAt: 1792700000 },
  ]);
});

test('deduplicates chats and keeps uncertain timestamps eligible for recovery', () => {
  assert.deepEqual(projectRecoveryChats([
    { id: '120363123456789012@g.us', last_message: { timestamp: 1792700000 } },
    { id: '5511999999999@s.whatsapp.net', last_message: { timestamp: 100 } },
  ], [
    { id: '120363123456789012@g.us' },
    { id: '5511999999999@s.whatsapp.net', last_message: { timestamp: 200 } },
  ]), [
    { externalChatId: '120363123456789012@g.us', lastMessageAt: null },
    { externalChatId: '5511999999999@s.whatsapp.net', lastMessageAt: 200 },
  ]);
});
