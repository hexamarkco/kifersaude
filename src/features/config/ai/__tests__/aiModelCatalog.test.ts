import assert from "node:assert/strict";
import { test } from "vitest";
import {
  mergeAiModelCatalogWithPricing,
  type AiModelCatalogDbRow,
  type AiModelPricingDbRow,
} from "../aiModelCatalog";

const model: AiModelCatalogDbRow = {
  id: "model-id",
  provider: "openai",
  model: "gpt-test",
  display_name: "GPT Test",
  capabilities: ["text"],
  active: true,
  deprecated_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const pricing = (overrides: Partial<AiModelPricingDbRow> = {}): AiModelPricingDbRow => ({
  provider: "openai",
  model: "gpt-test",
  input_per_million: 1,
  output_per_million: 2,
  active: true,
  effective_from: "2026-01-01T00:00:00.000Z",
  effective_to: null,
  ...overrides,
});

test("combina catálogo e preço pelo par provider/model", () => {
    const [result] = mergeAiModelCatalogWithPricing(
      [model],
      [pricing({ input_per_million: "1.25", output_per_million: "3.5" })],
      new Date("2026-09-07T12:00:00.000Z"),
    );

  assert.equal(result.has_pricing, true);
  assert.equal(result.input_per_million, 1.25);
  assert.equal(result.output_per_million, 3.5);
});

test("usa somente o preço vigente mais recente", () => {
    const [result] = mergeAiModelCatalogWithPricing(
      [model],
      [
        pricing({ input_per_million: 1, effective_from: "2026-01-01T00:00:00.000Z" }),
        pricing({ input_per_million: 2, effective_from: "2026-08-01T00:00:00.000Z" }),
        pricing({ input_per_million: 9, effective_from: "2026-10-01T00:00:00.000Z" }),
      ],
      new Date("2026-09-07T12:00:00.000Z"),
    );

  assert.equal(result.input_per_million, 2);
});

test("ignora preços inativos ou fora da vigência", () => {
    const results = mergeAiModelCatalogWithPricing(
      [model, { ...model, id: "other", model: "without-price" }],
      [pricing({ active: false }), pricing({ effective_to: "2026-08-01T00:00:00.000Z" })],
      new Date("2026-09-07T12:00:00.000Z"),
    );

  assert.equal(results.every((item) => item.has_pricing === false), true);
});
