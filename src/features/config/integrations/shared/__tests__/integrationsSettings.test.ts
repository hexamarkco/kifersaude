import assert from "node:assert/strict";
import { test } from "vitest";

import {
  getPreferredTaskModel,
  normalizeFollowUpInstructions,
  normalizeModelOptions,
  normalizeProviderSettings,
  normalizeRoutingSettings,
} from "../integrationsSettings";

test("normalizeModelOptions removes duplicates and preserves labels", () => {
  const options = normalizeModelOptions([
    "gpt-4o-mini",
    { value: "gpt-4o-mini", label: "GPT 4o Mini" },
    { id: "claude-3-5-sonnet", displayName: "Claude Sonnet" },
  ]);

  assert.deepEqual(options, [
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
    { value: "claude-3-5-sonnet", label: "Claude Sonnet" },
  ]);
});

test("normalizeProviderSettings reads current and legacy api keys", () => {
  const openAiSettings = normalizeProviderSettings(
    "openai",
    {
      id: "1",
      slug: "ai_provider_openai",
      name: "OpenAI",
      settings: { apiKey: "new-key", enabled: true },
      created_at: "",
      updated_at: "",
    },
    {
      id: "2",
      slug: "gpt_transcription",
      name: "Legacy GPT",
      settings: { apiKey: "legacy-key" },
      created_at: "",
      updated_at: "",
    },
  );

  const geminiSettings = normalizeProviderSettings("gemini", null, null);

  assert.equal(openAiSettings.apiKey, "new-key");
  assert.equal(openAiSettings.enabled, true);
  assert.equal(geminiSettings.apiKey, "");
  assert.equal(geminiSettings.enabled, false);
});

test("normalizeRoutingSettings and helpers keep provider models stable", () => {
  const routing = normalizeRoutingSettings({
    id: "routing-1",
    slug: "ai_routing",
    name: "AI Routing",
    settings: {
      tasks: {
        rewrite_message: {
          provider: "gemini",
          model: "gemini-custom",
          fallbackToOpenAi: false,
        },
      },
    },
    created_at: "",
    updated_at: "",
  });

  const preferredModel = getPreferredTaskModel(
    "follow_up_generation",
    "claude",
    [{ value: "claude-3-5-sonnet-latest", label: "Claude Sonnet" }],
  );

  assert.equal(routing.rewrite_message.provider, "gemini");
  assert.equal(routing.rewrite_message.model, "gemini-custom");
  assert.equal(routing.rewrite_message.fallbackToOpenAi, false);
  assert.equal(preferredModel, "claude-3-5-sonnet-latest");
});

test("normalizeFollowUpInstructions returns a trimmed string", () => {
  assert.equal(
    normalizeFollowUpInstructions({
      id: "follow-up-1",
      slug: "ai_follow_up_prompt",
      name: "Follow-up",
      settings: { instructions: "  Seja objetiva.  " },
      created_at: "",
      updated_at: "",
    }),
    "Seja objetiva.",
  );
});
