import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { test, vi } from 'vitest';
import type { CommWhatsAppMessage } from '../../domain/types';
import { WhatsAppMessageBody } from '../WhatsAppMessageContent';

vi.mock('../../hooks/useResolvedMediaUrl', () => ({
  useResolvedMediaUrl: () => ({ mediaUrl: null, loading: false, error: null, retry: vi.fn() }),
}));

const renderMessage = (messageType: string, interactive: Record<string, unknown>, direction: CommWhatsAppMessage['direction'] = 'inbound') => {
  const message: CommWhatsAppMessage = {
    id: 'message-1', chat_id: 'chat-1', channel_id: 'channel-1', external_message_id: 'external-1',
    direction, message_type: messageType, delivery_status: 'received', text_content: '[Lista]',
    message_at: '2026-10-01T12:00:00Z', created_at: '2026-10-01T12:00:00Z', metadata: { interactive },
  };
  return renderToStaticMarkup(<WhatsAppMessageBody
    message={message} onOpenImage={vi.fn()} onOpenQuotedMessage={vi.fn()} onTranscribe={vi.fn()}
    onSelectInteractiveReply={vi.fn()} onOpenSharedContactChat={vi.fn()} onSaveSharedContact={vi.fn()}
    sharedContactActionKey={null} transcribing={false} mediaSending={false} mediaSendingProgress={null}
  />);
};

for (const type of ['list', 'interactive']) {
test(`renders ${type} with section titles, option names and descriptions`, () => {
  const markup = renderMessage(type, {
    kind: 'list', header: 'Atendimento', body: 'Escolha uma opção', footer: 'Kifer Saúde',
    sections: [{ title: 'Planos', rows: [{ id: 'pme', title: 'PME', description: 'Empresarial' }] }],
  });
  for (const text of ['Atendimento', 'Escolha uma opção', 'Kifer Saúde', 'Planos', 'PME', 'Empresarial']) {
    assert.ok(markup.includes(text));
  }
  assert.ok(!markup.includes('[Lista]'));
  assert.ok(!markup.includes('disabled=""'));
});
}

test('outbound list options are disabled', () => {
  const markup = renderMessage('list', { kind: 'list', sections: [{ rows: [{ id: 'pme', title: 'PME' }] }] }, 'outbound');
  assert.ok(markup.includes('disabled=""'));
});

test('renders selected list replies', () => {
  const markup = renderMessage('reply', { kind: 'reply', selectedReply: { id: 'pme', title: 'PME' } });
  assert.ok(markup.includes('Opção selecionada'));
  assert.ok(markup.includes('PME'));
});
