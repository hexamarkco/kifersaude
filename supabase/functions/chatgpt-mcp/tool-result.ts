const MAX_TEXT_RESPONSE_LENGTH = 40_000;
const SENSITIVE_KEY = /(?:^|_)(?:access_?token|api_?key|secret|password|credential|authorization|bearer|webhook_?secret|service_?role|private_?key|refresh_?token)(?:$|_)/i;

const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [
    key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitize(child),
  ]));
};

export const toMcpToolResult = (value: unknown) => {
  const sanitized = sanitize(value);
  const pretty = JSON.stringify(sanitized, null, 2);
  const output = pretty.length <= MAX_TEXT_RESPONSE_LENGTH ? pretty : JSON.stringify(sanitized);
  if (output.length <= MAX_TEXT_RESPONSE_LENGTH) {
    return { content: [{ type: 'text', text: output }] };
  }
  // A tool may already have committed a mutation. A large response must never
  // look like a failed action that can safely be repeated with a new key.
  return {
    content: [{ type: 'text', text: JSON.stringify({
      response_truncated: true,
      error_code: 'RESPONSE_TOO_LARGE',
      action_success: sanitized && typeof sanitized === 'object' && 'success' in sanitized ? sanitized.success : null,
      message: 'A ferramenta terminou, mas a resposta excede o limite. Consulte com page_size menor ou filtros mais específicos; em fluxos, use include_steps=false. Não repita ações de escrita: consulte o registro ou reutilize a mesma chave idempotente para recuperar o resultado.',
    }) }],
    isError: true,
  };
};
