import { formatCommWhatsAppPhoneLabel } from '../../../src/features/communication/whatsapp/domain/phonePresentation';

type FixtureMessage = Record<string, unknown> & {
  id: string;
  status: string;
  scheduled_at: string;
  next_run_at: string | null;
  phone_digits: string;
  text_content: string | null;
  display_name: string | null;
  label: string | null;
};

type FixtureSequence = Record<string, unknown> & {
  id: string;
  status: string;
  scheduled_at: string;
  phone_digits: string;
  display_name: string | null;
  label: string | null;
};

const mode = new URLSearchParams(window.location.search).get('mode');
const now = new Date();
const future = (days: number, hour = 15) => {
  const value = new Date(now);
  value.setDate(value.getDate() + days);
  value.setHours(hour, 30, 0, 0);
  return value.toISOString();
};

function message(index: number, status: string, days: number, text: string, error?: string): FixtureMessage {
  const when = future(days, 10 + index);
  return {
    id: `preview-message-${index}`,
    channel_id: 'preview-channel',
    chat_id: `preview-chat-${index}`,
    chat: null,
    phone_digits: `55219999999${String(index).padStart(2, '0')}`,
    phone_number: `+55 21 99999-99${String(index).padStart(2, '0')}`,
    display_name: ['Mariana Costa', 'Eduardo Martins', 'Patrícia Nunes', 'Ana Clara', 'Rafael Mendes', 'Luiza Ferreira'][index % 6],
    message_type: 'text',
    text_content: text,
    media_url: null,
    media_mime_type: null,
    media_file_name: null,
    media_size_bytes: null,
    scheduled_at: when,
    recurrence: index === 1 ? 'weekly' : 'none',
    recurrence_config: {},
    next_run_at: null,
    recurrence_ends_at: null,
    cancel_on_inbound_message: false,
    status,
    attempts: status === 'failed' ? 2 : 0,
    max_attempts: 3,
    last_attempt_at: null,
    next_retry_at: null,
    error_message: error ?? null,
    external_message_id: null,
    delivery_status: null,
    sent_at: status === 'sent' ? when : null,
    cancelled_at: status === 'cancelled' ? when : null,
    cancelled_reason: null,
    created_by: null,
    lead_id: null,
    contract_id: null,
    reminder_id: null,
    sequence_id: null,
    sequence_step_id: null,
    label: index === 0 ? 'Retorno do plano familiar' : null,
    notes: null,
    metadata: {},
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

const messages: FixtureMessage[] = [
  ...Array.from({ length: 7 }, (_, index) => message(index, 'scheduled', index + 1, [
    'Olá, Mariana! Passando para confirmar nosso retorno sobre as opções do plano familiar.',
    'Oi, Eduardo! Separei as informações que você pediu e posso ajudar com qualquer dúvida.',
    'Olá, Patrícia! Tudo bem? Podemos retomar nossa conversa sobre a proposta?',
  ][index % 3])),
  message(7, 'failed', -1, 'Ana, tivemos uma instabilidade ao enviar o lembrete. Vamos tentar novamente?', 'Falha temporária no envio.'),
  message(8, 'sent', -2, 'Rafael, obrigado pelo retorno. Fico à disposição para ajudar.',),
  message(9, 'cancelled', -3, 'Luiza, este envio foi cancelado antes do horário programado.'),
];

const sequence = (index: number, status: string, days: number): FixtureSequence => ({
  id: `preview-sequence-${index}`,
  channel_id: 'preview-channel',
  chat_id: `preview-sequence-chat-${index}`,
  chat: null,
  phone_digits: `55219888888${String(index).padStart(2, '0')}`,
  phone_number: `+55 21 98888-88${String(index).padStart(2, '0')}`,
  display_name: ['Beatriz Rocha', 'João Pedro', 'Camila Souza'][index % 3],
  lead_id: null,
  contract_id: null,
  reminder_id: null,
  label: ['Retorno após proposta', 'Acompanhamento da cotação', 'Revisão de documentação'][index % 3],
  status,
  scheduled_at: future(days, 14),
  current_step_index: 0,
  cancel_on_inbound_message: true,
  last_error: status === 'paused' ? 'Número indisponível. Revise o contato para retomar.' : null,
  paused_at: status === 'paused' ? now.toISOString() : null,
  cancelled_at: null,
  completed_at: null,
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
  steps: [{
    stepIndex: 0,
    delaySeconds: 86_400,
    dueAt: future(days, 14),
    messageType: 'text',
    textContent: 'Olá! Gostaria de saber se posso ajudar com a proposta enviada.',
    status: 'pending',
    actions: [],
  }],
});

const sequences: FixtureSequence[] = [
  sequence(0, 'scheduled', 2),
  sequence(1, 'scheduled', 4),
  sequence(2, 'paused', -1),
  sequence(3, 'completed', -4),
];

async function waitIfRequested() {
  if (mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 30_000));
  if (mode === 'error') throw new Error('Fixture de indisponibilidade');
}

function filterItems<T extends { status: string; scheduled_at: string; next_run_at?: string | null; text_content?: string | null; display_name?: string | null; label?: string | null; error_message?: string | null; last_error?: string | null }>(
  items: T[],
  filters: Record<string, unknown> = {},
): T[] {
  const statuses = filters.statuses as string[] | undefined;
  const search = String(filters.search ?? filters.searchQuery ?? '').trim().toLocaleLowerCase('pt-BR');
  const start = String(filters.startDate ?? filters.start_date ?? '');
  const end = String(filters.endDate ?? filters.end_date ?? '');
  return items.filter((item) => {
    if (mode === 'empty' && statuses?.includes('scheduled')) return false;
    if (statuses?.length && !statuses.includes(item.status)) return false;
    const timestamp = item.next_run_at ?? item.scheduled_at;
    if (start && timestamp < `${start}T00:00:00`) return false;
    if (end && timestamp > `${end}T23:59:59`) return false;
    if (search && ![item.text_content, item.display_name, item.label, item.error_message, item.last_error].some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(search))) return false;
    return true;
  });
}

export const commWhatsAppService = {
  async listScheduledMessages(filters: Record<string, unknown> = {}) {
    await waitIfRequested();
    const filtered = filterItems(messages, filters);
    const offset = Number(filters.offset ?? 0);
    const limit = Number(filters.limit ?? 100);
    return filtered.slice(offset, offset + limit);
  },
  async listScheduledSequences(filters: Record<string, unknown> = {}) {
    await waitIfRequested();
    const filtered = filterItems(sequences, filters);
    const offset = Number(filters.offset ?? 0);
    const limit = Number(filters.limit ?? 100);
    return filtered.slice(offset, offset + limit);
  },
  async countScheduledMessages(filters: Record<string, unknown> = {}) {
    await waitIfRequested();
    return filterItems(messages, filters).length;
  },
  async countScheduledSequences(filters: Record<string, unknown> = {}) {
    await waitIfRequested();
    return filterItems(sequences, filters).length;
  },
  async lookupSavedContactsByPhones() {
    await waitIfRequested();
    return [];
  },
  async cancelScheduledMessage() {},
  async deleteScheduledMessage() {},
  async cancelScheduledSequence() {},
  async retryScheduledSequence() {},
};

export { formatCommWhatsAppPhoneLabel };
