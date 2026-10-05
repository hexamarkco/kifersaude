import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transcribeAudioWithRouting } from '../ai-router.ts';

const query = (data: unknown) => {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: () => chain, eq: () => chain, in: () => chain,
    order: () => chain, limit: () => chain, update: () => chain,
    insert: () => chain,
    maybeSingle: async () => ({ data, error: null }),
    then: (resolve: (result: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve),
  });
  return chain;
};

const database = (active = true) => ({
  from: (table: string) => {
    switch (table) {
      case 'integration_settings': return query([
        { slug: 'ai_provider_openai', settings: {
          enabled: true, baseUrl: 'https://provider.test/v1',
          defaultModelTranscription: 'gpt-4o-mini-transcribe',
        } },
        { slug: 'ai_routing', settings: { tasks: {
          whatsapp_audio_transcription: { provider: 'openai', model: 'gpt-4o-transcribe' },
        } } },
      ]);
      case 'ai_features': return query({ id: 'audio-feature' });
      case 'ai_feature_configs': return query({
        provider: 'openai', model: 'gpt-transcribe', model_override_enabled: true,
      });
      case 'ai_models': return query({ active, deprecated_at: null, capabilities: ['transcription'] });
      case 'ai_call_logs': return query({ id: 'call-id' });
      default: return query([]);
    }
  },
});

describe('transcription feature routing', () => {
  beforeEach(() => vi.stubGlobal('Deno', { env: { get: () => 'test-key' } }));
  afterEach(() => vi.unstubAllGlobals());

  it.each([[true, 'gpt-transcribe'], [false, 'gpt-4o-transcribe']] as const)(
    'honors the feature override only when its catalog entry is active (%s)',
    async (active, expectedModel) => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'Olá' }), {
        headers: { 'content-type': 'application/json' },
      }));
      vi.stubGlobal('fetch', fetchMock);
      const result = await transcribeAudioWithRouting({
        supabaseAdmin: database(active), audioBlob: new Blob(['audio'], { type: 'audio/ogg' }),
      });
      expect(result.model).toBe(expectedModel);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [endpoint, request] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(endpoint).toBe('https://provider.test/v1/audio/transcriptions');
      expect((request.body as FormData).get('model')).toBe(expectedModel);
    },
  );

  it('retains the provider default as fallback after a feature-model failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('temporarily unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ text: 'Olá' }), {
        headers: { 'content-type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await transcribeAudioWithRouting({ supabaseAdmin: database(), audioBlob: new Blob(['audio']) });
    expect(result).toMatchObject({ model: 'gpt-4o-mini-transcribe', fallbackUsed: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
