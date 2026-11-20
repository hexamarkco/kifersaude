import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WhatsAppInboxMobileShortcuts } from '../WhatsAppInboxMobileShortcuts';

const handlers = () => ({
  onOpenContact: vi.fn(),
  onOpenAgenda: vi.fn(),
  onOpenScheduleMessage: vi.fn(),
  onOpenScheduledMessages: vi.fn(),
  onOpenFollowUp: vi.fn(),
});

describe('WhatsAppInboxMobileShortcuts', () => {
  it('mantém acessíveis as ações operacionais do chat individual', () => {
    const html = renderToStaticMarkup(
      <WhatsAppInboxMobileShortcuts isGroup={false} followUpDisabledReason={null} {...handlers()} />,
    );
    expect(html).toContain('Ações rápidas da conversa');
    for (const label of ['Contato', 'Agenda', 'Programar', 'Agendadas', 'Follow-up']) {
      expect(html).toContain(label);
    }
  });

  it('não oferece informações de lead ou follow-up para grupos', () => {
    const html = renderToStaticMarkup(
      <WhatsAppInboxMobileShortcuts isGroup followUpDisabledReason={null} {...handlers()} />,
    );
    expect(html).not.toContain('>Contato</');
    expect(html).not.toContain('>Follow-up</');
    expect(html).toContain('Agendadas');
  });

  it('respeita ações indisponíveis sem simular envio ou acesso à agenda', () => {
    const html = renderToStaticMarkup(
      <WhatsAppInboxMobileShortcuts
        isGroup={false}
        followUpDisabledReason="Sem contexto para gerar follow-up"
        onOpenContact={vi.fn()}
        onOpenScheduledMessages={vi.fn()}
        onOpenFollowUp={vi.fn()}
      />,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('Sem contexto para gerar follow-up');
  });
});
