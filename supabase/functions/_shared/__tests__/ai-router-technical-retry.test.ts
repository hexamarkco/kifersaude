import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateTextForFeature } from '../ai-router.ts';
import type { AiReasoningEffort } from '../ai-provider-request-profile.ts';
import { getAiProviderFailure, parseRetryAfterMs } from '../ai-provider-http.ts';
import { getAutonomousFailureAction, getAutonomousRetryDelayMs } from '../ai-autonomous-reply-failure.ts';
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

  it('T08/T14 stops invalid_json after one HTTP request and never logs upstream echoed content', async () => {
    const secret = 'synthetic-key telephone-5511999999999 PersonExample private-prompt';
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const inserts: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      error: { code: 'invalid_json', type: 'invalid_request_error', message: secret },
    }), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    let failure: unknown;
    try { await runFollowUp(5_000, {}, inserts); } catch (error) { failure = error; }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAiProviderFailure(failure)).toMatchObject({ status: 400, code: 'invalid_json', retryable: false });
    expect(getAutonomousFailureAction({ message: String(failure), error: failure, attemptNumber: 1, deliveryAttemptStarted: false })).toBe('handoff');
    expect(getAutonomousFailureAction({ message: String(failure), error: failure, attemptNumber: 1, deliveryAttemptStarted: true })).toBe('failed');
    expect(JSON.stringify([warnings.mock.calls, inserts, String(failure)])).not.toContain(secret);
    expect(inserts[0]).toMatchObject({ error_code: 'invalid_json' });
    expect(warnings.mock.calls[0]?.[1]).toMatchObject({ payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/), payloadBytes: expect.any(Number) });
  });

  it.each(['"aspas"\nlinha nova\t<tag>ação 😀 \u2028\u2029', '', 'exemplo '.repeat(5000)])('T13 preserves Unicode and empty content in the actual Responses HTTP body', async (content) => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, request: RequestInit) => {
      const wire = await new Request('https://provider.test/v1/responses', request).text();
      expect(JSON.parse(wire).input[0].content[0].text).toBe(content);
      expect(new Headers(request.headers).get('content-type')).toBe('application/json');
      return responsesProviderResponse('Mensagem válida.');
    });
    vi.stubGlobal('fetch', fetchMock);
    await generateTextForFeature({ supabaseAdmin: createSupabaseStub(), featureKey: 'autonomous.reply', task: 'autonomous_attendance',
      systemPrompt: content, userPrompt: content, documents: [{ fileName: 'synthetic.pdf', fileData: 'JVBERi0xLjQK' }],
      responseFormat: { name: 'example', schema: { type: 'object' } },
      maxAttempts: 2, maxProviderRequestsPerAttempt: 1, retrySameResolvedModel: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('T09 defers a long Retry-After to the durable queue and preserves the delay', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response('{"error":{"code":"rate_limit_exceeded"}}', { status: 429, headers: { 'retry-after': '120' } }));
    vi.stubGlobal('fetch', fetchMock);
    let failure: unknown;
    try { await runFollowUp(); } catch (error) { failure = error; }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAiProviderFailure(failure)?.retryable).toBe(true);
    expect(getAutonomousRetryDelayMs(1, failure)).toBe(120_000);
    expect(parseRetryAfterMs('Thu, 29 Oct 2026 12:01:00 GMT', Date.parse('2026-10-29T12:00:00Z'))).toBe(60_000);
    expect(parseRetryAfterMs('invalid')).toBeNull();
  });

  it('T08 rejects invalid_json on Responses after a single valid serialized HTTP request', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, request: RequestInit) => {
      expect(JSON.parse(await new Request('https://provider.test/v1/responses', request).text()).instructions).toBe('estilo com ação 😀 e "aspas"');
      return new Response('{"error":{"code":"invalid_json"}}', { status: 400 });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateTextForFeature({ supabaseAdmin: createSupabaseStub(), featureKey: 'autonomous.reply', task: 'autonomous_attendance',
      systemPrompt: 'estilo com ação 😀 e "aspas"', userPrompt: 'mensagem\nnova', documents: [{ fileName: 'synthetic.pdf', fileData: 'JVBERi0xLjQK' }],
      maxAttempts: 2, maxProviderRequestsPerAttempt: 1, retrySameResolvedModel: true })).rejects.toThrow('HTTP 400 (invalid_json)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('T09 waits before a short Retry-After retry and succeeds within the attempt budget', async () => {
    const times: number[] = [];
    const fetchMock = vi.fn().mockImplementation(async () => {
      times.push(Date.now());
      return times.length === 1 ? new Response('{"error":{"code":"rate_limit_exceeded"}}', { status: 429, headers: { 'retry-after': '1' } })
        : providerResponse('Mensagem válida.');
    });
    vi.stubGlobal('fetch', fetchMock);
    await runFollowUp();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(990);
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
