import type { AiFeatureCategory, AiFeatureWithConfig } from "./aiConfigTypes";

export type AiFeatureDisplayState = "active" | "inactive" | "legacy" | "unconfigured";

export const getAiFeatureDisplayState = (feature: AiFeatureWithConfig): AiFeatureDisplayState => {
  if (feature.enabled === false) return "legacy";
  if (feature.active_config?.is_active) return "active";
  if (feature.latest_config) return "inactive";
  return "unconfigured";
};

export const buildAiFeatureCategories = (
  features: AiFeatureWithConfig[],
  categoryLabels: Record<string, string>,
): AiFeatureCategory[] => {
  const operational = new Map<string, AiFeatureWithConfig[]>();
  const legacy: AiFeatureWithConfig[] = [];

  for (const feature of features) {
    if (feature.enabled === false) {
      legacy.push(feature);
      continue;
    }

    const category = feature.category ?? "outros";
    const categoryFeatures = operational.get(category) ?? [];
    categoryFeatures.push(feature);
    operational.set(category, categoryFeatures);
  }

  const categories = [...operational.entries()].map(([category, categoryFeatures]) => ({
    label: categoryLabels[category] ?? category,
    features: categoryFeatures,
  }));

  if (legacy.length > 0) {
    categories.push({ label: "Legadas", features: legacy });
  }

  return categories;
};

export const countActiveAiFeatures = (features: AiFeatureWithConfig[]): number =>
  features.filter((feature) => getAiFeatureDisplayState(feature) === "active").length;

export const countOperationalAiFeatures = (features: AiFeatureWithConfig[]): number =>
  features.filter((feature) => feature.enabled !== false).length;
