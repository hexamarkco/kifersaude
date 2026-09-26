import assert from "node:assert/strict";
import { act } from "react";
import { render } from "@testing-library/react";
import { test } from "vitest";

import { useConfirmationModal } from "../useConfirmationModal";

function ConfirmationHarness({ onResult }: { onResult: (value: boolean) => void }) {
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void requestConfirmation({ title: "Primeira confirmação" }).then(onResult);
        }}
      >
        Abrir primeira
      </button>
      <button
        type="button"
        onClick={() => {
          void requestConfirmation({ title: "Segunda confirmação" }).then(onResult);
        }}
      >
        Abrir segunda
      </button>
      {ConfirmationDialog}
    </>
  );
}

test("cancela a confirmação anterior quando uma nova é aberta", async () => {
  const results: boolean[] = [];
  const view = render(<ConfirmationHarness onResult={(value) => results.push(value)} />);
  const firstButton = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === "Abrir primeira",
  );
  const secondButton = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === "Abrir segunda",
  );

  assert.ok(firstButton);
  assert.ok(secondButton);

  await act(async () => {
    firstButton.click();
    await Promise.resolve();
  });
  assert.ok(document.body.textContent?.includes("Primeira confirmação"));

  await act(async () => {
    secondButton.click();
    await Promise.resolve();
  });

  assert.deepEqual(results, [false]);
  assert.ok(document.body.textContent?.includes("Segunda confirmação"));

  const cancelButton = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === "Cancelar",
  );
  assert.ok(cancelButton);

  await act(async () => {
    cancelButton.click();
    await Promise.resolve();
  });

  assert.deepEqual(results, [false, false]);
  view.unmount();
});
