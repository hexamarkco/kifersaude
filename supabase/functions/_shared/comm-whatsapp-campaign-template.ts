import { formatGreetingTitle, getGreetingForDate } from './greeting.ts';

export type CommWhatsAppCampaignMessageContext = {
  name?: string | null;
  phone?: string | null;
  status?: string | null;
  responsible?: string | null;
  greeting?: string | null;
  now?: Date;
  timeZone?: string;
};

const formatFirstNameTitle = (value: string): string => {
  const trimmed = value.trim();
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}` : '';
};

const removeEmptyGreetingAddress = (value: string): string => value
  .replace(/\b(oi|olá|ola|bom dia|boa tarde|boa noite)\s*,\s*([!?.])/gi, '$1$2')
  .replace(/[ \t]+([,.!?])/g, '$1')
  .replace(/[ \t]{2,}/g, ' ')
  .trim();

/**
 * Single renderer for campaign previews and worker dispatches. Missing names
 * remain empty without manufacturing a contact name or leaving "Oi, !".
 */
export const resolveCommWhatsAppCampaignMessage = (
  template: string,
  context: CommWhatsAppCampaignMessageContext = {},
): string => {
  const name = context.name?.trim() || '';
  const greeting = context.greeting?.trim() || getGreetingForDate(
    context.now ?? new Date(),
    context.timeZone,
  );
  const replacements: Record<string, string> = {
    nome: name,
    primeiro_nome: formatFirstNameTitle(name.split(/\s+/).filter(Boolean)[0] || ''),
    telefone: context.phone?.trim() || '',
    status: context.status?.trim() || '',
    responsavel: context.responsible?.trim() || '',
    saudacao: greeting,
    saudacao_titulo: formatGreetingTitle(greeting),
    saudacao_capitalizada: formatGreetingTitle(greeting),
  };

  return removeEmptyGreetingAddress(
    template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => replacements[key] ?? ''),
  );
};
