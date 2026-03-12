import assert from "node:assert/strict";
import { test } from "vitest";

import { getAllowedConfigTabs } from "../configTabs";

test("getAllowedConfigTabs returns only modules with view permission", () => {
  const tabs = getAllowedConfigTabs("admin", (_, moduleId) => ({
    can_view: moduleId !== "config-automation",
  }));

  assert.deepEqual(
    tabs.map((tab) => tab.id),
    ["system", "users", "integrations"],
  );
});
