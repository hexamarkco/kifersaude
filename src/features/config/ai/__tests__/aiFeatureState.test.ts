import { describe, expect, it } from "vitest";

import type { AiFeatureConfigRow, AiFeatureWithConfig } from "../aiConfigTypes";
import {
  buildAiFeatureCategories,
  countActiveAiFeatures,
  countOperationalAiFeatures,
  getAiFeatureDisplayState,
} from "../aiFeatureState";

const config = (version: number, isActive: boolean): AiFeatureConfigRow => ({
  id: `config-${version}`,
  feature_id: "feature-id",
  version,
  feature_prompt: "prompt",
  output_instructions: "output",
  temperature: 0.5,
  max_output_tokens: 500,
  provider: "openai",
  model: "gpt-test",
  model_override_enabled: true,
  reasoning_effort: null,
  is_active: isActive,
  created_by: null,
  created_at: "2026-09-07T00:00:00.000Z",
});

const feature = (
  key: AiFeatureWithConfig["key"],
  enabled: boolean,
  activeConfig: AiFeatureConfigRow | null,
  latestConfig = activeConfig,
): AiFeatureWithConfig => ({
  id: key,
  key,
  name: key,
  description: null,
  category: "followup",
  enabled,
  task_type: "text",
  available_variables: [],
  default_feature_prompt: "prompt",
  default_output_instructions: "output",
  default_temperature: 0.5,
  default_max_output_tokens: 500,
  created_at: "2026-09-07T00:00:00.000Z",
  active_config: activeConfig,
  latest_config: latestConfig,
  config_count: latestConfig ? 1 : 0,
});

describe("AI feature presentation state", () => {
  it("treats a disabled Feature as legacy even if stale config data says active", () => {
    const staleLegacy = feature("followup.analysis", false, config(5, true));

    expect(getAiFeatureDisplayState(staleLegacy)).toBe("legacy");
  });

  it("separates legacy Features and excludes them from operational counters", () => {
    const generate = feature("followup.generate", true, config(6, true));
    const refine = feature("followup.refine", true, config(5, true));
    const analysis = feature("followup.analysis", false, null, config(5, false));

    const categories = buildAiFeatureCategories(
      [analysis, generate, refine],
      { followup: "Follow-up" },
    );

    expect(categories).toHaveLength(2);
    expect(categories[0]).toMatchObject({ label: "Follow-up", features: [generate, refine] });
    expect(categories[1]).toMatchObject({ label: "Legadas", features: [analysis] });
    expect(countActiveAiFeatures([analysis, generate, refine])).toBe(2);
    expect(countOperationalAiFeatures([analysis, generate, refine])).toBe(2);
  });

  it("distinguishes an inactive saved config from a Feature without history", () => {
    expect(getAiFeatureDisplayState(feature("followup.refine", true, null, config(4, false))))
      .toBe("inactive");
    expect(getAiFeatureDisplayState(feature("followup.refine", true, null, null)))
      .toBe("unconfigured");
  });
});
