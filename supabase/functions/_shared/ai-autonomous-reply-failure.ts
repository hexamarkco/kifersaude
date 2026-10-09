const MAX_JOB_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [15_000, 60_000, 180_000] as const;

const isTerminalError = (message: string): boolean => {
  const normalized = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /whapi_token nao configurado|identidade do whatsapp|permissao de contato|atendimento autonomo foi desativado|chat sem lead vinculado|status atendimento nao encontrado/.test(normalized);
};

export const getAutonomousRetryDelayMs = (attemptNumber: number): number => (
  RETRY_DELAYS_MS[Math.min(Math.max(attemptNumber - 1, 0), RETRY_DELAYS_MS.length - 1)]
);

export const getAutonomousFailureAction = (params: {
  message: string;
  attemptNumber: number;
  deliveryAttemptStarted: boolean;
}): 'retry' | 'handoff' | 'failed' => {
  if (params.deliveryAttemptStarted || isTerminalError(params.message)) return 'failed';
  if (params.attemptNumber < MAX_JOB_ATTEMPTS) return 'retry';
  // Only exhausted generation failures stop automation for human review.
  // Delivery ambiguity and terminal permission errors retain their contracts.
  return params.message.startsWith('Nao foi possivel gerar resposta por IA.') ? 'handoff' : 'failed';
};
