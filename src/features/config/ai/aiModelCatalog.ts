import type {
  AiModelCatalogCapability,
  AiModelCatalogWithPricing,
  AiProviderSlug,
} from "./aiConfigTypes";

export type AiModelCatalogDbRow = {
  id: string;
  provider: AiProviderSlug;
  model: string;
  display_name: string;
  capabilities: AiModelCatalogCapability[] | null;
  active: boolean;
  deprecated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiModelPricingDbRow = {
  provider: string;
  model: string;
  input_per_million: number | string;
  output_per_million: number | string;
  active: boolean;
  effective_from: string;
  effective_to: string | null;
};

const catalogKey = (provider: string, model: string) => `${provider}:${model}`;

const toFiniteNumber = (value: number | string): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * ai_models and ai_model_pricing intentionally have no foreign key: pricing is
 * versioned independently and is matched by the natural provider/model key.
 */
export const mergeAiModelCatalogWithPricing = (
  models: AiModelCatalogDbRow[],
  pricingRows: AiModelPricingDbRow[],
  now = new Date(),
): AiModelCatalogWithPricing[] => {
  const currentPricing = new Map<string, AiModelPricingDbRow>();
  const nowMs = now.getTime();

  for (const pricing of pricingRows) {
    const startsAt = Date.parse(pricing.effective_from);
    const endsAt = pricing.effective_to ? Date.parse(pricing.effective_to) : null;
    const isCurrent = pricing.active
      && Number.isFinite(startsAt)
      && startsAt <= nowMs
      && (endsAt === null || (Number.isFinite(endsAt) && endsAt > nowMs));

    if (!isCurrent) continue;

    const key = catalogKey(pricing.provider, pricing.model);
    const selected = currentPricing.get(key);
    if (!selected || Date.parse(selected.effective_from) < startsAt) {
      currentPricing.set(key, pricing);
    }
  }

  return models.map((model) => {
    const pricing = currentPricing.get(catalogKey(model.provider, model.model));
    return {
      ...model,
      capabilities: model.capabilities ?? [],
      has_pricing: pricing != null,
      input_per_million: pricing ? toFiniteNumber(pricing.input_per_million) : null,
      output_per_million: pricing ? toFiniteNumber(pricing.output_per_million) : null,
    };
  });
};
