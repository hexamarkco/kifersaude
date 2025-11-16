import type { SendWhatsappMessageResponse } from '../types/whatsapp';

type RuntimeEnv = {
  functionsUrl?: string;
  supabaseUrl?: string;
  serviceRoleKey?: string;
};

const getServerEnv = (): RuntimeEnv => {
  const globalProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const env = globalProcess?.env ?? {};
  return {
    functionsUrl: env.SUPABASE_FUNCTIONS_URL,
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
};

const getBrowserEnv = (): RuntimeEnv => {
  if (typeof window === 'undefined') {
    return {};
  }

  const metaEnv = (import.meta as ImportMeta | undefined)?.env as
    | Record<string, string | undefined>
    | undefined;

  return {
    functionsUrl: metaEnv?.VITE_SUPABASE_FUNCTIONS_URL,
    supabaseUrl: metaEnv?.VITE_SUPABASE_URL,
  };
};

const resolveRuntimeEnv = (): RuntimeEnv => {
  if (typeof window !== 'undefined') {
    return getBrowserEnv();
  }

  return getServerEnv();
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const getWhatsappFunctionUrl = (path: string): string => {
  const env = resolveRuntimeEnv();
  const functionsUrl = env.functionsUrl?.trim();
  const supabaseUrl = env.supabaseUrl?.trim();

  if (!functionsUrl && !supabaseUrl) {
    throw new Error('Supabase URL ou Functions URL não configuradas.');
  }

  const base = functionsUrl ? trimTrailingSlash(functionsUrl) : `${trimTrailingSlash(supabaseUrl!)}/functions/v1`;
  const normalizedPath = path.replace(/^\/+/, '');
  return `${base}/${normalizedPath}`;
};

type WhatsappFunctionRequestOptions = {
  fetchImpl?: typeof fetch;
  useServiceKey?: boolean;
  headers?: Record<string, string>;
};

const getServiceRoleKey = (): string => {
  const env = getServerEnv();
  if (!env.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada para uso backend.');
  }

  return env.serviceRoleKey;
};

const buildFunctionUrl = (pathOrUrl: string): string => {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return getWhatsappFunctionUrl(pathOrUrl);
};

export const callWhatsappFunction = async <T>(
  path: string,
  init: RequestInit,
  options: WhatsappFunctionRequestOptions = {},
): Promise<T> => {
  const fetcher = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
    ...(options.headers ?? {}),
  };

  if (options.useServiceKey) {
    headers.Authorization = `Bearer ${getServiceRoleKey()}`;
  }

  const response = await fetcher(getWhatsappFunctionUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || 'Falha na requisição para função do WhatsApp');
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
};

export const fetchWhatsappJson = async <T>(pathOrUrl: string, init?: RequestInit) => {
  const response = await fetch(buildFunctionUrl(pathOrUrl), init);

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || 'Falha na requisição para função do WhatsApp');
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
};

type SendMessagePayload = {
  phone: string;
  message: string;
};

export const sendWhatsappMessage = async (
  payload: SendMessagePayload,
  options: WhatsappFunctionRequestOptions = {},
): Promise<SendWhatsappMessageResponse> => {
  return callWhatsappFunction<SendWhatsappMessageResponse>(
    '/whatsapp-webhook/send-message',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    options,
  );
};

type SendMediaPayload = {
  endpoint: string;
  body: Record<string, unknown>;
};

export const sendWhatsappMedia = async <T = SendWhatsappMessageResponse>(
  payload: SendMediaPayload,
  options: WhatsappFunctionRequestOptions = {},
): Promise<T> => {
  return callWhatsappFunction<T>(
    payload.endpoint,
    {
      method: 'POST',
      body: JSON.stringify(payload.body),
    },
    options,
  );
};
