import type { PublicLinkItem, PublicLinkPageSettings } from '../../../src/features/public-content/domain/types';

const now = '2026-10-30T12:00:00.000Z';
const settings: PublicLinkPageSettings = {
  id: 'settings-demo',
  title: 'Kifer Saúde',
  subtitle: 'Cuidado acessível para sua família',
  bio: 'Fale com nossa equipe e conheça as opções de planos de saúde.',
  avatar_url: null,
  is_verified: true,
  is_published: true,
  created_at: now,
  updated_at: now,
};
const items: PublicLinkItem[] = [
  ['quote', 'Formulário de cotação', 'https://example.invalid/forms/demo', true, 8],
  ['whatsapp', 'Canal WhatsApp', 'https://example.invalid/whatsapp', true, 42],
  ['link', 'Página de atendimento', 'https://example.invalid/atendimento', true, 21],
  ['globe', 'Site Kifer Saúde', 'https://example.invalid', false, 13],
  ['instagram', 'Instagram', 'https://example.invalid/instagram', true, 18],
  ['facebook', 'Facebook', 'https://example.invalid/facebook', true, 6],
  ['youtube', 'YouTube', 'https://example.invalid/youtube', true, 5],
  ['link', 'Conteúdos de saúde', 'https://example.invalid/blog', true, 9],
].map(([icon, title, url, is_active, click_count], index) => ({
  id: `link-demo-${index + 1}`,
  icon: String(icon),
  title: String(title),
  url: String(url),
  is_active: Boolean(is_active),
  position: index + 1,
  click_count: Number(click_count),
  created_at: now,
  updated_at: now,
}));

const blockWrite = async (): Promise<never> => {
  throw new Error('Escritas bloqueadas nesta prévia sintética.');
};

export const linksService = {
  getLinkPageSettings: async (): Promise<PublicLinkPageSettings> => ({ ...settings }),
  getLinkItems: async (): Promise<PublicLinkItem[]> => items.map((item) => ({ ...item })),
  saveLinkPageSettings: blockWrite,
  createLinkItem: blockWrite,
  updateLinkItem: blockWrite,
  deleteLinkItem: blockWrite,
  reorderLinkItems: blockWrite,
};
