import type {
  SendWhatsappMessageResponse,
  WhatsappChatSlaAlert,
  WhatsappChatSlaStatus,
} from '../types/whatsapp';

type RuntimeEnv = {
  functionsUrl?: string;
  supabaseUrl?: string;
  anonKey?: string;
  serviceRoleKey?: string;
};

const getServerEnv = (): RuntimeEnv => {
  // Ambiente de Funções do Supabase: usa Deno.env (secrets)
  if (typeof Deno === 'undefined' || !('env' in Deno)) {
    throw new Error('Deno.env não está disponível. Este helper deve ser usado em Edge Functions do Supabase.');
  }

  const functionsUrl = Deno.env.get('SUPABASE_FUNCTIONS_URL')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  return {
    functionsUrl,
    supabaseUrl,
    anonKey,
    serviceRoleKey,
  };
};

const getBrowserEnv = (): RuntimeEnv => {
  if (typeof window === 'undefined') {
    return {};
  }

  const metaEnv = import.meta.env as Record<string, string | undefined>;

  return {
    functionsUrl: metaEnv?.VITE_SUPABASE_FUNCTIONS_URL?.trim(),
    supabaseUrl: metaEnv?.VITE_SUPABASE_URL?.trim(),
    anonKey: metaEnv?.VITE_SUPABASE_ANON_KEY?.trim(),
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

const getSupabaseAnonKey = (): string => {
  const env = resolveRuntimeEnv();
  const key = env.anonKey?.trim();

  if (!key) {
    throw new Error('Chave anônima do Supabase não configurada.');
  }

  return key;
};

const buildFunctionUrl = (pathOrUrl: string): string => {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return getWhatsappFunctionUrl(pathOrUrl);
};

const getSupabaseRestUrl = (path: string): string => {
  const env = resolveRuntimeEnv();
  const supabaseUrl = env.supabaseUrl?.trim();

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL não configurada.');
  }

  const normalizedPath = path.replace(/^\/+/, '');
  return `${trimTrailingSlash(supabaseUrl)}/${normalizedPath}`;
};

type WhatsappSupabaseRequestOptions = {
  fetchImpl?: typeof fetch;
  useServiceKey?: boolean;
  headers?: Record<string, string>;
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

export const fetchSupabaseRestJson = async <T>(
  pathOrUrl: string,
  init?: RequestInit,
  options: WhatsappSupabaseRequestOptions = {},
) => {
  const fetcher = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
    ...(options.headers ?? {}),
  };

  if (!headers.apikey) {
    headers.apikey = options.useServiceKey ? getServiceRoleKey() : getSupabaseAnonKey();
  }

  if (!headers.Authorization) {
    headers.Authorization = `Bearer ${headers.apikey}`;
  }

  const response = await fetcher(getSupabaseRestUrl(pathOrUrl), {
    ...init,
    headers,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || 'Falha na requisição para o Supabase');
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

export type DeleteWhatsappMessagePayload = {
  phone: string;
  messageId: string;
  owner: boolean;
};

export type DeleteWhatsappMessageResponse = {
  success: boolean;
  removedLocalMessages?: number;
  error?: string | null;
  details?: unknown;
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

export const deleteWhatsappMessage = async (
  payload: DeleteWhatsappMessagePayload,
  options: WhatsappFunctionRequestOptions = {},
): Promise<DeleteWhatsappMessageResponse> => {
  return callWhatsappFunction<DeleteWhatsappMessageResponse>(
    '/whatsapp-webhook/delete-message',
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

type ListSlaAlertsParams = {
  status?: WhatsappChatSlaStatus[];
  chatId?: string;
  limit?: number;
};

export const listWhatsappChatSlaAlerts = async (
  params: ListSlaAlertsParams = {},
  options: WhatsappSupabaseRequestOptions = {},
): Promise<WhatsappChatSlaAlert[]> => {
  const searchParams = new URLSearchParams();
  const limit = Number.isFinite(params.limit ?? null) ? Number(params.limit) : 100;
  searchParams.set('order', 'created_at.desc');
  searchParams.set('limit', String(limit));

  if (params.chatId) {
    searchParams.set('chat_id', `eq.${params.chatId}`);
  }

  if (params.status && params.status.length > 0) {
    const normalizedStatuses = params.status.filter(Boolean).join(',');
    if (normalizedStatuses) {
      searchParams.set('sla_status', `in.(${normalizedStatuses})`);
    }
  }

  const queryString = searchParams.toString();
  const path = `/rest/v1/whatsapp_chat_sla_alerts${queryString ? `?${queryString}` : ''}`;

  return fetchSupabaseRestJson<WhatsappChatSlaAlert[]>(path, undefined, options);
};