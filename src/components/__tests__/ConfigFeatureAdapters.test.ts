import assert from "node:assert/strict";
import { test, vi } from "vitest";

vi.mock("reactflow", () => ({
  default: () => null,
  addEdge: vi.fn(),
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  MiniMap: () => null,
  Position: { Left: "left", Right: "right" },
  getNodesBounds: vi.fn(() => ({})),
  getViewportForBounds: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  useEdgesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  useNodesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
}));

vi.mock("html-to-image", () => ({
  toPng: vi.fn(async () => ""),
}));

import LegacyConfigPage from "../../pages/ConfigPage";
import LegacyAccessControlManager from "../config/AccessControlManager";
import LegacyAutomationFlowsTab from "../config/AutomationFlowsTab";
import LegacyIntegrationsTab from "../config/IntegrationsTab";
import LegacySystemSettingsTab from "../config/SystemSettingsTab";
import LegacyUsersTab from "../config/UsersTab";
import ConfigPageScreen from "../../features/config/ConfigPageScreen";
import AccessControlManagerScreen from "../../features/config/general/AccessControlManagerScreen";
import AutomationSettingsScreen from "../../features/config/automation/AutomationSettingsScreen";
import IntegrationsScreen from "../../features/config/integrations/IntegrationsScreen";
import SystemSettingsScreen from "../../features/config/general/SystemSettingsScreen";
import UsersScreen from "../../features/config/users/UsersScreen";

test("config adapters keep legacy exports aligned with feature modules", () => {
  assert.equal(LegacyConfigPage, ConfigPageScreen);
  assert.equal(LegacySystemSettingsTab, SystemSettingsScreen);
  assert.equal(LegacyUsersTab, UsersScreen);
  assert.equal(LegacyAutomationFlowsTab, AutomationSettingsScreen);
  assert.equal(LegacyIntegrationsTab, IntegrationsScreen);
  assert.equal(LegacyAccessControlManager, AccessControlManagerScreen);
});
