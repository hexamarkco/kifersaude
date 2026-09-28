export const INBOX_POLLING_INTERVALS = {
  chats: 8000,
  maxChatIdle: 30000,
  maxChatBackoff: 60000,
  archivedChatCount: 30000,
  messages: 5000,
  messageSafetyNet: 20000,
  operationalState: 30000,
  operationalStateDegraded: 10000,
} as const;

/**
 * Intervalo de polling de mensagens: quando o Realtime confirmou SUBSCRIBED,
 * o polling vira só uma rede de segurança (intervalo mais longo). Quando o
 * Realtime está em fallback/degradado, volta ao intervalo rápido.
 */
export const computeMessagePollIntervalMs = (
  isRealtimeHealthy: boolean,
  baseIntervalMs: number,
  safetyNetIntervalMs: number,
): number => (isRealtimeHealthy ? safetyNetIntervalMs : baseIntervalMs);

/**
 * A lista de conversas pode ficar ociosa por bastante tempo enquanto o
 * Realtime entrega as mudanças. Nesses ciclos sem alteração, aumentamos o
 * intervalo de segurança gradualmente, sem ultrapassar o limite informado.
 * Um evento Realtime ou uma carga que mudou a lista deve zerar o contador.
 */
export const computeChatPollIntervalMs = (
  idleCycles: number,
  baseIntervalMs: number,
  maxIntervalMs: number,
): number => {
  const safeIdleCycles = Math.max(0, Math.floor(idleCycles));
  const safeBaseInterval = Math.max(0, baseIntervalMs);
  const safeMaxInterval = Math.max(safeBaseInterval, maxIntervalMs);

  return Math.min(
    safeBaseInterval * (2 ** safeIdleCycles),
    safeMaxInterval,
  );
};

/**
 * Intervalo de polling do estado operacional do canal: quando o canal está
 * conectado, poll mais espaçado. Quando não está, poll mais frequente para
 * detectar a reconexão mais rápido.
 */
export const computeOperationalStatePollIntervalMs = (
  isChannelConnected: boolean,
  connectedIntervalMs: number,
  degradedIntervalMs: number,
): number => (isChannelConnected ? connectedIntervalMs : degradedIntervalMs);
