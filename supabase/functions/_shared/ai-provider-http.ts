/** Only structural request metadata may leave this boundary. Never log response bodies. */
export type AiHttpTrace = {
  correlationId: string;
  endpoint: 'responses' | 'chat/completions';
  model: string;
  contentType: string;
  payloadCharacters: number;
  payloadBytes: number;
  payloadHash: string;
  fieldTypes: Record<string, string>;
};

export const prepareAiJsonRequest = async (
  body: object,
  endpoint: AiHttpTrace['endpoint'],
  correlationId?: string,
): Promise<{ serialized: string; trace: AiHttpTrace }> => {
  // Validate and hash the very same immutable string passed to fetch.
  const serialized = JSON.stringify(body);
  const parsed: Record<string, unknown> = JSON.parse(serialized);
  const bytes = new TextEncoder().encode(serialized);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return {
    serialized,
    trace: {
      correlationId: correlationId ?? crypto.randomUUID(), endpoint,
      model: typeof parsed.model === 'string' ? parsed.model : 'unknown',
      contentType: 'application/json', payloadCharacters: serialized.length, payloadBytes: bytes.length,
      payloadHash: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
      fieldTypes: Object.fromEntries(Object.entries(parsed).map(([key, value]) => [
        key, value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
      ])),
    },
  };
};

export const parseRetryAfterMs = (value: string | null, now = Date.now()): number | null => {
  if (!value?.trim()) return null;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) && delay >= 0 ? delay : null;
};

export class AiProviderHttpError extends Error {
  readonly retryable: boolean;
  constructor(readonly status: number, readonly code: string, readonly retryAfterMs: number | null) {
    super(`OpenAI retornou erro HTTP ${status} (${code}).`);
    this.name = 'AiProviderHttpError';
    this.retryable = status === 408 || status === 409 || status === 429 || status >= 500;
    if (code === 'insufficient_quota') this.retryable = false;
  }
}

export const readAiProviderHttpError = (response: Response, responseText: string): AiProviderHttpError => {
  let code = 'provider_http_error';
  try {
    const payload: unknown = JSON.parse(responseText);
    if (payload && typeof payload === 'object' && 'error' in payload) {
      const error = payload.error;
      if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
        // Do not copy arbitrary upstream strings (which can echo input) into logs.
        const allowed = ['invalid_json', 'invalid_request_error', 'invalid_api_key', 'insufficient_quota',
          'rate_limit_exceeded', 'slow_down', 'server_error', 'unsupported_parameter'];
        if (allowed.includes(error.code)) code = error.code;
      }
    }
  } catch { /* An HTML/plain-text failure is still classified by its HTTP status. */ }
  return new AiProviderHttpError(response.status, code, parseRetryAfterMs(response.headers.get('retry-after')));
};

export class AiGenerationError extends Error {
  constructor(message: string, readonly providerError: AiProviderHttpError | null) {
    super(message);
    this.name = 'AiGenerationError';
  }
}

export const getAiProviderFailure = (error: unknown): AiProviderHttpError | null => (
  error instanceof AiProviderHttpError ? error : error instanceof AiGenerationError ? error.providerError : null
);
