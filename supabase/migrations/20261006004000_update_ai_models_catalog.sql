/*
  # Update AI Models Catalog — newer models from providers

  Adds models discovered via provider APIs that were missing from initial seed.
  No existing models are modified or removed.
*/

INSERT INTO ai_models (provider, model, display_name, capabilities) VALUES
  -- OpenAI: newer models
  ('openai', 'gpt-5.6',              'GPT-5.6',              ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('openai', 'gpt-5.6-terra',        'GPT-5.6 Terra',        ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('openai', 'gpt-5.6-luna',         'GPT-5.6 Luna',         ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('openai', 'gpt-6-astra',          'GPT-6 Astra',          ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  -- Gemini: newer models
  ('gemini', 'gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite', ARRAY['text', 'structured_output', 'multimodal']),
  ('gemini', 'gemini-3.5-flash',      'Gemini 3.5 Flash',      ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('gemini', 'gemini-3.7-flash',      'Gemini 3.7 Flash',      ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('gemini', 'gemini-3.8-flash',      'Gemini 3.8 Flash',      ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  -- Claude: newer models
  ('claude', 'claude-opus-4-7',       'Claude Opus 4.7',       ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('claude', 'claude-opus-4-8',       'Claude Opus 4.8',       ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('claude', 'claude-sonnet-4-6',     'Claude Sonnet 4.6',     ARRAY['text', 'structured_output', 'reasoning', 'multimodal']),
  ('claude', 'claude-haiku-4-5',      'Claude Haiku 4.5',      ARRAY['text', 'structured_output', 'multimodal'])
ON CONFLICT (provider, model) DO NOTHING;
