import assert from "node:assert/strict";
import { test } from "vitest";

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

test("disabled AI Feature is legacy even if stale config data says active", () => {
    const staleLegacy = feature("followup.analysis", false, config(5, true));

    assert.equal(getAiFeatureDisplayState(staleLegacy), "legacy");
});

test("AI Feature presentation separates legacy Features from operational counters", () => {
    const generate = feature("followup.generate", true, config(6, true));
    const refine = feature("followup.refine", true, config(5, true));
    const analysis = feature("followup.analysis", false, null, config(5, false));

    const categories = buildAiFeatureCategories(
      [analysis, generate, refine],
      { followup: "Follow-up" },
    );

    assert.equal(categories.length, 2);
    assert.deepEqual(categories[0], { label: "Follow-up", features: [generate, refine] });
    assert.deepEqual(categories[1], { label: "Legadas", features: [analysis] });
    assert.equal(countActiveAiFeatures([analysis, generate, refine]), 2);
    assert.equal(countOperationalAiFeatures([analysis, generate, refine]), 2);
});

test("AI Feature presentation distinguishes inactive config from no history", () => {
    assert.equal(getAiFeatureDisplayState(feature("followup.refine", true, null, config(4, false))), "inactive");
    assert.equal(getAiFeatureDisplayState(feature("followup.refine", true, null, null)), "unconfigured");
});
