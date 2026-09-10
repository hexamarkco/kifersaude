import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateTextForFeature } from '../ai-router.ts';
import type { AiReasoningEffort } from '../ai-provider-request-profile.ts';
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
  reasoningEffort = null,
}: {
  provider?: 'openai';
  featureModel?: string;
  defaultModel?: string;
  reasoningEffort?: AiReasoningEffort | null;
} = {}, attemptInserts: Array<Record<string, unknown>> = []) => ({
  from: (table: string) => {
    if (table === 'integration_settings') {
      return makeQuery({
        data: [
          {
            slug: 'ai_provider_openai',
            settings: { enabled: true, defaultModelText: defaultModel, baseUrl: 'https://provider.test/v1' },
          },
          {
            slug: 'ai_routing',
            settings: {
              tasks: { follow_up_generation: { provider, model: defaultModel } },
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
        data: { provider, model: featureModel, model_override_enabled: true, reasoning_effort: reasoningEffort },
        error: null,
      });
    }
    if (table === 'ai_models') {
      return makeQuery({ data: { active: true, deprecated_at: null, capabilities: ['text'] }, error: null });
    }
    if (table === 'ai_call_logs') {
      return makeQuery({ data: { id: 'call-id' }, error: null });
    }
    if (table === 'ai_call_attempts') {
      return {
        insert: async (payload: Record<string, unknown>) => {
          attemptInserts.push(payload);
          return { data: null, error: null };
        },
      };
    }
    return makeQuery({ data: [], error: null });
  },
});

const providerResponse = (text: string) => new Response(JSON.stringify({
  choices: [{ message: { content: text }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
}), { status: 200, headers: { 'content-type': 'application/json' } });

const responsesProviderResponse = (text: string) => new Response(JSON.stringify({
  output_text: text,
  status: 'completed',
  usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
}), { status: 200, headers: { 'content-type': 'application/json' } });

const runFollowUp = (
  attemptTimeoutMs = 5_000,
  models: {
    provider?: 'openai';
    featureModel?: string;
    defaultModel?: string;
    reasoningEffort?: AiReasoningEffort | null;
  } = {},
  attemptInserts: Array<Record<string, unknown>> = [],
) => generateTextForFeature({
  supabaseAdmin: createSupabaseStub(models, attemptInserts),
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

  it('sends attached PDFs as data URLs to the Responses API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(responsesProviderResponse('Mensagem válida.'));
    vi.stubGlobal('fetch', fetchMock);

    await generateTextForFeature({
      supabaseAdmin: createSupabaseStub(),
      featureKey: 'followup.generate',
      task: 'follow_up_generation',
      systemPrompt: 'system',
      userPrompt: 'context',
      documents: [{ fileName: 'contrato.pdf', fileData: 'JVBERi0xLjQK' }],
      responseFormat: {
        name: 'contract_extract',
        schema: {
          type: 'object',
          properties: { value: { type: 'string' } },
          required: ['value'],
          additionalProperties: false,
        },
      },
      maxAttempts: 1,
      maxProviderRequestsPerAttempt: 1,
      validateOutput: validateFollowUpTechnicalOutput,
    });

    const [endpoint, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body));
    expect(endpoint).toBe('https://provider.test/v1/responses');
    expect(body.input[0].content).toContainEqual({
      type: 'input_file',
      filename: 'contrato.pdf',
      file_data: 'data:application/pdf;base64,JVBERi0xLjQK',
    });
    expect(body.prompt_cache_key).toBe('followup.generate');
    expect(body.text.format).toMatchObject({
      type: 'json_schema',
      name: 'contract_extract',
      strict: true,
    });
  });

  it('reads cached input tokens from the Chat Completions usage details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Mensagem válida.' }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 20,
        total_tokens: 1220,
        prompt_tokens_details: { cached_tokens: 1024 },
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runFollowUp();

    expect(result.usage.cachedInputTokens).toBe(1024);
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

  it('uses the reasoning effort selected in the active feature version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(providerResponse('Mensagem válida.'));
    const attemptInserts: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', fetchMock);

    const result = await runFollowUp(5_000, {
      featureModel: 'gpt-5.6-sol',
      defaultModel: 'gpt-4.1-mini',
      reasoningEffort: 'high',
    }, attemptInserts);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.reasoning_effort).toBe('high');
    expect(body).not.toHaveProperty('temperature');
    expect(result).toMatchObject({
      model: 'gpt-5.6-sol',
      requestedReasoningEffort: 'high',
      appliedReasoningEffort: 'high',
    });
    expect(attemptInserts).toContainEqual(expect.objectContaining({
      provider: 'openai',
      model: 'gpt-5.6-sol',
      success: true,
      requested_reasoning_effort: 'high',
      applied_reasoning_effort: 'high',
    }));
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

  it('appends deterministic correction only to a validation retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse('Conseguiu analisar?'))
      .mockResolvedValueOnce(providerResponse('Entre Amil e Leve, qual você prefere?'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateTextForFeature({
      supabaseAdmin: createSupabaseStub(),
      featureKey: 'followup.generate',
      task: 'follow_up_generation',
      systemPrompt: 'system',
      userPrompt: 'context',
      maxAttempts: 2,
      maxProviderRequestsPerAttempt: 1,
      retrySameResolvedModel: true,
      validateOutput: (text) => text.includes('Conseguiu analisar')
        ? { valid: false, stopReason: 'invalid_output', message: 'Mensagem genérica.' }
        : { valid: true },
      buildValidationRetryInstruction: (validation) => `CORRIJA: ${validation.message}`,
    });

    const firstBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body));
    expect(firstBody.messages[0].content).toBe('system');
    expect(secondBody.messages[0].content).toContain('CORRIJA: Mensagem genérica.');
    expect(result.retryCount).toBe(1);
  });

  it('stops after two failed physical requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('provider unavailable', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(runFollowUp()).rejects.toThrow(/Tentativas/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
