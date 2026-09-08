import assert from "node:assert/strict";
import { test } from "vitest";

import type {
  AiFeatureConfigRow,
  AiFeatureWithConfig,
  AiModelCatalogWithPricing,
} from "../aiConfigTypes";
import {
  buildAiConfigExportV2,
  createAiConfigImportPlan,
} from "../aiConfigTransfer";

const config = (override: boolean): AiFeatureConfigRow => ({
  id: "config-id",
  feature_id: "feature-id",
  version: 6,
  feature_prompt: "prompt original",
  output_instructions: "somente texto",
  temperature: 0.7,
  max_output_tokens: 520,
  provider: override ? "openai" : null,
  model: override ? "gpt-5.6-sol" : null,
  model_override_enabled: override,
  reasoning_effort: "minimal",
  is_active: true,
  created_by: null,
  created_at: "2026-09-07T00:00:00.000Z",
});

const feature = (activeConfig: AiFeatureConfigRow): AiFeatureWithConfig => ({
  id: "feature-id",
  key: "followup.generate",
  name: "Gerar Follow-up",
  description: null,
  category: "followup",
  enabled: true,
  task_type: "text",
  available_variables: [],
  default_feature_prompt: "default",
  default_output_instructions: "default",
  default_temperature: 0.5,
  default_max_output_tokens: 500,
  created_at: "2026-09-07T00:00:00.000Z",
  active_config: activeConfig,
  latest_config: activeConfig,
  config_count: 1,
});

const catalogModel = (overrides: Partial<AiModelCatalogWithPricing> = {}): AiModelCatalogWithPricing => ({
  id: "model-id",
  provider: "openai",
  model: "gpt-5.6-sol",
  display_name: "GPT-5.6 Sol",
  capabilities: ["text", "structured_output", "reasoning"],
  active: true,
  deprecated_at: null,
  created_at: "2026-09-07T00:00:00.000Z",
  updated_at: "2026-09-07T00:00:00.000Z",
  has_pricing: true,
  input_per_million: 1,
  output_per_million: 2,
  ...overrides,
});

const buildExport = (override: boolean) => buildAiConfigExportV2({
  features: [feature(config(override))],
  globalConfigs: [],
  effectiveModels: new Map([["followup.generate", {
    provider: "openai",
    model: "gpt-5.6-sol",
    source: override ? "feature" : "ai_routing",
  }]]),
  selectableByProvider: {
    openai: [{
      value: "gpt-5.6-sol",
      label: "GPT-5.6 Sol",
      reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"],
    }],
    gemini: [],
    claude: [],
  },
  modelCatalog: [catalogModel()],
  routingSettings: {
    tasks: { follow_up_generation: { provider: "openai", model: "gpt-5.6-sol" } },
  },
  exportedAt: "2026-09-07T12:00:00.000Z",
});

test("AI config v2 round-trips a custom provider/model override exactly", () => {
    const exported = buildExport(true);
    const plan = createAiConfigImportPlan(exported, [feature(config(false))], [catalogModel()]);

    assert.equal(exported.version, 2);
    assert.deepEqual(exported.features[0].active_config?.model_config, {
      mode: "custom",
      model_override_enabled: true,
      provider: "openai",
      model: "gpt-5.6-sol",
      effective_provider: "openai",
      effective_model: "gpt-5.6-sol",
      resolution_source: "feature",
    });
    assert.deepEqual(plan.features[0].payload, {
      feature_prompt: "prompt original",
      output_instructions: "somente texto",
      temperature: 0.7,
      max_output_tokens: 520,
      reasoning_effort: "minimal",
      model_override_enabled: true,
      provider: "openai",
      model: "gpt-5.6-sol",
    });
    assert.equal(exported.features[0].active_config?.reasoning_effort, "minimal");
});

test("AI config v2 round-trips default routing without creating an override", () => {
    const exported = buildExport(false);
    const plan = createAiConfigImportPlan(exported, [feature(config(true))], [catalogModel()]);

    assert.equal(exported.features[0].active_config?.model_config.mode, "default");
    assert.equal(plan.features[0].payload.model_override_enabled, false);
    assert.equal("provider" in plan.features[0].payload, false);
    assert.equal("model" in plan.features[0].payload, false);
});

test("AI config v1 imports without inventing model settings", () => {
    const plan = createAiConfigImportPlan({
      version: 1,
      features: [{
        key: "followup.generate",
        active_config: {
          feature_prompt: "legacy prompt",
          output_instructions: "legacy output",
          temperature: 0.4,
          max_output_tokens: 400,
        },
      }],
    }, [feature(config(true))], [catalogModel()]);

    assert.equal(plan.version, 1);
    assert.equal(plan.features[0].modelMode, "legacy");
    assert.equal("model_override_enabled" in plan.features[0].payload, false);
    assert.equal("provider" in plan.features[0].payload, false);
    assert.equal("model" in plan.features[0].payload, false);
});

test("AI config v2 warns about an unavailable custom model and preserves the imported value", () => {
    const exported = buildExport(true);
    const plan = createAiConfigImportPlan(exported, [feature(config(false))], []);

    assert.match(plan.warnings[0], /não existe no catálogo atual/);
    assert.equal(plan.features[0].payload.model_override_enabled, true);
    assert.equal(plan.features[0].payload.provider, "openai");
    assert.equal(plan.features[0].payload.model, "gpt-5.6-sol");
});

test("AI config v2 warns about inactive, deprecated and incompatible overrides", () => {
    const exported = buildExport(true);
    const plan = createAiConfigImportPlan(exported, [feature(config(false))], [catalogModel({
      active: false,
      deprecated_at: "2026-09-01T00:00:00.000Z",
      capabilities: ["transcription"],
    })]);

    assert.equal(plan.warnings.length, 3);
    assert.match(plan.warnings.join("\n"), /inativo/);
    assert.match(plan.warnings.join("\n"), /deprecated/);
    assert.match(plan.warnings.join("\n"), /incompatível/);
    assert.equal(plan.features[0].payload.model, "gpt-5.6-sol");
});

test("AI config v2 never promotes effective_model to a custom override", () => {
    const exported = buildExport(false);
    const modelConfig = exported.features[0].active_config!.model_config;
    const plan = createAiConfigImportPlan(exported, [feature(config(true))], [catalogModel()]);

    assert.equal(modelConfig.effective_model, "gpt-5.6-sol");
    assert.equal(plan.features[0].payload.model_override_enabled, false);
    assert.equal(plan.features[0].payload.model, undefined);
});

test("AI config v2 ignores catalog and routing snapshots during import", () => {
    const exported = buildExport(true);
    exported.model_catalog_snapshot.providers.openai = [];
    exported.routing_snapshot.follow_up_generation = { provider: "gemini", model: "do-not-import" };

    const plan = createAiConfigImportPlan(exported, [feature(config(false))], [catalogModel()]);

    assert.deepEqual(plan.globalConfigs, []);
    assert.equal(plan.features[0].payload.model, "gpt-5.6-sol");
});

test("AI config import ignores the retired Chat Sandbox feature", () => {
    const plan = createAiConfigImportPlan({
      version: 2,
      features: [{
        key: "sandbox.chat",
        active_config: {
          feature_prompt: "legacy sandbox prompt",
          output_instructions: "legacy output",
          temperature: 0.6,
          max_output_tokens: 350,
          model_config: {
            model_override_enabled: true,
            provider: "openai",
            model: "gpt-5.6-sol",
          },
        },
      }],
    }, [feature(config(false))], [catalogModel()]);

    assert.deepEqual(plan.features, []);
    assert.deepEqual(plan.warnings, ["Feature desconhecida ignorada: sandbox.chat."]);
});

test("AI config v2 exports the real-time selectable catalog enriched with metadata", () => {
    const exported = buildExport(true);

    assert.deepEqual(exported.model_catalog_snapshot.providers.openai, [{
      model: "gpt-5.6-sol",
      display_name: "GPT-5.6 Sol",
      capabilities: ["text", "structured_output", "reasoning"],
      active: true,
      deprecated: false,
      pricing_available: true,
      reasoning_efforts: ["none", "low", "medium", "high", "xhigh", "max"],
    }]);
    assert.deepEqual(exported.routing_snapshot.follow_up_generation, {
      provider: "openai",
      model: "gpt-5.6-sol",
    });
});
