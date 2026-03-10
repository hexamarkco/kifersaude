const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

type AiProvider = 'openai' | 'gemini' | 'claude';

type ModelOption = {
  value: string;
  label: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isAiProvider = (value: string): value is AiProvider => value === 'openai' || value === 'gemini' || value === 'claude';

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
      return { value: id, label: id };
    })
    .filter((row): row is ModelOption => row !== null)
    .sort((a, b) => a.value.localeCompare(b.value));

  return uniqueOptions(options);
};

const parseGeminiModels = (payload: unknown): ModelOption[] => {
  const rows = isRecord(payload) && Array.isArray(payload.models) ? payload.models : [];

  const options = rows
    .map((row) => {
      if (!isRecord(row)) return null;

      const supportedMethods = Array.isArray(row.supportedGenerationMethods)
        ? row.supportedGenerationMethods
            .map((method) => (typeof method === 'string' ? method : ''))
            .filter((method) => method)
        : [];

      if (supportedMethods.length > 0 && !supportedMethods.includes('generateContent')) {
        return null;
      }

      const rawName = toTrimmedString(row.name);
      const value = rawName.replace(/^models\//, '');
      if (!value || !value.toLowerCase().startsWith('gemini')) return null;

      const displayName = toTrimmedString(row.displayName);
      return {
        value,
        label: displayName || value,
      };
    })
    .filter((row): row is ModelOption => row !== null)
    .sort((a, b) => a.value.localeCompare(b.value));

  return uniqueOptions(options);
};

const parseClaudeModels = (payload: unknown): ModelOption[] => {
  const rows = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];

  const options = rows
    .map((row) => {
      if (!isRecord(row)) return null;

      const id = toTrimmedString(row.id);
      if (!id || !id.toLowerCase().startsWith('claude-')) return null;

      const displayName = toTrimmedString(row.display_name);
      return {
        value: id,
        label: displayName || id,
      };
    })
    .filter((row): row is ModelOption => row !== null)
    .sort((a, b) => a.value.localeCompare(b.value));

  return uniqueOptions(options);
};

const getProviderErrorMessage = async (response: Response, provider: AiProvider): Promise<string> => {
  const responseText = (await response.text()).trim();
  const compactError = responseText.replace(/\s+/g, ' ').slice(0, 400);

  if (!compactError) {
    return `${provider} retornou erro HTTP ${response.status}.`;
  }

  return `${provider} retornou erro HTTP ${response.status}: ${compactError}`;
};

const listOpenAiModels = async (apiKey: string): Promise<ModelOption[]> => {
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(await getProviderErrorMessage(response, 'openai'));
  }

  const payload = await response.json().catch(() => ({}));
  return parseOpenAiModels(payload);
};

const listGeminiModels = async (apiKey: string): Promise<ModelOption[]> => {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(await getProviderErrorMessage(response, 'gemini'));
  }

  const payload = await response.json().catch(() => ({}));
  return parseGeminiModels(payload);
};

const listClaudeModels = async (apiKey: string): Promise<ModelOption[]> => {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });

  if (!response.ok) {
    throw new Error(await getProviderErrorMessage(response, 'claude'));
  }

  const payload = await response.json().catch(() => ({}));
  return parseClaudeModels(payload);
};

const listModelsByProvider = async (provider: AiProvider, apiKey: string): Promise<ModelOption[]> => {
  if (provider === 'openai') {
    return listOpenAiModels(apiKey);
  }

  if (provider === 'gemini') {
    return listGeminiModels(apiKey);
  }

  return listClaudeModels(apiKey);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = (await req.json()) as Record<string, unknown>;
    const providerCandidate = toTrimmedString(payload.provider).toLowerCase();
    const apiKey = toTrimmedString(payload.apiKey);

    if (!isAiProvider(providerCandidate)) {
      return new Response(JSON.stringify({ error: 'Provedor invalido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key obrigatoria.' }), {
        status: 400,
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
    const message = error instanceof Error ? error.message : 'Erro interno ao listar modelos.';

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
