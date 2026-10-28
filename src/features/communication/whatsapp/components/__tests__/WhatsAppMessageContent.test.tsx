import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { test, vi } from 'vitest';
import type { CommWhatsAppMessage } from '../../domain/types';
import { WhatsAppMessageBody } from '../WhatsAppMessageContent';

vi.mock('../../hooks/useResolvedMediaUrl', () => ({
  useResolvedMediaUrl: () => ({ mediaUrl: null, loading: false, error: null, retry: vi.fn() }),
}));

const renderMessage = (messageType: string, interactive: Record<string, unknown>, direction: CommWhatsAppMessage['direction'] = 'inbound', metadata: Record<string, unknown> = { interactive }) => {
  const message: CommWhatsAppMessage = {
    id: 'message-1', chat_id: 'chat-1', channel_id: 'channel-1', external_message_id: 'external-1',
    direction, message_type: messageType, delivery_status: 'received', text_content: '[Lista]',
    message_at: '2026-10-01T12:00:00Z', created_at: '2026-10-01T12:00:00Z', metadata,
  };
  return renderToStaticMarkup(<WhatsAppMessageBody
    message={message} onOpenImage={vi.fn()} onOpenQuotedMessage={vi.fn()} onTranscribe={vi.fn()}
    onSelectInteractiveReply={vi.fn()} onOpenSharedContactChat={vi.fn()} onSaveSharedContact={vi.fn()}
    sharedContactActionKey={null} transcribing={false} mediaSending={false} mediaSendingProgress={null}
  />);
};

test('alinha o texto das mensagens à esquerda sem esticar os espaços', () => {
  const markup = renderMessage('text', {}, 'outbound', {});

  assert.ok(markup.includes('text-left'));
  assert.ok(!markup.includes('text-justify'));
});

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

for (const direction of ['inbound', 'outbound'] as const) {
  test(`renders ${direction} location with address and a map link`, () => {
    const markup = renderMessage('location', {}, direction, {
      location: { latitude: -22.9, longitude: -43.2, name: 'Clínica', address: 'Rua A, 12' },
    });
    for (const text of ['Localização compartilhada', 'Clínica', 'Rua A, 12', 'Abrir no mapa', 'query=-22.9%2C-43.2', 'noopener noreferrer']) {
      assert.ok(markup.includes(text));
    }
    assert.ok(!markup.includes('[Lista]'));
    assert.ok(markup.includes('<iframe'));
    assert.ok(markup.includes('www.openstreetmap.org/export/embed.html?'));
    assert.ok(markup.includes('marker=-22.9%2C-43.2'));
    assert.ok(markup.includes('title="Mapa: Clínica"'));
    assert.ok(markup.includes('loading="lazy"'));
  });
}

test('renders historical locations without coordinates without an invalid map link', () => {
  const markup = renderMessage('location', {}, 'inbound', {});
  assert.ok(markup.includes('Coordenadas indisponíveis'));
  assert.ok(!markup.includes('href='));
  assert.ok(!markup.includes('<iframe'));
});

test('labels live locations as the last received position', () => {
  const markup = renderMessage('live_location', {}, 'inbound', { location: { latitude: 0, longitude: 0 } });
  assert.ok(markup.includes('Localização em tempo real'));
  assert.ok(markup.includes('Última posição recebida'));
  assert.ok(markup.includes('marker=0%2C0'));
});

for (const location of [
  { latitude: 91, longitude: -43.2 },
  { latitude: -22.9, longitude: -181 },
  { latitude: '', longitude: -43.2 },
  { latitude: -22.9 },
]) {
test(`does not embed a map for invalid coordinates: ${JSON.stringify(location)}`, () => {
  const markup = renderMessage('location', {}, 'inbound', { location });
  assert.ok(markup.includes('Coordenadas indisponíveis'));
  assert.ok(!markup.includes('<iframe'));
  assert.ok(!markup.includes('href='));
});
}
