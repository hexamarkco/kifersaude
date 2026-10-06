import { getMessageContent, type MessageRow } from './comm-whatsapp-transcript.ts';

// Rows must be ordered newest first, matching the worker's inbound query.
export const getLatestAutonomousInboundMessageId = (messages: readonly MessageRow[]): string | null => (
  messages.find((message) => message.direction === 'inbound' && Boolean(getMessageContent(message)))?.id ?? null
);

/**
 * A resposta autonoma so pode ser enviada se a ultima mensagem recebida
 * continua sendo exatamente a que embasou o prompt. Uma nova mensagem durante
 * a geracao torna a resposta obsoleta: o proximo job vai montar o contexto
 * com o turno completo do cliente.
 */
export const isAutonomousReplyStale = (
  promptInboundMessageId: string,
  latestInboundMessageId: string | null,
) => latestInboundMessageId !== promptInboundMessageId;
