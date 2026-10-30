import assert from "node:assert/strict";
import { act } from "react";
import { render } from "@testing-library/react";
import { test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateGlobalConfig: vi.fn(() => Promise.resolve({ error: "Ação de gravação bloqueada na prévia local." })),
}));

vi.mock("../../aiConfigService", () => ({
  aiConfigService: {
    updateGlobalConfig: mocks.updateGlobalConfig,
  },
}));

import GlobalConfigSection from "../GlobalConfigSection";

test("mostra o erro de salvamento junto ao campo sem cobrir as ações", async () => {
  const view = render(
    <GlobalConfigSection
      configs={[{
        id: "global-instructions",
        key: "global_instructions",
        value: "Orientações iniciais",
        description: null,
        updated_by: null,
        updated_at: "2026-10-30T09:00:00.000Z",
      }]}
      onReload={() => undefined}
    />,
  );

  const textarea = view.container.querySelector("textarea");
  assert.ok(textarea);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, "Orientações revisadas");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const saveButton = Array.from(view.container.querySelectorAll("button"))
    .find((button) => button.textContent?.includes("Salvar instruções"));
  assert.ok(saveButton);

  await act(async () => saveButton.click());

  const alert = view.container.querySelector('[role="alert"]');
  assert.ok(alert);
  assert.match(alert.textContent ?? "", /Ação de gravação bloqueada/);
  assert.equal(saveButton.disabled, false);
  view.unmount();
});
