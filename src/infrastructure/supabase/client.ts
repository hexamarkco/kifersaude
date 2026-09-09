import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';

import type { Database } from './database.generated';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseFunctionsUrl =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || `${supabaseUrl}/functions/v1`;

const SUPABASE_NETWORK_HELP =
  'Falha de rede ao conectar com o Supabase. Se o navegador mostrar erros de CORS ao mesmo tempo em auth, rest e rpc, o problema tende a ser bloqueio local de navegador/extensao/proxy ou indisponibilidade temporaria da rede, nao ausencia de CORS no codigo do app.';

const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
const AUTH_REQUEST_TIMEOUT_MS = 10_000;
const FUNCTION_REQUEST_TIMEOUT_MS = 60_000;
const LONG_FUNCTION_REQUEST_TIMEOUT_MS = 180_000;
const LONG_RUNNING_FUNCTION_PATHS = new Set([
  '/functions/v1/comm-whatsapp-generate-follow-up',
  '/functions/v1/comm-whatsapp-sync-chat',
  '/functions/v1/contract-document-extract',
  '/functions/v1/ai-sandbox-run-scenario',
]);

const isSupabaseRequestUrl = (value: string): boolean =>
  value.startsWith(supabaseUrl) || value.startsWith(supabaseFunctionsUrl);

export const getSupabaseRequestTimeoutMs = (requestUrl: string): number => {
  if (requestUrl.includes('/auth/v1/')) {
    return AUTH_REQUEST_TIMEOUT_MS;
  }

  if (requestUrl.startsWith(supabaseFunctionsUrl)) {
    const pathname = new URL(requestUrl).pathname;
    return LONG_RUNNING_FUNCTION_PATHS.has(pathname)
      ? LONG_FUNCTION_REQUEST_TIMEOUT_MS
      : FUNCTION_REQUEST_TIMEOUT_MS;
  }

  return DEFAULT_REQUEST_TIMEOUT_MS;
};

const resolveRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.toString() : input.url;
};

const supabaseFetch: typeof fetch = async (input, init) => {
  const requestUrl = resolveRequestUrl(input);
  const timeoutMs = isSupabaseRequestUrl(requestUrl)
    ? getSupabaseRequestTimeoutMs(requestUrl)
    : DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort(
      new DOMException(`Tempo limite de ${timeoutMs}ms excedido`, 'AbortError'),
    );
  }, timeoutMs);
  const externalSignal = init?.signal;
  const abortFromExternalSignal = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternalSignal();
    } else {
      externalSignal.addEventListener('abort', abortFromExternalSignal, {
        once: true,
      });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (
      controller.signal.aborted
      && !externalSignal?.aborted
      && isSupabaseRequestUrl(requestUrl)
    ) {
      throw new Error(
        `${SUPABASE_NETWORK_HELP} Endpoint: ${requestUrl}. Tempo limite atingido apos ${timeoutMs / 1000}s.`,
      );
    }

    if (isSupabaseRequestUrl(requestUrl)) {
      const message = error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'Erro de rede desconhecido';
      throw new Error(
        `${SUPABASE_NETWORK_HELP} Endpoint: ${requestUrl}. Erro original: ${message}`,
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
};

const supabaseClientOptions: SupabaseClientOptions<'public'> = {
  global: { fetch: supabaseFetch },
};

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  supabaseClientOptions,
);

/**
 * Typed view of the single browser client. New data modules should prefer this
 * export while legacy consumers are migrated feature by feature.
 */
export const databaseClient = supabase as SupabaseClient<Database>;
