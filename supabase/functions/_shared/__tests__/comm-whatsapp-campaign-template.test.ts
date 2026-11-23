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
  it('uses the verified number of lives from the historical campaign proposal', () => {
    const result = resolveCommWhatsAppCampaignMessage(
      'Oi, {{primeiro_nome}}! {{contexto_historico}}',
      { name: 'ANA DE SOUZA', historicalLives: 3, greeting: 'bom dia' },
    );
    expect(result).toBe('Oi, Ana! Encontrei um registro anterior de uma proposta empresarial da Amil para *3 pessoas*.');
  });

  it('never makes up a life count when the source field is missing or invalid', () => {
    for (const historicalLives of [undefined, null, '', 'indefinido', 0, -1, 1000]) {
      const result = resolveCommWhatsAppCampaignMessage('{{contexto_historico}}', { historicalLives });
      expect(result).toBe('Encontrei um registro anterior de uma proposta empresarial da Amil.');
    }
    expect(resolveCommWhatsAppCampaignMessage('{{contexto_historico}}', { historicalLives: '2' }))
      .toContain('para *2 pessoas*');
    expect(resolveCommWhatsAppCampaignMessage('{{contexto_historico}}', { historicalLives: 1 }))
      .toContain('para *1 pessoa*');
  });

});
