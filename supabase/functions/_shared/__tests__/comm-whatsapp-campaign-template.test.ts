import { describe, expect, it } from 'vitest';
import { resolveCommWhatsAppCampaignMessage } from '../comm-whatsapp-campaign-template';

describe('campaign message renderer', () => {
  it('renders official variables and normalizes the first name deterministically', () => {
    expect(resolveCommWhatsAppCampaignMessage(
      'Oi, {{primeiro_nome}}! {{saudacao_titulo}} — {{telefone}}',
      { name: 'MARIA DE SOUZA', phone: '5521999991234', greeting: 'bom dia' },
    )).toBe('Oi, Maria! Bom dia — 5521999991234');
  });

  it('does not invent a name or leave an empty greeting address', () => {
    const rendered = resolveCommWhatsAppCampaignMessage(
      'Olá, {{primeiro_nome}}! Sou da Kifer Saúde.',
      { name: '', greeting: 'boa tarde' },
    );
    expect(rendered).toBe('Olá! Sou da Kifer Saúde.');
    expect(rendered).not.toContain('Oi, !');
    expect(rendered).not.toContain('Olá, !');
  });

  it('keeps unknown variables empty instead of leaking template syntax', () => {
    expect(resolveCommWhatsAppCampaignMessage('Olá {{campo_inexistente}}.', { greeting: 'boa noite' })).toBe('Olá.');
  });
});
