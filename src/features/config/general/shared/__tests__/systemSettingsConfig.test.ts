import assert from "node:assert/strict";
import { test } from "vitest";

import {
  areSystemPreferencesEqual,
  matchesConfigSearch,
  normalizeConfigSearchText,
} from "../systemSettingsConfig";

test("normalizeConfigSearchText removes accents and trims text", () => {
  assert.equal(
    normalizeConfigSearchText("  Configuracoes Gerais  "),
    "configuracoes gerais",
  );
});

test("matchesConfigSearch compares normalized values", () => {
  assert.equal(
    matchesConfigSearch("integracoes", ["Integracoes", "WhatsApp"]),
    true,
  );
  assert.equal(matchesConfigSearch("usuarios", ["Leads", "Contratos"]), false);
});

test("areSystemPreferencesEqual compares relevant preference fields", () => {
  const base = {
    id: "settings-1",
    company_name: "KS",
    notification_sound_enabled: true,
    notification_volume: 0.7,
    notification_interval_seconds: 30,
    session_timeout_minutes: 480,
    date_format: "DD/MM/YYYY",
    created_at: "2026-03-12T00:00:00.000Z",
    updated_at: "2026-03-12T00:00:00.000Z",
  };

  assert.equal(areSystemPreferencesEqual(base, { ...base }), true);
  assert.equal(
    areSystemPreferencesEqual(base, { ...base, notification_volume: 0.5 }),
    false,
  );
});
