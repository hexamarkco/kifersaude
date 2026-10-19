import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { COMM_WHATSAPP_TRANSIENT_PRESENCE_TTL_MS } from '../../domain/presence';
import WhatsAppPresenceIndicator from '../WhatsAppPresenceIndicator';

test('restaura o preview quando a atividade expira sem outro evento de presença', async () => {
  vi.useFakeTimers();
  const view = render(<WhatsAppPresenceIndicator
    chat={{ presence_status: 'typing', presence_updated_at: new Date().toISOString() }}
    fallback={<span>Última mensagem</span>}
  />);

  try {
    assert.equal(view.container.textContent, 'digitando…');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(COMM_WHATSAPP_TRANSIENT_PRESENCE_TTL_MS + 1_000);
    });
    assert.equal(view.container.textContent, 'Última mensagem');
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});

test('substitui o preview por gravação de áudio e mantém fallback sem atividade', () => {
  const recording = render(<WhatsAppPresenceIndicator
    chat={{ presence_status: 'recording', presence_updated_at: new Date().toISOString() }}
    fallback="Última mensagem"
  />);
  try {
    assert.equal(recording.container.textContent, 'gravando áudio…');
  } finally {
    recording.unmount();
  }

  const idle = render(<WhatsAppPresenceIndicator chat={{ presence_status: 'unknown' }} fallback="Última mensagem" />);
  try {
    assert.equal(idle.container.textContent, 'Última mensagem');
  } finally {
    idle.unmount();
  }
});
