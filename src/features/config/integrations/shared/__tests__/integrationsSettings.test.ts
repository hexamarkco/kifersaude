import assert from "node:assert/strict";
import { test } from "vitest";

import {
  getPreferredTaskModel,
  normalizeModelOptions,
  normalizeProviderSettings,
  normalizeRoutingSettings,
} from "../integrationsSettings";

test("normalizeModelOptions removes duplicates and preserves labels", () => {
  const options = normalizeModelOptions([
    "gpt-4o-mini",
    { value: "gpt-4o-mini", label: "GPT 4o Mini" },
    { id: "gpt-4.1-mini", displayName: "GPT 4.1 Mini" },
  ]);

  assert.deepEqual(options, [
    { value: "gpt-4o-mini", label: "gpt-4o-mini" },
    { value: "gpt-4.1-mini", label: "GPT 4.1 Mini" },
  ]);
});

test("normalizeProviderSettings reads only the non-secret enabled flag", () => {
  const openAiSettings = normalizeProviderSettings(
    {
      id: "1",
      slug: "ai_provider_openai",
      name: "OpenAI",
      settings: { enabled: true },
      created_at: "",
      updated_at: "",
    },
  );

  const missingSettings = normalizeProviderSettings(null);

  assert.equal(openAiSettings.enabled, true);
  assert.equal(missingSettings.enabled, false);
});

test("normalizeRoutingSettings forces legacy providers back to OpenAI", () => {
  const routing = normalizeRoutingSettings({
    id: "routing-1",
    slug: "ai_routing",
    name: "AI Routing",
    settings: {
      tasks: {
        rewrite_message: {
          provider: "unsupported",
          model: "foreign-model",
        },
      },
    },
    created_at: "",
    updated_at: "",
  });

  const preferredModel = getPreferredTaskModel(
    "openai",
    [{ value: "gpt-4.1-mini", label: "GPT 4.1 Mini" }],
  );

  assert.equal(routing.rewrite_message.provider, "openai");
  assert.equal(routing.rewrite_message.model, "gpt-4o-mini");
  assert.equal(preferredModel, "gpt-4.1-mini");
});
