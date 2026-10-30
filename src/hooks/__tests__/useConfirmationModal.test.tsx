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
      <button
        type="button"
        onClick={() => {
          void requestConfirmation({
            title: "Confirmação contextualizada",
            description: "Confira o efeito antes de continuar.",
            content: <p>Resumo do registro e da consequência.</p>,
            dialogClassName: "kds-access-profile-confirmation",
          }).then(onResult);
        }}
      >
        Abrir confirmação contextualizada
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

test("permite conteúdo contextual sem mudar o fluxo de cancelamento", async () => {
  const results: boolean[] = [];
  const view = render(<ConfirmationHarness onResult={(value) => results.push(value)} />);
  const openButton = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === "Abrir confirmação contextualizada",
  );
  assert.ok(openButton);

  await act(async () => {
    openButton.click();
    await Promise.resolve();
  });

  assert.ok(document.body.textContent?.includes("Confira o efeito antes de continuar."));
  assert.ok(document.body.textContent?.includes("Resumo do registro e da consequência."));
  assert.ok(document.querySelector('[role="dialog"]')?.classList.contains("kds-access-profile-confirmation"));

  const cancelButton = Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent === "Cancelar",
  );
  assert.ok(cancelButton);

  await act(async () => {
    cancelButton.click();
    await Promise.resolve();
  });

  assert.deepEqual(results, [false]);
  view.unmount();
});
