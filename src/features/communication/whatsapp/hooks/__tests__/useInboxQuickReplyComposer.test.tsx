import assert from 'node:assert/strict';
import { useState } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppLeadPanel } from '../../data';
import type { WhatsAppQuickReply } from '../../domain/quickReplies';
import type { CommWhatsAppChat } from '../../domain/types';
import { useInboxQuickReplyComposer } from '../useInboxQuickReplyComposer';

type Controller = ReturnType<typeof useInboxQuickReplyComposer>;
type Snapshot = Controller & { activeIndex: number; dismissed: string | null };

const createChat = (overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: 'chat-1@s.whatsapp.net',
  is_group: false,
  phone_number: '+55 11 99999-9999',
  phone_digits: '5511999999999',
  display_name: 'Marina Silva',
  saved_contact_name: 'Marina Silva',
  lead_id: 'lead-1',
  merged_into_chat_id: null,
  lead_link_source: 'manual',
  lead_linked_at: null,
  lead_linked_by: null,
  auto_link_blocked: false,
  identity_conflict: false,
  is_archived: false,
  is_muted: false,
  is_pinned: false,
  manual_unread: false,
  last_message_direction: 'inbound',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const createQuickReply = (overrides: Partial<WhatsAppQuickReply> = {}): WhatsAppQuickReply => ({
  id: 'reply-1',
  name: 'Outra resposta',
  shortcut: 'resposta',
  text: 'Texto da resposta',
  created_at: null,
  updated_at: null,
  ...overrides,
});

const defaultOptions = {
  quickReplies: [] as WhatsAppQuickReply[],
  quickRepliesLoadError: false,
  selectedChat: createChat(),
  selectedChatForPresentation: createChat(),
  leadPanel: {
    id: 'lead-1',
    nome_completo: 'Marina Silva',
    telefone: '+55 11 99999-9999',
  } satisfies CommWhatsAppLeadPanel,
  connectedUserName: 'Equipe Kifer',
  messageDraft: '/sa',
  composerSelection: { start: 3, end: 3 },
  composerFocused: true,
};

const Harness = ({
  options,
  initialActiveIndex = 0,
  initialDismissed = null,
  capture,
}: {
  options: typeof defaultOptions;
  initialActiveIndex?: number;
  initialDismissed?: string | null;
  capture: (snapshot: Snapshot) => void;
}) => {
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const [dismissed, setDismissed] = useState<string | null>(initialDismissed);
  const controller = useInboxQuickReplyComposer({
    ...options,
    setQuickReplyActiveIndex: setActiveIndex,
    dismissedQuickReplyKey: dismissed,
    setDismissedQuickReplyKey: setDismissed,
  });
  capture({ ...controller, activeIndex, dismissed });
  return null;
};

const latest = (snapshots: Snapshot[]) => snapshots[snapshots.length - 1];

test('ordena resultados, resolve variáveis e torna atalhos duplicados determinísticos', () => {
  const snapshots: Snapshot[] = [];
  const view = render(
    <Harness
      options={{
        ...defaultOptions,
        quickReplies: [
          createQuickReply({ id: 'shortcut-1', shortcut: 'sa', text: 'Oi {{primeiro_nome}}' }),
          createQuickReply({ id: 'shortcut-2', shortcut: 'sa', text: 'Segunda resposta' }),
          createQuickReply({ id: 'name', name: 'Saudação', shortcut: 'cumprimento', text: 'Terceira resposta' }),
          createQuickReply({ id: 'body', name: 'Geral', shortcut: 'responder', text: 'Usar saudação no atendimento' }),
        ],
      }}
      capture={(snapshot) => snapshots.push(snapshot)}
    />,
  );

  const snapshot = latest(snapshots);
  assert.ok(snapshot);
  assert.deepEqual(snapshot.filteredQuickReplyOptions.map((option) => option.id), [
    'shortcut-1',
    'shortcut-2',
    'name',
    'body',
  ]);
  assert.deepEqual(snapshot.filteredQuickReplyOptions.slice(0, 2).map((option) => option.shortcut), ['sa', 'sa-2']);
  assert.equal(snapshot.filteredQuickReplyOptions[0]?.text, 'Oi Marina');
  assert.equal(snapshot.filteredQuickReplyOptions[0]?.searchValue.includes('oi marina'), true);
  assert.equal(snapshot.activeQuickReplyKey, '0:sa');
  assert.equal(snapshot.quickReplyMenuOpen, true);
  assert.equal(snapshot.quickReplyMenuHasResults, true);
  view.unmount();
});

test('preserva o estado vazio de falha e corrige índice e sugestão dispensada', () => {
  const snapshots: Snapshot[] = [];
  const view = render(
    <Harness
      options={{
        ...defaultOptions,
        quickReplies: [],
        quickRepliesLoadError: true,
        messageDraft: '/ausente',
        composerSelection: { start: 8, end: 8 },
      }}
      initialActiveIndex={4}
      initialDismissed="0:anterior"
      capture={(snapshot) => snapshots.push(snapshot)}
    />,
  );

  const snapshot = latest(snapshots);
  assert.ok(snapshot);
  assert.equal(snapshot.activeQuickReplyKey, '0:ausente');
  assert.equal(snapshot.dismissed, null);
  assert.equal(snapshot.quickReplyMenuOpen, true);
  assert.equal(snapshot.quickReplyMenuHasResults, false);
  assert.equal(snapshot.quickReplyEmptyStateMessage, 'Não foi possível carregar as mensagens rápidas.');
  assert.equal(snapshot.activeIndex, 0);
  view.unmount();
});
