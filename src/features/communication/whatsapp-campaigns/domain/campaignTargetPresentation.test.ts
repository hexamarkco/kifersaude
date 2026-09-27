import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getCampaignTargetDisplayName } from './campaignTargetPresentation';
import type { CommWhatsAppCampaignTargetListItem } from '../commWhatsAppCampaignService';

const createTarget = (overrides: Partial<CommWhatsAppCampaignTargetListItem> = {}): CommWhatsAppCampaignTargetListItem => ({
  id: 'target-1',
  phone_number: '5521982965495',
  phone_digits: '5521982965495',
  display_name: 'Mariangela - Cliente',
  status: 'pending',
  current_step_index: 0,
  next_send_at: null,
  last_attempt_at: null,
  error_message: null,
  chat: null,
  ...overrides,
});

test('prefers the current saved chat name over the campaign snapshot', () => {
  assert.equal(
    getCampaignTargetDisplayName(createTarget({
      chat: {
        display_name: 'Mariangela',
        phone_number: '5521982965495',
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

test('falls back to the campaign snapshot when the chat was removed', () => {
  assert.equal(getCampaignTargetDisplayName(createTarget()), 'Mariangela - Cliente');
});
