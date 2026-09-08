import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateTextForFeature } from '../ai-router.ts';
import { validateFollowUpTechnicalOutput } from '../comm-whatsapp-follow-up-output.ts';

type QueryResult = { data: unknown; error: null };

const makeQuery = (result: QueryResult) => {
  const query: Record<string, unknown> = {};
  const chain = () => query;
  Object.assign(query, {
    select: chain,
    eq: chain,
    in: chain,
    order: chain,
    limit: chain,
    insert: chain,
    update: chain,
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  });
  return query;
};

const createSupabaseStub = ({
  provider = 'openai',
  featureModel = 'gpt-test',
  defaultModel = 'gpt-test',
}: { provider?: 'openai' | 'gemini' | 'claude'; featureModel?: string; defaultModel?: string } = {}) => ({
  from: (table: string) => {
    if (table === 'integration_settings') {
      return makeQuery({
        data: [
          {
            slug: 'ai_provider_openai',
            settings: { enabled: true, defaultModelText: defaultModel, baseUrl: 'https://provider.test/v1' },
          },
          {
            slug: 'ai_provider_gemini',
            settings: { enabled: true, defaultModelText: defaultModel },
          },
          {
            slug: 'ai_provider_claude',
            settings: { enabled: true, defaultModelText: defaultModel },
          },
          {
            slug: 'ai_routing',
            settings: {
              fallbackEnabled: false,
              tasks: { follow_up_generation: { provider, model: defaultModel, fallbackToOpenAi: false } },
            },
          },
        ],
        error: null,
      });
    }
    if (table === 'ai_features') {
      return makeQuery({ data: { id: 'feature-id' }, error: null });
    }
    if (table === 'ai_feature_configs') {
      return makeQuery({
        data: { provider, model: featureModel, model_override_enabled: true },
        error: null,
      });
    }
    if (table === 'ai_models') {
      return makeQuery({ data: { active: true, deprecated_at: null, capabilities: ['text'] }, error: null });
    }
    if (table === 'ai_call_logs') {
      return makeQuery({ data: { id: 'call-id' }, error: null });
    }
    return makeQuery({ data: [], error: null });
  },
});

const providerResponse = (text: string) => new Response(JSON.stringify({
  choices: [{ message: { content: text }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
}), { status: 200, headers: { 'content-type': 'application/json' } });

const runFollowUp = (
  attemptTimeoutMs = 5_000,
  models: { provider?: 'openai' | 'gemini' | 'claude'; featureModel?: string; defaultModel?: string } = {},
) => generateTextForFeature({
  supabaseAdmin: createSupabaseStub(models),
  featureKey: 'followup.generate',
  task: 'follow_up_generation',
  systemPrompt: 'system',
  userPrompt: 'context',
  maxAttempts: 2,
  maxProviderRequestsPerAttempt: 1,
  retrySameResolvedModel: true,
  attemptTimeoutMs,
  validateOutput: validateFollowUpTechnicalOutput,
});

describe('AI router technical retry budget', () => {
  beforeEach(() => {
    vi.stubGlobal('Deno', { env: { get: () => 'test-key' } });
    vi.restoreAllMocks();
  });

  it('uses exactly one provider request for a valid follow-up', async () => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse('Mensagem válida.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runFollowUp();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.retryCount).toBe(0);
    expect(result.stopReason).toBe('stop');
  });

  it('sends GPT-5.6 Sol with a compatible body on the first physical request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse('Mensagem válida.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runFollowUp(5_000, {
      featureModel: 'gpt-5.6-sol',
      defaultModel: 'gpt-4.1-mini',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      model: 'gpt-5.6-sol',
      max_completion_tokens: 900,
      reasoning_effort: 'low',
    });
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('max_tokens');
    expect(result.model).toBe('gpt-5.6-sol');
    expect(result.fallbackUsed).toBe(false);
  });

  it('omits deprecated sampling controls for new Claude models', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: 'text', text: 'Mensagem válida.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runFollowUp(5_000, {
      provider: 'claude',
      featureModel: 'claude-opus-4-8',
      defaultModel: 'claude-opus-4-8',
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({ model: 'claude-opus-4-8', max_tokens: 900 });
    expect(body).not.toHaveProperty('temperature');
    expect(result.provider).toBe('claude');
  });

  it('uses Gemini generationConfig names instead of OpenAI parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'Mensagem válida.' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runFollowUp(5_000, {
      provider: 'gemini',
      featureModel: 'gemini-3.7-flash',
      defaultModel: 'gemini-3.7-flash',
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.generationConfig).toEqual({ temperature: 0.4, maxOutputTokens: 900 });
    expect(body).not.toHaveProperty('max_tokens');
    expect(body).not.toHaveProperty('max_completion_tokens');
    expect(result.provider).toBe('gemini');
  });

  it('uses exactly three provider requests for a normal batch of three follow-ups', async () => {
    const fetchMock = vi.fn().mockImplementation(() => providerResponse('Mensagem válida.'));
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([runFollowUp(), runFollowUp(), runFollowUp()]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries once after a real provider error and never calls a third time', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('provider unavailable', { status: 503 }))
      .mockResolvedValueOnce(providerResponse('Mensagem após retry.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runFollowUp();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.retryCount).toBe(1);
  });

  it('retries the configured model without degrading to the provider default', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('provider unavailable', { status: 503 }))
      .mockResolvedValueOnce(providerResponse('Mensagem após retry.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runFollowUp(5_000, {
      featureModel: 'gpt-5.6-sol',
      defaultModel: 'gpt-4.1-mini',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const requestedModels = fetchMock.mock.calls.map(([, request]) => (
      JSON.parse(String((request as RequestInit).body)).model
    ));
    expect(requestedModels).toEqual(['gpt-5.6-sol', 'gpt-5.6-sol']);
    expect(result.model).toBe('gpt-5.6-sol');
    expect(result.retryCount).toBe(1);
    expect(result.fallbackUsed).toBe(false);
  });

  it('retries once after an empty response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse(''))
      .mockResolvedValueOnce(providerResponse('Mensagem válida.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runFollowUp();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.retryCount).toBe(1);
  });

  it('retries once after a provider timeout', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce((_input: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }))
      .mockResolvedValueOnce(providerResponse('Mensagem após timeout.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runFollowUp(10);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.retryCount).toBe(1);
  });

  it('uses the one retry for corrupted output, without quality evaluation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse('{"analysis":"unexpected"}'))
      .mockResolvedValueOnce(providerResponse('Mensagem válida.'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runFollowUp();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.retryCount).toBe(1);
  });

  it('stops after two failed physical requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('provider unavailable', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(runFollowUp()).rejects.toThrow(/Tentativas/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
