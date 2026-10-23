import assert from "node:assert/strict";
import { test } from "vitest";

import { getAllowedConfigTabs, getConfigAreaForTab, hasConfigAreaAccess } from "../configTabs";

test("getAllowedConfigTabs returns only modules with view permission", () => {
  const tabs = getAllowedConfigTabs("admin", (_, moduleId) => ({
    can_view: moduleId !== "config-automation",
  }));

  assert.deepEqual(
    tabs.map((tab) => tab.id),
    ["system", "users", "integrations", "ai", "links", "forms"],
  );
});

test("separates automation, integrations and AI from general settings", () => {
  const permission = () => ({ can_view: true });
  assert.deepEqual(getAllowedConfigTabs("admin", permission, "automation").map((tab) => tab.id), ["automation", "integrations", "ai"]);
  assert.deepEqual(getAllowedConfigTabs("admin", permission, "settings").map((tab) => tab.id), ["system", "users", "links", "forms"]);
});

test("only exposes areas with existing module permissions, including AI-only and access-only roles", () => {
  const aiOnly = (_role: string, moduleId: string) => ({ can_view: moduleId === "config-ai" });
  assert.equal(hasConfigAreaAccess("custom", aiOnly, "automation"), true);
  assert.equal(hasConfigAreaAccess("custom", aiOnly, "settings"), false);
  assert.deepEqual(getAllowedConfigTabs("custom", aiOnly, "automation").map((tab) => tab.id), ["ai"]);
  const accessOnly = (_role: string, moduleId: string) => ({ can_view: moduleId === "config-access" });
  assert.equal(hasConfigAreaAccess("custom", accessOnly, "settings"), true);
  assert.equal(hasConfigAreaAccess("custom", accessOnly, "automation"), false);
  assert.deepEqual(getAllowedConfigTabs("custom", accessOnly, "settings").map((tab) => tab.id), ["system"]);
  assert.equal(hasConfigAreaAccess("observer", () => ({ can_view: false }), "automation"), false);
});

test("resolves saved tab links to their new area without treating unknown values as permission grants", () => {
  for (const tab of ["automation", "integrations", "ai"]) assert.equal(getConfigAreaForTab(tab), "automation");
  for (const tab of ["system", "users", "links", "forms"]) assert.equal(getConfigAreaForTab(tab), "settings");
  assert.equal(getConfigAreaForTab(null), undefined);
  assert.equal(getConfigAreaForTab("invalid"), undefined);
});
