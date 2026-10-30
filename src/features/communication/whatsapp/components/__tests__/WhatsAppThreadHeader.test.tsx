import assert from 'node:assert/strict';
import { createRef, type ComponentProps } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { WhatsAppThreadHeader } from '../WhatsAppThreadHeader';

const noop = () => undefined;

const createProps = (): ComponentProps<typeof WhatsAppThreadHeader> => ({
  selectedChat: {
    is_group: false,
    lead_id: 'lead-1',
    autonomous_attendance_status: 'active',
  } as CommWhatsAppChat,
  selectedChatDisplayName: 'Gisele Goulart (cliente)',
  isSelectedChatWaitingForQuote: false,
  assumingControl: false,
  chatFilesOpen: false,
  chatMessageSearchOpen: false,
  scheduledMessagesPanelOpen: false,
  copyingTranscript: false,
  syncingHistory: false,
  historyRecoveryDisabledReason: null,
  followUpGenerationDisabledReason: null,
  generatingFollowUp: false,
  threadActionsMenuOpen: false,
  contactContextPanelOpen: false,
  threadActionsMenuTriggerRef: createRef<HTMLButtonElement>(),
  chatAgendaSummary: {
    pendingCount: 1,
    nextReminder: { data_lembrete: '2026-10-30T14:30:00-03:00' },
  },
  nextChatReminderSummary: 'Próximo lembrete: conferir retorno sobre proposta · 30/10/2026 às 14:30',
  chatAgendaSummaryError: null,
  onBack: noop,
  onToggleAutonomousAttendance: noop,
  onOpenChatFiles: noop,
  onToggleChatMessageSearch: noop,
  onOpenScheduledMessages: noop,
  onCopyTranscript: noop,
  onRecoverHistory: noop,
  onOpenFollowUp: noop,
  onToggleContactContextPanel: noop,
  onToggleThreadActionsMenu: noop,
});

test('mantém no cabeçalho da conversa apenas o nome e o próximo lembrete', () => {
  const view = render(<WhatsAppThreadHeader {...createProps()} />);

  try {
    const header = view.container.querySelector('.whatsapp-inbox-thread-header');
    assert.ok(header);
    assert.match(header.textContent ?? '', /Gisele Goulart \(cliente\)/);
    assert.match(header.textContent ?? '', /Próximo lembrete: conferir retorno sobre proposta/);
    assert.equal(header.textContent?.includes('Renomear contato'), false);
    assert.equal(header.textContent?.includes('IA atendendo'), false);
    assert.equal(header.textContent?.includes('Responsável:'), false);
  } finally {
    view.unmount();
  }
});
