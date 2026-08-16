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
 * Intervalo de polling do estado operacional do canal: quando o canal está
 * conectado, poll mais espaçado. Quando não está, poll mais frequente para
 * detectar a reconexão mais rápido.
 */
export const computeOperationalStatePollIntervalMs = (
  isChannelConnected: boolean,
  connectedIntervalMs: number,
  degradedIntervalMs: number,
): number => (isChannelConnected ? connectedIntervalMs : degradedIntervalMs);
