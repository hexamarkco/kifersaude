import assert from "node:assert/strict";
import { act } from "react";
import { render } from "@testing-library/react";
import { test, vi } from "vitest";
import { useHomeQuote } from "../useHomeQuote";
import type { PublicLeadSubmission } from "../../data/publicLeadApi";

const service = vi.hoisted(() => ({
  calls: [] as PublicLeadSubmission[],
  fail: false,
  pending: undefined as Promise<void> | undefined,
}));
vi.mock("../../data/publicLeadApi", () => ({
  submitPublicLead: async (payload: PublicLeadSubmission) => {
    service.calls.push(payload);
    if (service.pending) await service.pending;
    if (service.fail) throw new Error("offline");
  },
}));
vi.mock("../../../../lib/toast", () => ({
  toast: { warning: () => {}, error: () => {}, success: () => {} },
}));

function setup() {
  service.calls = [];
  service.fail = false;
  service.pending = undefined;
  const originalOpen = window.open;
  const opened: string[] = [];
  window.open = (url) => {
    opened.push(String(url));
    return null;
  };
  let quote: ReturnType<typeof useHomeQuote>;
  function Harness() {
    quote = useHomeQuote();
    return (
      <form onSubmit={quote.onSubmit}>
        <input id="quote-name" />
        <input id="quote-city" />
        <input id="quote-phone" />
        <input id="quote-age" />
        <input id="quote-range-0" />
        <input id="quote-lives" />
        <input name="website" defaultValue="" />
      </form>
    );
  }
  const view = render(<Harness />);
  const submit = async () =>
    act(async () => {
      view.container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
  const fill = () =>
    act(() => {
      quote.update("nome", "Pessoa de teste");
      quote.update("telefone", "(21) 99999-9999");
      quote.update("cidade", "Niterói — RJ");
      quote.update("idadeTitular", "34");
    });
  return {
    ...view,
    get quote() {
      return quote;
    },
    opened,
    submit,
    fill,
    unmount: () => {
      view.unmount();
      window.open = originalOpen;
    },
  };
}
test("single-person quotation preserves the endpoint payload, honeypot and WhatsApp continuation", async () => {
  const view = setup();
  try {
    view.fill();
    await view.submit();
    assert.deepEqual(service.calls[0], {
      name: "Pessoa de teste",
      phone: "21999999999",
      city: "Niterói — RJ",
      contractType: "PF",
      totalLives: 1,
      ageSummary: { type: "single", age: 34 },
      website: "",
    });
    assert.equal(view.quote.feedback?.kind, "success");
    assert.match(view.opened[0], /^https:\/\/wa\.me\//);
    assert.equal(view.quote.values.nome, "");
  } finally {
    view.unmount();
  }
});
test("multiple lives require a complete age distribution and preserve the MEI profile", async () => {
  const view = setup();
  try {
    view.fill();
    act(() => {
      view.quote.update("tipoContratacao", "MEI");
      view.quote.update("numeroVidas", "3");
      view.quote.updateAge("00 - 18", "1");
    });
    await view.submit();
    assert.equal(service.calls.length, 0);
    assert.equal(view.quote.feedback?.field, "quote-range-0");
    act(() => view.quote.updateAge("34 - 38", "2"));
    await view.submit();
    const payload = service.calls[0];
    assert.equal(payload?.contractType, "MEI");
    assert.equal(payload?.totalLives, 3);
    assert.equal(payload?.ageSummary.type, "ranges");
    if (payload?.ageSummary.type === "ranges") {
      assert.equal(payload.ageSummary.counts["00-18"], 1);
      assert.equal(payload.ageSummary.counts["34-38"], 2);
    }
  } finally {
    view.unmount();
  }
});
test("an API error retains user data and never opens WhatsApp or announces success", async () => {
  const view = setup();
  try {
    service.fail = true;
    view.fill();
    await view.submit();
    assert.equal(view.quote.feedback?.kind, "error");
    assert.equal(view.quote.values.nome, "Pessoa de teste");
    assert.equal(view.opened.length, 0);
  } finally {
    view.unmount();
  }
});
test("repeated submits while pending create only one request", async () => {
  const view = setup();
  let resolve: () => void = () => {};
  service.pending = new Promise<void>((done) => {
    resolve = done;
  });
  try {
    view.fill();
    await view.submit();
    await view.submit();
    assert.equal(service.calls.length, 1);
    await act(async () => resolve());
  } finally {
    view.unmount();
  }
});
