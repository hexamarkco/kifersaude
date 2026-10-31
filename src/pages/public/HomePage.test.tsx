import { act } from "react";
import { Simulate } from "react-dom/test-utils";
import { render } from "@testing-library/react";
import assert from "node:assert/strict";
import { test, vi } from "vitest";
import HomePage from "./HomePage";

const api = vi.hoisted(() => ({
  submissions: [] as unknown[],
  opened: [] as string[],
  fail: false,
}));
vi.mock("../../features/public-content/data/publicLeadApi", () => ({
  submitPublicLead: async (payload: unknown) => {
    api.submissions.push(payload);
    if (api.fail) throw new Error("Falha simulada");
  },
  loadPublicHomeMetrics: async () => [],
}));
vi.mock("../../lib/brasilLocations", () => ({
  fetchCitiesByState: async () => ["Rio de Janeiro", "Niterói"],
}));

function setup() {
  api.submissions = [];
  api.opened = [];
  api.fail = false;
  const previousOpen = window.open;
  const previousMedia = window.matchMedia;
  window.open = (url) => {
    api.opened.push(String(url));
    return null;
  };
  window.matchMedia = () =>
    ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  const view = render(<HomePage />);
  return {
    ...view,
    unmount() {
      view.unmount();
      window.open = previousOpen;
      window.matchMedia = previousMedia;
    },
  };
}

function field(container: HTMLElement, id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    Simulate.change(input, {
      target: Object.assign(document.createElement("input"), { value }),
    });
  });
}

function fillContact(container: HTMLElement) {
  field(container, "quote-name", "Contato de teste");
  field(container, "quote-phone", "(21) 99999-9999");
  field(container, "quote-city", "Rio de Janeiro");
  field(container, "quote-lives", "1");
  field(container, "quote-age", "35");
}

test("preserva o contrato da captação, normalização e redirecionamento somente após confirmação", async () => {
  const view = setup();
  try {
    fillContact(view.container);
    await act(async () =>
      Simulate.submit(view.container.querySelector("#cotacao form")!),
    );
    assert.equal(api.submissions.length, 1);
    assert.deepEqual(api.submissions[0], {
      name: "Contato de teste",
      phone: "21999999999",
      city: "Rio de Janeiro",
      contractType: "PF",
      totalLives: 1,
      ageSummary: { type: "single", age: 35 },
      website: "",
    });
    assert.equal(api.opened.length, 1);
    assert.ok(api.opened[0].includes("https://wa.me/5521979302389?text="));
    assert.equal(
      view.container.querySelector<HTMLInputElement>("#quote-name")?.value,
      "",
    );
  } finally {
    view.unmount();
  }
});

test("preserva dados em erro e impede submissão com faixas etárias inconsistentes", async () => {
  const view = setup();
  try {
    fillContact(view.container);
    field(view.container, "quote-lives", "2");
    await act(async () =>
      Simulate.submit(view.container.querySelector("#cotacao form")!),
    );
    assert.equal(api.submissions.length, 0);
    field(view.container, "quote-lives", "1");
    api.fail = true;
    await act(async () =>
      Simulate.submit(view.container.querySelector("#cotacao form")!),
    );
    assert.equal(api.opened.length, 0);
    assert.equal(
      view.container.querySelector<HTMLInputElement>("#quote-name")?.value,
      "Contato de teste",
    );
  } finally {
    view.unmount();
  }
});

test("troca o painel de perfil, leva a seleção ao formulário e expande o FAQ com relações acessíveis", () => {
  const view = setup();
  try {
    const mei = view.container.querySelector<HTMLInputElement>(
      'input[name="audience-profile"][value="MEI"]',
    )!;
    act(() => mei.click());
    const panel = view.container.querySelector(`#${mei.getAttribute("aria-controls")}`)!;
    assert.ok(panel.textContent?.includes("Seu trabalho cresce."));
    assert.equal(panel.getAttribute("aria-hidden"), "false");
    assert.equal(panel.getAttribute("aria-labelledby"), "audience-label-MEI");
    act(() => panel.querySelector<HTMLButtonElement>("button")!.click());
    assert.equal(
      view.container.querySelector<HTMLInputElement>(
        'input[name="quote-contract-type"][value="MEI"]',
      )?.checked,
      true,
    );
    const faq =
      view.container.querySelector<HTMLButtonElement>("#faq-trigger-0")!;
    act(() => faq.click());
    assert.equal(faq.getAttribute("aria-expanded"), "true");
    assert.equal(
      view.container.querySelector<HTMLElement>(
        `#${faq.getAttribute("aria-controls")}`,
      )?.getAttribute("aria-hidden"),
      "false",
    );
    act(() => faq.click());
    assert.equal(faq.getAttribute("aria-expanded"), "false");
    assert.equal(
      view.container.querySelector(`#${faq.getAttribute("aria-controls")}`)?.getAttribute("aria-hidden"),
      "true",
    );
  } finally {
    view.unmount();
  }
});
