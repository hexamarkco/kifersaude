import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getScheduledContactDisplayName } from '../scheduledContactPresentation';
import type { CommWhatsAppScheduledMessage } from '../types';

const createScheduledMessage = (overrides: Partial<CommWhatsAppScheduledMessage> = {}): CommWhatsAppScheduledMessage => ({
  id: 'scheduled-1',
  channel_id: 'channel-1',
  chat_id: 'chat-1',
  chat: null,
  phone_digits: '5521982965495',
  phone_number: '+55 21 98296-5495',
  display_name: 'Mariangela - Cliente',
  message_type: 'text',
  text_content: 'Olá',
  media_url: null,
  media_mime_type: null,
  media_file_name: null,
  media_size_bytes: null,
  scheduled_at: '2026-09-26T12:00:00.000Z',
  recurrence: 'none',
  recurrence_config: {},
  next_run_at: null,
  recurrence_ends_at: null,
  cancel_on_inbound_message: true,
  status: 'scheduled',
  attempts: 0,
  max_attempts: 3,
  last_attempt_at: null,
  next_retry_at: null,
  error_message: null,
  external_message_id: null,
  delivery_status: null,
  sent_at: null,
  cancelled_at: null,
  cancelled_reason: null,
  created_by: null,
  lead_id: null,
  contract_id: null,
  reminder_id: null,
  sequence_id: null,
  sequence_step_id: null,
  label: null,
  notes: null,
  metadata: {},
  created_at: '2026-09-26T10:00:00.000Z',
  updated_at: '2026-09-26T10:00:00.000Z',
  ...overrides,
});

test('prefere o nome salvo atual do chat ao nome histórico do agendamento', () => {
  assert.equal(
    getScheduledContactDisplayName(createScheduledMessage({
      chat: {
        display_name: 'Mariangela',
        phone_number: '+55 21 98296-5495',
        phone_digits: '5521982965495',
        saved_contact_name: 'Mariangela',
        push_name: 'Mariangela - Cliente',
        lead_name: null,
        lead_id: null,
        is_group: false,
      },
    })),
    'Mariangela',
  );
});

test('usa o nome histórico quando o chat não existe mais', () => {
  assert.equal(getScheduledContactDisplayName(createScheduledMessage()), 'Mariangela - Cliente');
});
