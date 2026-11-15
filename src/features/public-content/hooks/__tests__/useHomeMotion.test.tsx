import assert from "node:assert/strict";
import { act, useRef } from "react";
import { render } from "@testing-library/react";
import { test } from "vitest";
import { createHomeMotionController, useHomeMotion } from "../useHomeMotion";
import HomeAudience from "../../components/home/HomeAudience";
import { HomeFaq } from "../../components/home/HomeContact";

class FakeAnimation extends EventTarget {
  cancelled = false;
  cancel() {
    if (!this.cancelled) {
      this.cancelled = true;
      this.dispatchEvent(new Event("cancel"));
    }
  }
}
function setupMotion() {
  let reduced = false;
  const animations: FakeAnimation[] = [];
  const listeners = new Set<() => void>();
  const descriptors = [
    [
      window,
      "matchMedia",
      Object.getOwnPropertyDescriptor(window, "matchMedia"),
    ],
    [
      Element.prototype,
      "animate",
      Object.getOwnPropertyDescriptor(Element.prototype, "animate"),
    ],
    [document, "hidden", Object.getOwnPropertyDescriptor(document, "hidden")],
    [
      globalThis,
      "IntersectionObserver",
      Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver"),
    ],
  ] as const;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      get matches() {
        return reduced;
      },
      addEventListener: (_event: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_event: string, fn: () => void) =>
        listeners.delete(fn),
    }),
  });
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: () => {
      const animation = new FakeAnimation();
      animations.push(animation);
      return animation as unknown as Animation;
    },
  });
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    value: undefined,
  });
  const disposers: (() => void)[] = [];
  return {
    animations,
    listeners,
    setReduced() {
      reduced = true;
      listeners.forEach((listener) => listener());
    },
    fixture() {
      const scope = document.createElement("div");
      scope.innerHTML =
        '<section class="hero"><div class="hero-copy"><h1>Seu plano</h1><input /></div><div class="hero-photo"></div></section>';
      document.body.append(scope);
      const controller = createHomeMotionController(scope);
      disposers.push(controller.dispose);
      return {
        scope,
        controller,
        section: scope.querySelector<HTMLElement>("section")!,
      };
    },
    dispose() {
      disposers.forEach((dispose) => dispose());
      document.body.replaceChildren();
      for (const [object, key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(object, key, descriptor);
        else Reflect.deleteProperty(object, key);
      }
    },
  };
}
function motionTest(
  name: string,
  run: (env: ReturnType<typeof setupMotion>) => void,
) {
  test(name, () => {
    const env = setupMotion();
    try {
      run(env);
    } finally {
      env.dispose();
    }
  });
}
motionTest(
  "reveals a section once and cancels all temporary effects on disposal",
  (env) => {
    const { controller, section } = env.fixture();
    controller.enter(section);
    assert.equal(env.animations.length, 2);
    controller.enter(section);
    assert.equal(env.animations.length, 2);
    controller.dispose();
    assert.ok(env.animations.every((animation) => animation.cancelled));
    assert.equal(env.listeners.size, 0);
    assert.equal(section.hidden, false);
  },
);
motionTest(
  "reduced motion leaves the content at rest and changing preference stops running effects",
  (env) => {
    const { controller, section } = env.fixture();
    controller.enter(section);
    env.setReduced();
    assert.ok(env.animations.every((animation) => animation.cancelled));
    const second = env.fixture();
    second.controller.enter(second.section);
    assert.equal(env.animations.length, 2);
  },
);
motionTest(
  "focusing a field cancels its section entrance without moving the focus",
  (env) => {
    const { controller, section } = env.fixture();
    controller.enter(section);
    const input = section.querySelector("input")!;
    input.focus();
    assert.equal(document.activeElement, input);
    assert.ok(env.animations.every((animation) => animation.cancelled));
  },
);
motionTest(
  "observer failure leaves the real page content and quote action usable",
  () => {
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: class {
        constructor() {
          throw new Error("unavailable");
        }
      },
    });
    function Harness() {
      const anchor = useRef<HTMLElement>(null);
      useHomeMotion(anchor);
      return (
        <div className="kifer-landing">
          <main ref={anchor}>
            <section>
              <button>Quero cotar</button>
            </section>
          </main>
        </div>
      );
    }
    const view = render(<Harness />);
    try {
      assert.equal(view.container.querySelector("button")?.disabled, false);
    } finally {
      view.unmount();
    }
  },
);
test("all three audience actions retain their contract profiles", () => {
  const profiles: string[] = [];
  const view = render(
    <HomeAudience onQuote={(profile) => profiles.push(profile)} />,
  );
  try {
    for (const action of view.container.querySelectorAll<HTMLAnchorElement>(
      ".profile a",
    ))
      act(() => action.click());
    assert.deepEqual(profiles, ["PF", "MEI", "CNPJ"]);
  } finally {
    view.unmount();
  }
});
test("FAQ opens one answer at a time and preserves keyboard focus", () => {
  const view = render(<HomeFaq />);
  try {
    const buttons = [
      ...view.container.querySelectorAll<HTMLButtonElement>(".faq-trigger"),
    ];
    assert.equal(buttons[0].getAttribute("aria-expanded"), "true");
    act(() => {
      buttons[1].focus();
      buttons[1].click();
    });
    assert.equal(document.activeElement, buttons[1]);
    assert.equal(buttons[0].getAttribute("aria-expanded"), "false");
    assert.equal(
      view.container.querySelector<HTMLElement>("#faq-answer-0")?.hidden,
      true,
    );
    assert.equal(
      view.container.querySelector<HTMLElement>("#faq-answer-1")?.hidden,
      false,
    );
    act(() => buttons[1].click());
    assert.equal(buttons[1].getAttribute("aria-expanded"), "false");
  } finally {
    view.unmount();
  }
});
