import { describe, expect, it } from 'vitest';

import {
  COMM_WHATSAPP_TRANSIENT_PRESENCE_TTL_MS,
  getCommWhatsAppPresencePresentation,
} from '../presence';

describe('WhatsApp presence presentation', () => {
  it('shows typing and recording states', () => {
    expect(getCommWhatsAppPresencePresentation({ presence_status: 'typing', presence_updated_at: new Date().toISOString(), presence_last_seen_at: null })?.label).toBe('digitando…');
    expect(getCommWhatsAppPresencePresentation({ presence_status: 'recording', presence_updated_at: new Date().toISOString(), presence_last_seen_at: null })?.label).toBe('gravando áudio…');
  });

  it('expires transient states and falls back to last seen', () => {
    const updatedAt = new Date(Date.now() - COMM_WHATSAPP_TRANSIENT_PRESENCE_TTL_MS - 1_000).toISOString();
    const result = getCommWhatsAppPresencePresentation({
      presence_status: 'typing',
      presence_updated_at: updatedAt,
      presence_last_seen_at: '2026-09-18T12:00:00.000Z',
    });

    expect(result?.status).toBe('offline');
    expect(result?.label).toContain('visto por último');
  });

  it('does not invent a last seen value without a timestamp', () => {
    expect(getCommWhatsAppPresencePresentation({ presence_status: 'unknown', presence_updated_at: null, presence_last_seen_at: null })).toBeNull();
  });
});
