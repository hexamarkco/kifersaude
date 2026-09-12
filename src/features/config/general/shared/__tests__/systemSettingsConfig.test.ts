import assert from "node:assert/strict";
import { test } from "vitest";

import {
  areSystemPreferencesEqual,
  CONTRACT_CONFIG_MANAGERS,
  matchesConfigSearch,
  normalizeConfigSearchText,
} from "../systemSettingsConfig";

test("normalizeConfigSearchText removes accents and trims text", () => {
  assert.equal(
    normalizeConfigSearchText("  Configurações Gerais  "),
    "configuracoes gerais",
  );
});

test("matchesConfigSearch compares normalized values", () => {
  assert.equal(
    matchesConfigSearch("integracoes", ["Integrações", "WhatsApp"]),
    true,
  );
  assert.equal(matchesConfigSearch("usuarios", ["Leads", "Contratos"]), false);
});

test("contract configuration categories expose concise and contextual tab metadata", () => {
  assert.deepEqual(
    CONTRACT_CONFIG_MANAGERS.map((manager) => manager.tabLabel),
    ["Status", "Modalidade", "Abrangência", "Acomodação", "Carência"],
  );
  assert.equal(
    new Set(CONTRACT_CONFIG_MANAGERS.map((manager) => manager.category)).size,
    CONTRACT_CONFIG_MANAGERS.length,
  );
  assert.equal(
    CONTRACT_CONFIG_MANAGERS.every((manager) =>
      Boolean(
        manager.tabIcon &&
          manager.optionLabel &&
          manager.addLabel &&
          manager.createDialogTitle &&
          manager.emptyStateTitle &&
          manager.emptyStateDescription,
      ),
    ),
    true,
  );
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
    timezone: "America/Sao_Paulo",
    created_at: "2026-03-12T00:00:00.000Z",
    updated_at: "2026-03-12T00:00:00.000Z",
  };

  assert.equal(areSystemPreferencesEqual(base, { ...base }), true);
  assert.equal(
    areSystemPreferencesEqual(base, { ...base, notification_volume: 0.5 }),
    false,
  );
});
