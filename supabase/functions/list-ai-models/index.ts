// @ts-expect-error Deno npm import
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { getAiProviderApiKey, type AiProvider } from '../_shared/ai-router.ts';
import {
  getOpenAiSupportedReasoningEfforts,
  type AiReasoningEffort,
} from '../_shared/ai-provider-request-profile.ts';
import { authorizeDashboardUser } from '../_shared/dashboard-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type ModelOption = {
  value: string;
  label: string;
  reasoningEfforts: AiReasoningEffort[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isAiProvider = (value: string): value is AiProvider => value === 'openai';

const uniqueOptions = (options: ModelOption[]): ModelOption[] => {
  const seen = new Set<string>();
  const normalized: ModelOption[] = [];

  for (const option of options) {
    const value = option.value.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push({
      value,
      label: option.label.trim() || value,
      reasoningEfforts: option.reasoningEfforts,
    });
  }

  return normalized;
};

const OPENAI_ALLOWED_PREFIXES = ['gpt', 'o1', 'o3', 'o4', 'chatgpt', 'whisper'];
const OPENAI_ALLOWED_KEYWORDS = ['transcribe', 'whisper'];
const OPENAI_BLOCKED_KEYWORDS = ['embedding', 'moderation', 'tts', 'realtime', 'image', 'search', 'babbage', 'davinci'];

const canUseOpenAiModel = (id: string): boolean => {
  const normalized = id.toLowerCase();

  if (OPENAI_BLOCKED_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return false;
  }

  if (OPENAI_ALLOWED_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return true;
  }

  return OPENAI_ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const parseOpenAiModels = (payload: unknown): ModelOption[] => {
  const rows = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];

  const options = rows
    .map((row) => {
      if (!isRecord(row)) return null;
      const id = toTrimmedString(row.id);
      if (!id || !canUseOpenAiModel(id)) return null;
      return {
        value: id,
        label: id,
        reasoningEfforts: [...getOpenAiSupportedReasoningEfforts(id)],
      };
    })
    .filter((row): row is ModelOption => row !== null)
    .sort((a, b) => a.value.localeCompare(b.value));

  return uniqueOptions(options);
};

const getProviderErrorMessage = (response: Response, _provider: AiProvider): string =>
  `O provedor retornou erro HTTP ${response.status}.`;

const listOpenAiModels = async (apiKey: string): Promise<ModelOption[]> => {
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(getProviderErrorMessage(response, 'openai'));
  }

  const payload = await response.json().catch(() => ({}));
  return parseOpenAiModels(payload);
};

const listModelsByProvider = async (_provider: AiProvider, apiKey: string): Promise<ModelOption[]> =>
  listOpenAiModels(apiKey);

const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase não configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseAdmin = createAdminClient();

    const authResult = await authorizeDashboardUser({
      req,
      supabaseUrl,
      supabaseAnonKey,
      supabaseAdmin,
      module: 'config-integrations',
      requiredPermission: 'edit',
    });

    if (!authResult.authorized) {
      return new Response(JSON.stringify(authResult.body), {
        status: authResult.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json().catch(() => null);
    if (
      !isRecord(payload) ||
      Object.keys(payload).length !== 1 ||
      !Object.prototype.hasOwnProperty.call(payload, 'provider')
    ) {
      return new Response(JSON.stringify({ error: 'O corpo deve conter somente o provedor.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const providerCandidate = toTrimmedString(payload.provider).toLowerCase();

    if (!isAiProvider(providerCandidate)) {
      return new Response(JSON.stringify({ error: 'Provedor inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = getAiProviderApiKey(providerCandidate);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Credencial do provedor não configurada.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const models = await listModelsByProvider(providerCandidate, apiKey);

    return new Response(JSON.stringify({ provider: providerCandidate, models }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[list-ai-models] erro inesperado', error);

    return new Response(JSON.stringify({ error: 'Não foi possível listar os modelos.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
