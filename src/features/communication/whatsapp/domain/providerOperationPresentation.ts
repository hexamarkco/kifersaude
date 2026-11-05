import type { ZapiJson } from './zapiOperationContract.generated';

const choices: Record<string, string> = {
  block: 'Bloquear', unblock: 'Desbloquear', pin: 'Fixar', unpin: 'Desafixar',
  '24_hours': '24 horas', '7_days': '7 dias', '30_days': '30 dias',
  GOING: 'Vou participar', NOT_GOING: 'Não vou participar', CALL: 'Ligação', URL: 'Link', REPLY: 'Resposta',
  PHONE: 'Telefone', EMAIL: 'E-mail', EVP: 'Chave aleatória', cpf: 'CPF', cnpj: 'CNPJ', phone: 'Telefone', email: 'E-mail', randomKey: 'Chave aleatória',
  SMALL: 'Pequena', MEDIUM: 'Média', LARGE: 'Grande', pending: 'Pendente', processing: 'Em andamento',
  shipped: 'Enviado', completed: 'Concluído', canceled: 'Cancelado', paid: 'Pago', voice: 'Voz', video: 'Vídeo',
  admins: 'Administradores', all: 'Todos', basic: 'Reações básicas', RECOMMENDED: 'Recomendados', TRENDING: 'Em alta', POPULAR: 'Populares', NEW: 'Novos',
  OWNER: 'Proprietário', ADMIN: 'Administrador', SUBSCRIBER: 'Seguidor',
};
export const providerChoiceLabel = (value: string) => choices[value] || value;

const labels: Record<string, string> = {
  id: 'Identificador', phone: 'Telefone ou conversa', broadcastId: 'Lista', name: 'Nome', subject: 'Nome do grupo',
  title: 'Título', description: 'Descrição', notify: 'Nome no WhatsApp', short: 'Nome curto', vname: 'Nome comercial',
  imgUrl: 'Foto', link: 'Endereço', invitationLink: 'Convite', phoneNumber: 'Telefone', displayName: 'Nome',
  exists: 'Possui WhatsApp', inputPhone: 'Telefone consultado', outputPhone: 'Telefone confirmado',
  lid: 'Identificador do contato', communityId: 'Comunidade', value: 'Confirmação do provedor', success: 'Confirmação do provedor',
  subscribersCount: 'Seguidores', username: 'Nome de usuário', role: 'Papel no canal', about: 'Recado',
};

export function providerResultFields(value: ZapiJson): Array<{ label: string; value: string }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [{ label: 'Resultado', value: typeof value === 'boolean' ? value ? 'Sim' : 'Não' : String(value ?? '') }];
  }
  return Object.entries(value).flatMap(([key, item]) => labels[key] && (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
    ? [{ label: labels[key], value: typeof item === 'boolean' ? item ? 'Sim' : 'Não' : key === 'role' ? providerChoiceLabel(String(item)) : String(item) }] : []);
}
